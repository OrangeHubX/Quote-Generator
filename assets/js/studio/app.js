/* app.js — The studio: preview, transport, media, paste and export wiring.

   The preview is deliberately not the exporter. It plays the plate in real
   time and draws at whatever size fits the window, because a preview that
   insists on being frame-exact at 4K is a preview nobody can scrub. The
   exporter parks the same plate frame by frame at full size through the same
   `renderFrame()`, so the two agree on everything except pixels. */

import {RT, SEQ, TRACKS, addClip, duplicateClip, findClip, freeVisTrack, importPaste,
        markDirty, redo, removeClip, restore, seqDur, snapshot, splitClip, srcTime,
        undo} from './model.js';
import {BOUNDS, clipAtPoint, renderFrame} from './draw.js';
import {addFiles, get, list, playAudio, stopAudio} from './media.js';
import {deleteSelected, drawTL, followPlayhead, initTimeline, tcFrames, zoomBy, zoomFit} from './timeline.js';
import {initInspector, renderInspector} from './inspector.js';
import {exportFrames, exportMp4, hasWebCodecs, parkPlate, safeName, saveBlob, ytBitrate} from './output.js';
import {clearCardCache} from './card.js';
import {SPEC} from './spec.js';

const $=s=>document.querySelector(s);
const pv=$("#pv"),pctx=pv.getContext("2d",{alpha:false});
const mediaHints={};
let seekToken=0;
const phone=()=>window.innerWidth<=900;
/* Pointer capability, not screen size: a small window on a laptop still has a
   mouse and a file system to drag from, and a tablet does not. */
const touch=()=>window.matchMedia&&window.matchMedia("(hover:none)").matches;

/* ---------- viewport ----------
   The same --vh trick the card page uses, rewritten here rather than imported:
   state.js owns the card editor's keyboard handling and pulls its whole UI in
   behind it. All the studio needs is the height. Static vh is not enough — on a
   phone it counts the area behind the browser chrome and the keyboard, so the
   timeline ends up under both. */
function syncVH(){
  const vv=window.visualViewport;
  const root=document.documentElement;
  const h=Math.round(vv?vv.height:window.innerHeight);
  if(root.style.getPropertyValue("--vh")!==h+"px")root.style.setProperty("--vh",h+"px");
  drawPreview();drawTL();
}
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",syncVH);
  window.visualViewport.addEventListener("scroll",syncVH);
}
window.addEventListener("orientationchange",()=>setTimeout(syncVH,200));

/* ---------- the mobile sheet ----------
   On a phone the inspector is a bottom sheet resting at its tab row. The tab
   row is the handle: tapping a tab raises the sheet on it, tapping the tab
   already showing puts it back down. On a desktop the tabs are just tabs. */
function sheetOpen(){return document.body.dataset.sheet==="open";}
function setSheet(open){
  if(sheetOpen()===open)return;
  document.body.dataset.sheet=open?"open":"shut";
  /* The stage resizes with the sheet, and CSS will not tell the canvas about
     it. Repaint now for the start of the slide and again once it has settled. */
  drawPreview();
  clearTimeout(setSheet._t);
  setSheet._t=setTimeout(()=>{drawPreview();drawTL();},280);
}
export function showTab(name,openIt){
  for(const b of document.querySelectorAll("#tabs button"))
    b.setAttribute("aria-pressed",String(b.dataset.tab===name));
  for(const p of document.querySelectorAll(".pane"))
    p.classList.toggle("hide",p.dataset.pane!==name);
  if(name==="inspect")renderInspector();
  if(name==="media")refreshMediaList();
  if(name==="export")syncRate();
  if(openIt&&phone())setSheet(true);
}

/* ---------- preview ---------- */
function previewSize(){
  const wrap=$(".pwrap"),b=wrap.getBoundingClientRect();
  const ar=SEQ.w/SEQ.h;
  let w=b.width-8,h=w/ar;
  if(h>b.height-8){h=b.height-8;w=h*ar;}
  return {css:{w:Math.max(40,w),h:Math.max(40,h)}};
}
export function drawPreview(){
  const {css}=previewSize();
  pv.style.width=Math.round(css.w)+"px";
  pv.style.height=Math.round(css.h)+"px";
  /* Cap the backing store: a 4K preview costs four times the fill rate and
     shows nothing extra on a 900px-wide box. */
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const maxW=Math.min(SEQ.w,1280);
  const W=Math.min(maxW,Math.round(css.w*dpr));
  const H=Math.round(W*SEQ.h/SEQ.w);
  if(pv.width!==W||pv.height!==H){pv.width=W;pv.height=H;}
  renderFrame(pctx,W,H,RT.time,{preview:true});
  /* The total costs half the bar's width and the ruler already shows where the
     sequence ends, so a phone gets the playhead alone. */
  $("#tcRead").textContent=phone()?tcFrames(RT.time)
    :tcFrames(RT.time)+" / "+tcFrames(seqDur());
}
/* Scrubbing needs the plate parked on the right frame, and parking is async.
   Draw immediately so the overlay follows the pointer, then draw again once
   the video has actually landed. A token drops stale seeks. */
function refresh(){
  drawPreview();
  if(RT.playing)return;
  const my=++seekToken;
  parkPlate(RT.time,false).then(()=>{if(my===seekToken)drawPreview();});
}
export function repaint(){refresh();drawTL();}

/* ---------- transport ---------- */
let rafId=0,wallT0=0,seqT0=0;
function audioTracks(){
  return SEQ.clips.filter(c=>c.type==="audio").map(c=>({
    item:get(c.props.src,"audio"),at:c.t0-(c.props.srcIn||0),gain:c.props.gain
  })).filter(x=>x.item);
}
function plateEls(){
  const out=[];
  for(const c of SEQ.clips){
    if(c.track!=="bg")continue;
    const m=get(c.props.src,"video");
    if(m)out.push({clip:c,item:m});
  }
  return out;
}
export function play(){
  if(RT.playing)return;
  if(RT.time>=seqDur()-1e-3)RT.time=0;
  RT.playing=true;
  wallT0=performance.now();seqT0=RT.time;
  playAudio(audioTracks(),RT.time);
  for(const p of plateEls()){
    try{p.item.el.currentTime=Math.max(0,srcTime(p.clip,RT.time)%(p.item.dur||1e9));
        p.item.el.loop=true;p.item.el.play();}catch(_){}
  }
  $("#play").setAttribute("aria-pressed","true");
  rafId=requestAnimationFrame(tick);
}
export function pause(){
  if(!RT.playing)return;
  RT.playing=false;
  cancelAnimationFrame(rafId);
  stopAudio();
  for(const p of plateEls()){try{p.item.el.pause();}catch(_){}}
  $("#play").setAttribute("aria-pressed","false");
  refresh();
}
function tick(){
  if(!RT.playing)return;
  RT.time=seqT0+(performance.now()-wallT0)/1000;
  const end=seqDur();
  if(RT.time>=end){RT.time=end;pause();drawTL();return;}
  /* Nudge the plate back if it has drifted — a muted <video> free-runs and
     will not stay locked to a clock it does not know about. */
  for(const p of plateEls()){
    const want=srcTime(p.clip,RT.time)%(p.item.dur||1e9);
    if(Math.abs(p.item.el.currentTime-want)>0.28){try{p.item.el.currentTime=want;}catch(_){}}
  }
  drawPreview();followPlayhead();drawTL();
  rafId=requestAnimationFrame(tick);
}
function seekTo(t){
  RT.time=Math.max(0,Math.min(seqDur(),t));
  if(RT.playing){seqT0=RT.time;wallT0=performance.now();playAudio(audioTracks(),RT.time);}
  refresh();drawTL();
}
function step(frames){pause();seekTo(RT.time+frames/(SEQ.fps||30));}

/* ---------- dragging an element in the preview ---------- */
let pdrag=null;
pv.addEventListener("pointerdown",e=>{
  const b=pv.getBoundingClientRect();
  const x=(e.clientX-b.left)/b.width*pv.width;
  const y=(e.clientY-b.top)/b.height*pv.height;
  const clip=clipAtPoint(x,y,RT.time);
  if(!clip){RT.sel=null;renderInspector();drawTL();return;}
  RT.sel=clip.id;renderInspector();drawTL();
  pdrag={clip,x:e.clientX,y:e.clientY,x0:clip.props.x||0,y0:clip.props.y||0,
         w:b.width,h:b.height,moved:false};
  pv.setPointerCapture&&pv.setPointerCapture(e.pointerId);
});
pv.addEventListener("pointermove",e=>{
  if(!pdrag){
    const b=pv.getBoundingClientRect();
    const x=(e.clientX-b.left)/b.width*pv.width,y=(e.clientY-b.top)/b.height*pv.height;
    pv.style.cursor=clipAtPoint(x,y,RT.time)?"move":"default";
    return;
  }
  const dx=e.clientX-pdrag.x,dy=e.clientY-pdrag.y;
  /* A few pixels of travel is a tap with a shaky thumb, not a reposition. */
  if(!pdrag.moved&&Math.abs(dx)+Math.abs(dy)<6)return;
  pdrag.moved=true;
  pdrag.clip.props.x=pdrag.x0+dx/pdrag.w*100;
  pdrag.clip.props.y=pdrag.y0+dy/pdrag.h*100;
  drawPreview();
});
window.addEventListener("pointerup",()=>{
  if(!pdrag)return;
  if(pdrag.moved)markDirty();
  else if(phone())showTab("inspect",true);
  renderInspector();
  pdrag=null;
});

/* ---------- media ---------- */
async function takeFiles(files){
  const added=await addFiles(files);
  if(!added.length)return;
  for(const m of added){
    if(m.kind==="video"&&!SEQ.clips.some(c=>c.track==="bg"&&c.props.src))
      assignPlate(m.key);
    if(m.kind==="audio")placeAudio(m);
  }
  clearCardCache();
  toast(added.length+" file"+(added.length>1?"s":"")+" loaded");
  refreshMediaList();renderInspector();repaint();markDirty();
}
function assignPlate(key){
  for(const c of SEQ.clips)if(c.track==="bg"&&!c.props.src)c.props.src=key;
}
function placeAudio(m){
  const voice=/vo|voice|narration|read|script/i.test(m.name);
  const track=voice||!SEQ.clips.some(c=>c.track==="a1")?"a1":"a2";
  const existing=SEQ.clips.find(c=>c.track===track&&c.type==="audio"&&!c.props.src);
  const len=Math.max(0.5,m.dur||5);
  if(existing){existing.props.src=m.key;existing.t1=existing.t0+len;return;}
  addClip("audio",track,0,len,{src:m.key,gain:track==="a2"?24:100});
  /* The read is the spine of the video: if the voiceover is longer than the
     pasted timing, stretch the plate to cover it rather than ending early. */
  for(const c of SEQ.clips)if(c.track==="bg"&&c.t1<len)c.t1=len;
}
function refreshMediaList(){
  const box=$("#mediaList");
  box.innerHTML="";
  const items=list();
  if(!items.length){
    box.appendChild(mk("div","mempty",touch()
      ? "Nothing loaded yet. Use Choose files below to add the gameplay, the voiceover and any images."
      : "Drop gameplay, images and the voiceover anywhere on this page, or use Choose files below."));
  }
  for(const m of items){
    const r=mk("div","mrow");
    r.appendChild(mk("span","mkind "+m.kind,m.kind[0].toUpperCase()));
    r.appendChild(mk("span","mname",m.name));
    r.appendChild(mk("span","mmeta",m.kind==="image"?m.w+"×"+m.h
      :m.dur?m.dur.toFixed(1)+"s":""));
    box.appendChild(r);
  }
  const want=new Set();
  for(const c of SEQ.clips){
    const s=c.props.src;
    if(s&&!get(s))want.add(s);
    if(c.props.card&&c.props.card.avatar&&!get(c.props.card.avatar))want.add(c.props.card.avatar);
  }
  const how=$("#mediaHow");
  if(how)how.textContent=touch()
    ? "Pick the gameplay clip, the voiceover and any images — all at once is fine."
    : "Or drag them anywhere onto the page.";
  const miss=$("#missing");
  miss.innerHTML="";
  if(want.size){
    miss.appendChild(mk("div","mwarn","Waiting on: "+[...want].join(", ")));
  }
}
function mk(tag,cls,txt){const n=document.createElement(tag);n.className=cls||"";
  if(txt!=null)n.textContent=txt;return n;}

["dragenter","dragover"].forEach(ev=>window.addEventListener(ev,e=>{
  if(!e.dataTransfer)return;
  e.preventDefault();document.body.classList.add("dropping");
}));
["dragleave","drop"].forEach(ev=>window.addEventListener(ev,e=>{
  e.preventDefault();
  if(ev==="drop"&&e.dataTransfer&&e.dataTransfer.files.length)takeFiles(e.dataTransfer.files);
  if(ev==="drop"||e.relatedTarget===null)document.body.classList.remove("dropping");
}));
$("#pick").addEventListener("change",e=>{takeFiles(e.target.files);e.target.value="";});

/* ---------- paste ---------- */
function openPaste(){
  $("#pasteBox").value=RT.lastPaste||"";
  $("#pasteWrap").classList.add("on");
  setTimeout(()=>$("#pasteBox").focus(),40);
}
/* Select the whole of a read-only textarea, including on iOS, where `select()`
   on a readonly field does nothing and the field has to be made writable for
   the length of the call. Selection is the fallback that always works: even
   with no clipboard API and no share sheet, a long-press offers Copy. */
function selectAll(el){
  el.focus();
  const ro=el.readOnly;
  try{
    el.readOnly=false;
    el.setSelectionRange(0,el.value.length);
  }catch(_){try{el.select();}catch(__){}}
  el.readOnly=ro;
  /* Selecting to the end scrolls to the end, which shows the last line of the
     worked example instead of what the document is. Put it back. */
  el.scrollTop=0;
}
function closePaste(){$("#pasteWrap").classList.remove("on");}
$("#paste").addEventListener("click",openPaste);
$("#pasteCancel").addEventListener("click",closePaste);
$("#pasteWrap").addEventListener("click",e=>{if(e.target.id==="pasteWrap")closePaste();});
$("#pasteGo").addEventListener("click",()=>{
  const text=$("#pasteBox").value;
  if(!text.trim())return;
  const res=importPaste(text,mediaHints);
  if(!res){toast("Couldn't find a shotlist or a script in that.");return;}
  RT.lastPaste=text;RT.sel=null;RT.time=0;
  /* Names the shotlist mentioned may already be loaded — hook them up now. */
  for(const c of SEQ.clips){
    if(c.track==="bg"&&!c.props.src)c.props.src=mediaHints.gameplay||mediaHints.bg||"";
  }
  if(mediaHints.vo&&get(mediaHints.vo,"audio")){
    const m=get(mediaHints.vo,"audio");
    if(!SEQ.clips.some(c=>c.type==="audio"))placeAudio(m);
  }
  closePaste();
  zoomFit();syncExportToSeq();refreshMediaList();renderInspector();repaint();markDirty();
  const n=SEQ.clips.length;
  toast(n+" clips · "+(res.source==="block"?"shotlist":"read from the script")+
    (res.warnings.length?" · "+res.warnings[0]:""));
  if(res.warnings.length>1)console.log("Import notes:\n"+res.warnings.join("\n"));
});
/* ---------- the format spec ----------
   Three ways out, because no single one is available everywhere. The clipboard
   API needs a secure context and a permission a phone may refuse; the share
   sheet is the natural route on a phone and does not exist on a desktop; a file
   works anywhere but is clumsy. Whichever fails, the text is on screen and
   selected, which is the route that cannot fail. */
const SPEC_FILE="palm-static-shotlist-format.md";
function openSpec(){
  const box=$("#specBox");
  box.value=SPEC;
  $("#specWrap").classList.add("on");
  $("#specShare").classList.toggle("hide",!navigator.share);
  setTimeout(()=>selectAll(box),60);
}
function closeSpec(){$("#specWrap").classList.remove("on");}
async function copySpec(){
  const box=$("#specBox");
  selectAll(box);
  try{
    await navigator.clipboard.writeText(SPEC);
    toast("Format spec copied — paste it into your Claude project knowledge");
    return;
  }catch(_){}
  /* Deprecated, and still the only thing that works in a few mobile browsers. */
  try{
    if(document.execCommand("copy")){
      toast("Format spec copied — paste it into your Claude project knowledge");
      return;
    }
  }catch(_){}
  toast("Couldn't reach the clipboard — the text is selected, so long-press and Copy");
}
$("#spec").addEventListener("click",openSpec);
$("#specClose").addEventListener("click",closeSpec);
$("#specWrap").addEventListener("click",e=>{if(e.target.id==="specWrap")closeSpec();});
$("#specCopy").addEventListener("click",copySpec);
$("#specSave").addEventListener("click",()=>{
  saveBlob(new Blob([SPEC],{type:"text/markdown"}),SPEC_FILE);
  toast("Saved "+SPEC_FILE);
});
$("#specShare").addEventListener("click",async()=>{
  try{
    /* Sharing a file lands in more apps than sharing raw text, but not every
       phone accepts one — fall back to the text before giving up. */
    const file=new File([SPEC],SPEC_FILE,{type:"text/markdown"});
    if(navigator.canShare&&navigator.canShare({files:[file]}))
      await navigator.share({files:[file],title:"Palm Static shotlist format"});
    else
      await navigator.share({title:"Palm Static shotlist format",text:SPEC});
  }catch(_){ /* dismissing the share sheet throws; that is not an error */ }
});

/* ---------- adding clips by hand ----------
   The menu is moved to <body> before it is measured. Any scrolling ancestor
   clips a positioned child, and the tool bar scrolls on a phone — which is how
   the whole menu ended up unreachable there. Measuring at body level makes the
   placement unconditional. */
function placePop(btn,pop){
  if(pop.parentElement!==document.body)document.body.appendChild(pop);
  pop.style.visibility="hidden";
  pop.classList.add("on");
  const b=btn.getBoundingClientRect();
  const pw=pop.offsetWidth,ph=pop.offsetHeight;
  let top=b.bottom+6;
  if(top+ph>window.innerHeight-8)top=Math.max(8,b.top-ph-6);
  const left=Math.min(Math.max(8,b.left),window.innerWidth-pw-8);
  pop.style.left=Math.round(left)+"px";
  pop.style.top=Math.round(top)+"px";
  pop.style.visibility="";
}

/* ---------- adding clips by hand ---------- */
const ADDABLE=[["text","Text"],["stamp","Stamp"],["list","Name list"],["lower","Lower third"],
  ["image","Image"],["card","Quote card"],["say","Script line"],["beat","Beat note"]];
function buildAdd(){
  const pop=$("#addPop");
  for(const [type,label] of ADDABLE){
    const b=mk("button","addItem",label);
    b.addEventListener("click",()=>{
      const t0=RT.time,t1=t0+(type==="say"?2:3);
      const track=type==="say"?"say":type==="beat"?"beat":freeVisTrack(t0,t1);
      const clip=addClip(type,track,t0,t1,type==="text"?{text:"New line"}
        :type==="stamp"?{text:"WORD"}:type==="lower"?{text:"Source"}:{});
      RT.sel=clip.id;
      pop.classList.remove("on");
      markDirty();repaint();
      /* A new clip is a placeholder — "New line", "WORD" — so the next thing
         anyone wants is the field that replaces it. On a phone that means
         raising the sheet, not just filling a panel nobody can see. */
      showTab("inspect",true);
    });
    pop.appendChild(b);
  }
  $("#add").addEventListener("click",e=>{
    e.stopPropagation();
    if(pop.classList.contains("on")){pop.classList.remove("on");return;}
    placePop($("#add"),pop);
  });
  document.addEventListener("click",()=>pop.classList.remove("on"));
  window.addEventListener("resize",()=>pop.classList.remove("on"));
}

/* ---------- export ---------- */
let stopFlag=false,busy=false;
function exportOpts(){
  const [w,h]=$("#xRes").value.split("x").map(Number);
  const fps=+$("#xFps").value||SEQ.fps;
  return {w,h,fps,bitrate:Math.round((+$("#xRate").value||0)*1e6)};
}
/* The paste decides the frame size and rate, so the export panel has to follow
   it — otherwise a 4K vertical shotlist quietly renders at whatever the panel
   was last left on. */
function syncExportToSeq(){
  const want=SEQ.w+"x"+SEQ.h;
  if([...$("#xRes").options].some(o=>o.value===want))$("#xRes").value=want;
  if([...$("#xFps").options].some(o=>o.value===String(SEQ.fps)))$("#xFps").value=String(SEQ.fps);
  syncRate();
}
function syncRate(){
  const o=exportOpts();
  const auto=ytBitrate(o.w,o.h,o.fps)/1e6;
  $("#xRate").placeholder=String(auto);
  let note="YouTube's top recommended rate for "+Math.min(o.w,o.h)+"p"+o.fps+
    " is "+auto+" Mb/s";
  if(!hasWebCodecs())note+=" · this browser has no H.264 encoder, so frames are the only route";
  /* Worth saying before someone starts a ten-minute render on a phone and
     assumes it has hung. */
  else if(touch()&&Math.min(o.w,o.h)>=2000)
    note+=" · 4K on a phone is slow and memory-hungry — 1080p here and a re-render on a desktop is often the faster route";
  $("#xNote").textContent=note;
}
["#xRes","#xFps","#xRate"].forEach(s=>$(s).addEventListener("input",syncRate));
$("#render").addEventListener("click",async()=>{
  if(busy)return;
  pause();
  const o=exportOpts();
  if(!o.bitrate)o.bitrate=ytBitrate(o.w,o.h,o.fps);
  o.dur=seqDur();
  o.stopped=()=>stopFlag;
  stopFlag=false;busy=true;
  $("#render").disabled=true;$("#cancel").classList.remove("hide");
  const t0=performance.now();
  const report=m=>{
    const pct=Math.round((m.p||0)*100);
    $("#xBar").style.width=(m.phase==="video"?pct:m.phase==="audio"?pct*0.15:100)+"%";
    let s=(m.label||"")+(m.frame?" "+m.frame+"/"+m.total:"")+" · "+pct+"%";
    if(m.phase==="video"&&m.frame>8){
      const per=(performance.now()-t0)/m.frame;
      const left=Math.round(per*(m.total-m.frame)/1000);
      s+="  ·  ~"+(left>90?Math.round(left/60)+" min":left+"s")+" left";
    }
    $("#xStat").textContent=s;
  };
  try{
    const wantMp4=$("#xFmt").value==="mp4"&&hasWebCodecs();
    const blob=wantMp4?await exportMp4(o,report):await exportFrames(o,report);
    const name=safeName(SEQ.title)+"_"+Math.min(o.w,o.h)+"p"+o.fps;
    saveBlob(blob,name+(wantMp4?".mp4":"_frames.zip"));
    $("#xStat").textContent="Saved "+name+(wantMp4?".mp4":"_frames.zip")+
      " · "+(blob.size/1048576).toFixed(1)+" MB";
    $("#xBar").style.width="100%";
  }catch(err){
    $("#xStat").textContent=/cancel/i.test(err.message)?"Cancelled.":"Export failed: "+err.message;
    $("#xBar").style.width="0%";
  }
  busy=false;$("#render").disabled=false;$("#cancel").classList.add("hide");
  refresh();
});
$("#cancel").addEventListener("click",()=>{stopFlag=true;});

/* ---------- toast ---------- */
let toastT=0;
function toast(msg){
  const t=$("#snack");
  t.textContent=msg;t.classList.add("on");
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),4200);
}

/* ---------- keyboard ---------- */
const typing=()=>{
  const a=document.activeElement;
  return a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.isContentEditable);
};
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closePaste();closeSpec();return;}
  if(typing())return;
  const mod=e.metaKey||e.ctrlKey;
  if(mod&&e.key.toLowerCase()==="z"){
    e.preventDefault();
    if(e.shiftKey?redo():undo()){RT.sel=null;renderInspector();repaint();}
    return;
  }
  if(mod&&e.key==="Enter"){e.preventDefault();$("#render").click();return;}
  if(mod&&e.key.toLowerCase()==="d"){
    e.preventDefault();
    const b=RT.sel&&duplicateClip(RT.sel);
    if(b){RT.sel=b.id;markDirty();renderInspector();repaint();}
    return;
  }
  if(mod&&e.key.toLowerCase()==="v")return;
  switch(e.key){
    case "s":case "S":{
      const target=RT.sel||(SEQ.clips.find(x=>x.track==="bg"&&RT.time>x.t0&&RT.time<x.t1)||{}).id;
      const b=target&&splitClip(target,RT.time);
      if(b){RT.sel=b.id;markDirty();renderInspector();repaint();}
      else toast("Nothing to split under the playhead");
      break;
    }
    case " ":e.preventDefault();RT.playing?pause():play();break;
    case "ArrowLeft":e.preventDefault();step(e.shiftKey?-10:-1);break;
    case "ArrowRight":e.preventDefault();step(e.shiftKey?10:1);break;
    case "Home":e.preventDefault();pause();seekTo(0);break;
    case "End":e.preventDefault();pause();seekTo(seqDur());break;
    case "Delete":case "Backspace":
      if(deleteSelected()){renderInspector();repaint();}
      break;
    case "=":case "+":zoomBy(1.3);break;
    case "-":case "_":zoomBy(1/1.3);break;
    case "f":case "F":zoomFit();break;
  }
});

/* ---------- autosave ----------
   The sequence is small JSON; the media is not and cannot be saved, so a
   reopened tab comes back with every clip in place and its files missing,
   which the media panel already knows how to say out loud. */
const KEY="palm-studio-v1";
function save(){try{localStorage.setItem(KEY,snapshot());}catch(_){}}
function loadSaved(){
  try{
    const j=localStorage.getItem(KEY);
    if(j&&restore(j))return true;
  }catch(_){}
  return false;
}
setInterval(save,4000);
window.addEventListener("beforeunload",save);
$("#reset").addEventListener("click",()=>{
  if(!confirm("Clear the timeline? Loaded files stay."))return;
  SEQ.clips.length=0;RT.sel=null;RT.time=0;
  addClip("bg","bg",0,20,{src:(list("video")[0]||{}).key||""});
  markDirty();zoomFit();renderInspector();repaint();refreshMediaList();
});

/* ---------- boot ---------- */
function boot(){
  if(!loadSaved())addClip("bg","bg",0,20,{});
  initTimeline($("#tl"),{
    onSeek:t=>{RT.time=t;if(RT.playing){seqT0=t;wallT0=performance.now();playAudio(audioTracks(),t);}refresh();},
    onSelect:()=>renderInspector(),
    onChange:()=>{drawPreview();},
    /* Tapping a clip without dragging it means "edit this". On a phone that is
       the gesture that brings the inspector up; on a desktop the panel is
       already there and only needs scrolling back to the top. */
    onTap:()=>{
      renderInspector();
      if(phone())showTab("inspect",true);
      else $(".insp").scrollTo({top:0,behavior:"smooth"});
    },
    onOpen:()=>{
      renderInspector();
      if(phone())showTab("inspect",true);
      else $(".insp").scrollTo({top:0,behavior:"smooth"});
    }
  });
  initInspector($("#insp"),()=>{drawPreview();drawTL();});
  buildAdd();
  $("#play").addEventListener("click",()=>RT.playing?pause():play());
  $("#home").addEventListener("click",()=>{pause();seekTo(0);});
  $("#fit").addEventListener("click",zoomFit);
  $("#zin").addEventListener("click",()=>zoomBy(1.3));
  $("#zout").addEventListener("click",()=>zoomBy(1/1.3));
  for(const b of document.querySelectorAll("#tabs button"))b.addEventListener("click",()=>{
    const active=b.getAttribute("aria-pressed")==="true";
    /* On a phone the tab you are already on is the way back down. */
    if(phone()&&active&&sheetOpen()){setSheet(false);return;}
    showTab(b.dataset.tab,true);
  });
  window.addEventListener("resize",()=>{syncVH();drawPreview();drawTL();});
  /* Park the sheet before the first paint and only then allow it to animate,
     or it slides up from nowhere on load. */
  document.body.dataset.sheet="init";
  requestAnimationFrame(()=>{document.body.dataset.sheet="shut";});
  syncVH();
  syncExportToSeq();refreshMediaList();renderInspector();zoomFit();repaint();
  /* Console handle, the same bargain the card page makes with window.QS:
     enough to inspect and drive the thing without opening a debugger. */
  window.STUDIO={SEQ,RT,TRACKS,BOUNDS,findClip,removeClip,
    draw:drawPreview,park:parkPlate,repaint,play,pause,seek:seekTo};
}
boot();
