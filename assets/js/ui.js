/* ui.js — All DOM wiring: text fields, sliders, segmented groups, tabs, presets, design switching. */
import {$, EYE_OWNED, EYE_ROW, METRICS, OUTLETS, R, RELEVANT, S, V_ON, clamp, ctx, cv, d, isPhone} from './data.js';
import {isTextField, scheduleDraw} from './state.js';
import {bridge, covered, remap, setRanges, subtract, trimEdges} from './text.js';
import {invalidateLayout} from './layout.js';
import {draw} from './curve.js';
import {applyCurve, drawGraph, setInfluence, setSpeed, syncBezFields} from './graph.js';
import {animated, setFrame, step, toggle as togglePlay} from './timeline.js';
import {snack} from './export.js';
import {buildShowChips, syncBezBtn, syncTwitch} from './panels.js';
import {redo, undo} from './history.js';

/* ---------- tap to highlight ---------- */
export function syncWords(){
  const box=$("#words");
  if(R.wordSig!==S.text){
    const re=/\S+/g,frag=document.createDocumentFragment();let m;
    while((m=re.exec(S.text))){
      const b=document.createElement("button");
      b.className="w";b.textContent=m[0];
      b.dataset.s=m.index;b.dataset.e=m.index+m[0].length;
      frag.appendChild(b);
    }
    box.innerHTML="";box.appendChild(frag);R.wordSig=S.text;
  }
  for(const b of box.children) b.classList.toggle("on",covered(S.ranges,+b.dataset.s,+b.dataset.e));
}
function toggleToken(s,e,force){
  const on=covered(S.ranges,s,e),want=force===undefined?!on:force;
  if(want===on)return false;
  S.ranges=want?bridge(S.ranges.concat([[s,e]])):trimEdges(subtract(S.ranges,s,e));
  syncMirror();invalidateLayout();return true;
}
(function(){
  const box=$("#words");let down=false,mode2,sx=0,sy=0,armed=false;
  box.addEventListener("pointerdown",e=>{
    const w=e.target.closest(".w");if(!w)return;
    down=true;armed=false;sx=e.clientX;sy=e.clientY;
    mode2=!covered(S.ranges,+w.dataset.s,+w.dataset.e);
    markTapSeen();
    if(toggleToken(+w.dataset.s,+w.dataset.e,mode2))scheduleDraw();
  });
  box.addEventListener("pointermove",e=>{
    if(!down)return;
    if(!armed){
      if(Math.abs(e.clientX-sx)<10&&Math.abs(e.clientY-sy)<10)return;
      if(Math.abs(e.clientY-sy)>Math.abs(e.clientX-sx)){down=false;return;}
      armed=true;try{box.setPointerCapture(e.pointerId);}catch(_){}
    }
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const w=el&&el.closest?el.closest(".w"):null;
    if(w&&box.contains(w)&&toggleToken(+w.dataset.s,+w.dataset.e,mode2))scheduleDraw();
  });
  const up=e=>{down=false;armed=false;try{box.releasePointerCapture(e.pointerId);}catch(_){}};
  box.addEventListener("pointerup",up);box.addEventListener("pointercancel",up);
})();

/* ---------- hints that earn their line ----------
   Both of these are true once and noise thereafter, so each shows only while it
   still has something to say. */
const TAP_SEEN="qs-tapseen";
export function syncHints(){
  const tap=$("#tapHint");
  if(tap){
    let seen=false;
    try{seen=localStorage.getItem(TAP_SEEN)==="1";}catch(_){}
    tap.classList.toggle("hide",seen||!S.text.trim());
  }
  const src=$("#sourceHint");
  if(src)src.classList.toggle("hide",!!(S.outlet||"").trim()||!!(S.url||"").trim());
}
export function markTapSeen(){
  try{localStorage.setItem(TAP_SEEN,"1");}catch(_){}
  syncHints();
}

/* ---------- outlet autocomplete ---------- */
const acEl=$("#ac"),outletEl=$("#outlet"),urlEl=$("#url");
let acItems=[],acIdx=-1;
function today(){
  const dd=new Date(),M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return dd.getDate()+" "+M[dd.getMonth()]+" "+dd.getFullYear();
}
function acClose(){acEl.dataset.open="false";outletEl.setAttribute("aria-expanded","false");acIdx=-1;acItems=[];}
function acOpen(q){
  const s=q.trim().toLowerCase();
  if(!s){acClose();return;}
  const starts=[],has=[];
  for(const o of OUTLETS){
    const n=o[0].toLowerCase();
    if(n.startsWith(s))starts.push(o);
    else if(n.includes(s)||o[1].includes(s))has.push(o);
  }
  acItems=starts.concat(has).slice(0,8);
  if(!acItems.length||(acItems.length===1&&acItems[0][0].toLowerCase()===s)){acClose();return;}
  acEl.innerHTML="";
  acItems.forEach((o,i)=>{
    const li=document.createElement("li");
    li.setAttribute("role","option");li.setAttribute("aria-selected",String(i===acIdx));
    const b=document.createElement("b");b.textContent=o[0];
    const sm=document.createElement("small");sm.textContent=o[1];
    li.append(b,sm);
    li.addEventListener("mousedown",ev=>{ev.preventDefault();acPick(i);});
    acEl.appendChild(li);
  });
  acEl.dataset.open="true";outletEl.setAttribute("aria-expanded","true");
}
function acMove(dir){
  if(acEl.dataset.open!=="true")return;
  acIdx=(acIdx+dir+acItems.length)%acItems.length;
  [...acEl.children].forEach((li,i)=>{
    li.setAttribute("aria-selected",String(i===acIdx));
    if(i===acIdx)li.scrollIntoView({block:"nearest"});
  });
}
function acPick(i){
  const o=acItems[i];if(!o)return;
  S.outlet=o[0];outletEl.value=o[0];markFilled(outletEl);
  if(R.urlAuto||!urlEl.value.trim()){
    S.url=o[1]+" · "+today();urlEl.value=S.url;markFilled(urlEl);R.urlAuto=true;
  }
  acClose();syncHints();invalidateLayout();scheduleDraw();
}
outletEl.addEventListener("input",e=>{S.outlet=e.target.value;markFilled(outletEl);acIdx=-1;acOpen(e.target.value);syncHints();invalidateLayout();scheduleDraw();});
outletEl.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"){e.preventDefault();if(acEl.dataset.open!=="true")acOpen(outletEl.value);acMove(1);}
  else if(e.key==="ArrowUp"){e.preventDefault();acMove(-1);}
  else if(e.key==="Enter"){if(acEl.dataset.open==="true"){e.preventDefault();acPick(acIdx<0?0:acIdx);}}
  else if(e.key==="Escape"){acClose();}
  else if(e.key==="Tab"){acClose();}
});
outletEl.addEventListener("blur",()=>setTimeout(acClose,120));
urlEl.addEventListener("input",e=>{S.url=e.target.value;R.urlAuto=false;markFilled(urlEl);syncHints();invalidateLayout();scheduleDraw();});

/* ---------- text fields ---------- */
export const ta=$("#text");ta.value=S.text;
export function markFilled(el){el.classList.toggle("filled",!!el.value);}
export function autogrow(el){el.style.height="auto";el.style.height=Math.min(el.scrollHeight,210)+"px";}
/* Paint the highlighted ranges into the mirror layer behind the textarea, so the
   field shows what is marked without competing with the card's marker colour. */
const mirror=$("#textMirror");
const esc=t=>t.replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]));
export function syncMirror(){
  const t=S.text,rs=S.ranges;
  let html="",at=0;
  for(const [a,b] of rs){
    if(a>at)html+=esc(t.slice(at,a));
    html+="<mark>"+esc(t.slice(a,b))+"</mark>";
    at=b;
  }
  html+=esc(t.slice(at));
  /* a trailing newline needs a filler or the last line collapses */
  mirror.innerHTML=html+"\n";
  mirror.scrollTop=ta.scrollTop;
}
ta.addEventListener("scroll",()=>{mirror.scrollTop=ta.scrollTop;});
let lastSel=[0,0];
const capSel=()=>{if(document.activeElement===ta)lastSel=[ta.selectionStart,ta.selectionEnd];};
["keyup","mouseup","touchend","select"].forEach(ev=>ta.addEventListener(ev,capSel));
document.addEventListener("selectionchange",capSel);
ta.addEventListener("input",()=>{
  const rs=remap(R.lastText,ta.value,S.ranges);
  S.text=ta.value;R.lastText=ta.value;setRanges(rs);markFilled(ta);autogrow(ta);syncMirror();syncHints();invalidateLayout();scheduleDraw();
});
function toggleHL(){
  let [s,e]=[ta.selectionStart,ta.selectionEnd];
  if(s===e)[s,e]=lastSel;
  if(s===e){snack("Select some words first.");return;}
  S.ranges=covered(S.ranges,s,e)?trimEdges(subtract(S.ranges,s,e)):bridge(S.ranges.concat([[s,e]]));
  syncMirror();invalidateLayout();scheduleDraw();
}
$("#hlBtn").addEventListener("click",toggleHL);
$("#clearBtn").addEventListener("click",()=>{S.ranges=[];syncMirror();invalidateLayout();scheduleDraw();});
document.addEventListener("keydown",e=>{
  if(!(e.metaKey||e.ctrlKey))return;
  const k=e.key.toLowerCase();
  if(k==="h"){e.preventDefault();toggleHL();}
  else if(e.key==="Enter"){e.preventDefault();$("#dl").click();}
  else if(k==="z"){
    e.preventDefault();
    const ok=e.shiftKey?redo():undo();
    if(!ok)snack(e.shiftKey?"Nothing to redo":"Nothing to undo");
  }
  else if(k==="y"){e.preventDefault();if(!redo())snack("Nothing to redo");}
});
/* the strip is short, so fit the card into it unless the user pinned a view
   (setEditing in state.js handles the strip itself) */
document.addEventListener("focusin",e=>{
  if(!isPhone()||R.viewPinned)return;
  if(isTextField(e.target)&&S.view!=="card"){S.view="card";setViewChip();scheduleDraw();}
});

/* ---------- social text inputs ---------- */
function bindText(id,key,fmt){
  const el=$("#"+id);if(!el)return;
  el.addEventListener("input",e=>{S[key]=e.target.value;markFilled(el);invalidateLayout();scheduleDraw();});
}
["name","handle","sub","time","audio","mediaSrc"].forEach(id=>bindText(id,id));
$("#likeOn").addEventListener("change",e=>{S.likeOn=e.target.checked;invalidateLayout();scheduleDraw();});
$("#twReply").addEventListener("change",e=>{
  S.twReply=e.target.checked;
  applyRelevance();                 /* the "replying to" field follows this */
  invalidateLayout();scheduleDraw();
});

/* metrics grid built dynamically per design */
function buildMetrics(){
  const brand=d().brand;if(!brand)return;
  const grid=$("#metricGrid");grid.innerHTML="";
  (METRICS[brand]||[]).forEach(([key,label,ph])=>{
    const row=document.createElement("div");row.className="row hasEye";
    const inp=document.createElement("input");
    inp.type="text";inp.className="txt";inp.spellcheck=false;inp.placeholder=ph||"";
    inp.id="metric_"+key;inp.value=S[key]||"";
    const lb=document.createElement("label");lb.setAttribute("for",inp.id);lb.textContent=label;
    inp.addEventListener("input",e=>{S[key]=e.target.value;invalidateLayout();scheduleDraw();});
    row.append(lb,inp,makeEye(key));grid.appendChild(row);
  });
  syncEyes();
}

/* ---------- element visibility, on the element's own row ----------
   A separate list of chips could disagree with the fields beside it — a filled-in
   Name next to a card that draws no name. The eye sits on the row it governs, so
   the two cannot drift. Only parts with no control of their own stay as chips. */
const EYE_ON='<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>';
const EYE_OFF='<svg viewBox="0 0 24 24"><path d="M4.5 8.5C3 10.1 2 12 2 12s3.6 6.5 10 6.5c1.7 0 3.2-.3 4.5-.9M9.6 6c.8-.2 1.6-.3 2.4-.3 6.4 0 10 6.3 10 6.3s-.9 1.6-2.4 3.2"/><path d="M4 4l16 16"/></svg>';
function makeEye(key){
  const b=document.createElement("button");
  b.type="button";b.className="eye";b.dataset.k=key;
  b.addEventListener("click",e=>{
    /* the avatar eye lives inside the drop, whose own click opens the file dialog */
    e.stopPropagation();e.preventDefault();
    if(S.hidden[key])delete S.hidden[key];else S.hidden[key]=true;
    syncEyes();applyRelevance();buildShowChips();
    invalidateLayout();scheduleDraw();
  });
  return b;
}
export function buildEyes(){
  for(const key in EYE_ROW){
    const row=$("#"+EYE_ROW[key]);if(!row)continue;
    if(!row.querySelector(":scope > .eye")){row.appendChild(makeEye(key));row.classList.add("hasEye");}
  }
  syncEyes();
}
export function syncEyes(){
  document.querySelectorAll(".eye[data-k]").forEach(b=>{
    const on=V_ON(b.dataset.k);
    b.innerHTML=on?EYE_ON:EYE_OFF;
    b.setAttribute("aria-pressed",String(on));
    b.setAttribute("aria-label",(on?"Hide":"Show")+" this on the card");
    b.setAttribute("title",on?"Shown on the card":"Hidden from the card");
    const host=b.closest(".row,.drop");
    if(host)host.dataset.off=String(!on);
  });
}

/* image uploads.
   The picker is opened by calling input.click() from the drop's own click
   handler. Relying on a wrapping <label> did not work: a display:none file
   input never receives the forwarded activation. */
const PLACEHOLDER_ICON={
  avatar:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>',
  media:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M4 18l5-4 4 3 3-2 4 3"/></svg>'
};
const PLACEHOLDER_TEXT={
  avatar:"Optional — a coloured initial is used",
  media:"Shown inside the post"
};
function bindImage(fileId,dropId,thumbId,nameId,clearId,key){
  const file=$("#"+fileId),drop=$("#"+dropId),thumb=$("#"+thumbId),nm=$("#"+nameId),clr=$("#"+clearId);
  function accept(f){
    if(!f||!/^image\//.test(f.type)){snack("That is not an image file.");return;}
    const img=new Image(),u=URL.createObjectURL(f);
    img.onload=()=>{
      S[key]=img;
      thumb.style.backgroundImage="url("+u+")";thumb.innerHTML="";
      nm.textContent=f.name;clr.classList.remove("hide");
      applyRelevance();invalidateLayout();scheduleDraw();
    };
    img.onerror=()=>{URL.revokeObjectURL(u);snack("Could not read that image.");};
    img.src=u;
  }
  function clear(){
    S[key]=null;file.value="";
    thumb.style.backgroundImage="";thumb.innerHTML=PLACEHOLDER_ICON[key];
    nm.textContent=PLACEHOLDER_TEXT[key];clr.classList.add("hide");
    applyRelevance();invalidateLayout();scheduleDraw();
  }
  file.addEventListener("change",e=>accept(e.target.files&&e.target.files[0]));
  drop.addEventListener("click",e=>{
    if(e.target.closest("#"+clearId))return;   /* the ✕ handles itself */
    file.click();
  });
  drop.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){e.preventDefault();file.click();}
  });
  clr.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();clear();});
  /* drag a file straight onto the row */
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{
    e.preventDefault();drop.dataset.over="true";
  }));
  ["dragleave","dragend"].forEach(ev=>drop.addEventListener(ev,()=>{delete drop.dataset.over;}));
  drop.addEventListener("drop",e=>{
    e.preventDefault();delete drop.dataset.over;
    accept(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]);
  });
}
bindImage("avatarFile","avatarDrop","avatarThumb","avatarName","avatarClear","avatar");
bindImage("mediaFile","mediaDrop","mediaThumb","mediaName","mediaClear","media");

/* ---------- highlight colour ---------- */
const hexEl=$("#hlHex"),pickEl=$("#hlPick");
export function setHl(col,fromPreset){
  S.hlColor=col;
  document.documentElement.style.setProperty("--hl",col);
  hexEl.value=col.toUpperCase();markFilled(hexEl);
  pickEl.value=col;
  $("#pickwrap").dataset.active=!fromPreset;
  /* the custom picker sits in the same row and carries no data-v */
  $("#hlColor").querySelectorAll("button[data-v]").forEach(b=>
    b.setAttribute("aria-pressed",String(!!fromPreset&&b.dataset.v.toLowerCase()===col.toLowerCase())));
  scheduleDraw();
}
pickEl.addEventListener("input",e=>setHl(e.target.value,false));
hexEl.addEventListener("input",e=>{
  let v=e.target.value.trim();if(v[0]!=="#")v="#"+v;
  if(/^#[0-9a-f]{6}$/i.test(v))setHl(v,false);
});

/* ---------- sliders (fill tracks handle) ---------- */
/* ---------- sliders: drag, type an exact value, or double-click to reset ---------- */
export const SL=["width","size","ypos","sFrom","over","drift","hold","dur","hlOffset","hlDur","jq",
  "avatarScale","avatarX","avatarY","mediaScale","mediaX","mediaY"];
const LAYOUT_SLIDERS={width:1,size:1,ypos:1};
const SL_DEFAULT={};
export function fillSlider(el){
  const mn=+el.min,mx=+el.max,frac=(el.value-mn)/(mx-mn||1);
  /* the 13px thumb is inset by half its width at each end */
  el.style.setProperty("--fill","calc("+frac+" * (100% - 13px) + 6.5px)");
}
function applySlider(id,v,fromBox){
  const el=$("#"+id),box=$("#"+id+"Num");
  v=clamp(Math.round(v),+el.min,+el.max);
  S[id]=v;el.value=v;
  if(!fromBox||document.activeElement!==box)box.value=v;
  fillSlider(el);
  if(LAYOUT_SLIDERS[id])invalidateLayout();
  scheduleDraw();
}
SL.forEach(id=>{
  const el=$("#"+id),box=$("#"+id+"Num");if(!el||!box)return;
  SL_DEFAULT[id]=S[id];
  el.addEventListener("input",()=>applySlider(id,+el.value,false));
  el.addEventListener("dblclick",()=>applySlider(id,SL_DEFAULT[id],false));
  box.addEventListener("input",()=>{const v=parseFloat(box.value);if(!isNaN(v))applySlider(id,v,true);});
  box.addEventListener("blur",()=>{box.value=S[id];});
  box.addEventListener("keydown",e=>{
    if(e.key==="Enter"){box.blur();return;}
    const step=e.shiftKey?10:1;
    if(e.key==="ArrowUp"){e.preventDefault();applySlider(id,S[id]+step,true);box.value=S[id];}
    if(e.key==="ArrowDown"){e.preventDefault();applySlider(id,S[id]-step,true);box.value=S[id];}
  });
  box.value=S[id];fillSlider(el);
});

/* ---------- toggles ---------- */
["header","marks","anim"].forEach(id=>$("#"+id).addEventListener("change",e=>{
  S[id]=e.target.checked;
  if(id==="anim")applyRelevance();
  invalidateLayout();scheduleDraw();
}));
$("#hlAnim").addEventListener("change",e=>{
  S.hlAnim=e.target.checked;
  $("#hlAnimRow").classList.toggle("hide",!S.hlAnim);
  applyRelevance();scheduleDraw();
});

/* ---------- segmented groups ---------- */
const FMT={still:["Download","A single settled frame."],
  seq:["Download sequence","Numbered PNGs in a zip. Keeps alpha, lossless. Use for Premiere delivery."],
  webm:["Download WebM","Video with no alpha channel. Premiere may not read it."],
  gif:["Download GIF","Looping GIF with 1-bit transparency. Good for quick overlays."]};
export function updateFabLabel(){
  const base=FMT[S.format][0];
  $("#fabLabel").textContent=S.format==="still"?"Download "+S.imgFmt.toUpperCase():base;
  $("#fmtNote").textContent=FMT[S.format][1];
  syncOutSummary();
}
/* The folded Output section states its own answer, so opening it is a choice
   rather than the only way to find out what will be written. */
export function syncOutSummary(){
  const el=$("#outSummary");if(!el)return;
  const bits=[parseFloat(S.res)>1?"4K":"1080p",
    S.bg==="transparent"?"alpha":(S.bg==="#FFFFFF"?"white":"black")];
  if(S.format!=="still")bits.push(S.fps+"fps");
  if(S.format==="still")bits.push(S.imgFmt.toUpperCase());
  el.textContent=bits.join(" · ");
}
/* The token list is reference material — right once, noise thereafter. */
$("#tokenHelp").addEventListener("click",()=>{
  const n=$("#tokenNote"),open=n.classList.toggle("hide");
  $("#tokenHelp").setAttribute("aria-expanded",String(!open));
});
["theme","face","hlStyle","crop","res","bg","fps","fadeEase","format","imgFmt","badge","avShape"].forEach(g=>{
  const host=$("#"+g);
  host.addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b)return;
    [...host.querySelectorAll("button")].forEach(x=>x.setAttribute("aria-pressed",x===b));
    S[g]=b.dataset.v;
    if(g==="format"||g==="imgFmt"||g==="res"||g==="bg"||g==="fps")updateFabLabel();
    /* every conditional row lives in RELEVANT, so one call covers all of them */
    if(g==="format"||g==="imgFmt"||g==="fadeEase")applyRelevance();
    if(g==="theme"||g==="face"||g==="badge"||g==="avShape")invalidateLayout();
    scheduleDraw();
  });
});
$("#hlColor").addEventListener("click",e=>{
  const b=e.target.closest("button[data-v]");if(!b)return;
  setHl(b.dataset.v,true);
});
$("#exportName").addEventListener("input",e=>{S.exportName=e.target.value;markFilled(e.target);});

/* ---------- graph readouts: Influence / Speed / cubic-bezier text ----------
   Editing any of these is just another way of moving a handle, so each one goes
   through graph.js and the graph redraws from the same state. */
[["#infOut",1,setInfluence],["#infIn",2,setInfluence],
 ["#spdOut",1,setSpeed],["#spdIn",2,setSpeed]].forEach(([sel,side,fn])=>{
  const el=$(sel);if(!el)return;
  el.addEventListener("input",()=>{const v=parseFloat(el.value);if(!isNaN(v))fn(side,v);});
  el.addEventListener("blur",()=>syncBezFields());
});
$("#bezText").addEventListener("input",e=>{
  const m=e.target.value.match(/-?\d*\.?\d+/g);
  if(!m||m.length<4)return;
  const v=m.slice(0,4).map(Number);
  if(v.some(isNaN))return;
  v[0]=clamp(v[0],0,1);v[2]=clamp(v[2],0,1);
  applyCurve(v);syncBezBtn();
});
$("#bezText").addEventListener("blur",()=>syncBezFields());

/* ---------- tabs (desktop rail + mobile thumb bar stay in sync) ---------- */
function goTab(name){
  document.querySelectorAll(".tabs button,.mbar .mt").forEach(x=>
    x.setAttribute("aria-selected",String(x.dataset.p===name)));
  document.querySelectorAll(".page").forEach(p=>p.dataset.on=(p.dataset.page===name));
  $(".pages").scrollTop=0;
  scheduleDraw();
}
[".tabs",".mbar"].forEach(sel=>{
  document.querySelector(sel).addEventListener("click",e=>{
    const b=e.target.closest("button[data-p]");if(!b)return;goTab(b.dataset.p);
  });
});
$("#dlMobile").addEventListener("click",()=>$("#dl").click());
/* jump straight to a tab with 1-4 when not typing */
document.addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const t=e.target.tagName;
  if(t==="INPUT"||t==="TEXTAREA"||t==="SELECT")return;
  const map={"1":"content","2":"style","3":"motion","4":"export"};
  if(map[e.key]){e.preventDefault();goTab(map[e.key]);}
});

/* ---------- design switch ---------- */
/* Hide every control that the current selection cannot use. */
export function applyRelevance(){
  const P=d();
  const ctx={id:S.design,brand:P.brand||"",social:!!P.social,post:!!P.post};
  for(const key in RELEVANT){
    const el=$("#"+key);if(!el)continue;
    el.classList.toggle("hide",!RELEVANT[key](ctx));
  }
}
export function applyDesign(){
  const P=d();
  const social=P.social;
  applyRelevance();
  $("#themeLab").textContent=social?"Appearance":"Theme";
  /* theme options: social cards are only ever light or dark */
  const themeBtns=[...$("#theme").querySelectorAll("button")];
  themeBtns[1].classList.toggle("hide",social); /* Paper hidden for social */
  if(social&&S.theme==="paper"){S.theme="light";themeBtns.forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.v==="light")));}
  $("#bodyHead").textContent=social?"Post text":"Quote";
  $("#textLabel").textContent=social?"What does the post say?":"Paste the quote";
  $("#subtitle").textContent=social?(P.brand.toUpperCase()+" — 9:16 for Shorts"):"9:16 source cards for Shorts";
  if(social){
    const brand=P.brand;
    const subLbl=$("#subRow").querySelector('label[for="sub"]');
    if(subLbl)subLbl.textContent=(S.design==="x-reply")?"Replying to @":"Subreddit";
    $("#handleLabel").textContent=(brand==="reddit")?"u/username":(brand==="yt")?"@channel":(brand==="ig")?"username":"@handle";
    buildMetrics();buildShowChips();buildEyes();
    if(brand==="twitch")syncTwitch();
    $("#twReply").checked=!!S.twReply;
    /* push state into the identity controls */
    ["name","handle","sub","time","audio","mediaSrc"].forEach(id=>{const el=$("#"+id);if(el)el.value=S[id]||"";});
    $("#badge").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.v===S.badge)));
    $("#avShape").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.v===S.avShape)));
    $("#likeOn").checked=S.likeOn;
  }
  invalidateLayout();updateFabLabel();scheduleDraw();
}

/* ---------- view framing ---------- */
export function syncGuides(){
  const b=$("#guides");
  b.setAttribute("aria-pressed",String(!!S.guides));
}
$("#guides").addEventListener("click",()=>{
  S.guides=!S.guides;syncGuides();scheduleDraw();
});
export function setViewChip(){
  const b=$("#view");
  const card=S.view==="card";
  b.setAttribute("aria-pressed",String(card));
  b.setAttribute("aria-label",card?"Zoom to fit the frame":"Zoom to card");
  b.setAttribute("title",card?"Zoom out to the whole 9:16 frame (F)":"Zoom the preview to the card (F)");
}
$("#view").addEventListener("click",()=>{S.view=S.view==="frame"?"card":"frame";R.viewPinned=true;setViewChip();scheduleDraw();});
cv.addEventListener("click",()=>$("#view").click());

/* ---------- playback and scrubbing shortcuts ----------
   The keys a video editor already has in their hands. Skipped while a field or
   the graph has focus, since both use the arrows for their own purpose. */
function typingTarget(el){
  if(isTextField(el))return true;
  const t=el&&el.tagName;
  return t==="SELECT"||t==="TEXTAREA"||(el&&el.id==="curve");
}
document.addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(typingTarget(e.target))return;
  if(e.key.toLowerCase()==="f"){e.preventDefault();$("#view").click();return;}
  if(e.key===" "){e.preventDefault();togglePlay();draw();return;}
  if(!animated())return;
  const jump=e.shiftKey?10:1;
  if(e.key==="ArrowRight"){e.preventDefault();step(jump);}
  else if(e.key==="ArrowLeft"){e.preventDefault();step(-jump);}
  else if(e.key==="Home"){e.preventDefault();setFrame(0);}
  else if(e.key==="End"){e.preventDefault();setFrame(1e9);}
});

