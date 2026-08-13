/* inspector.js — Controls for whatever is selected.

   Built from a table rather than markup: every clip type shares placement,
   motion and contrast, and only differs in its content fields, so describing
   the differences is far less code than writing ten near-identical panels —
   and a control added to the shared list cannot go missing from one type. */

import {ANIM_IN, ANIM_OUT, RT, SEQ, SLOT_KEYS, cueNotes, duplicateClip, findClip,
        markDirty, removeClip, splitClip} from './model.js';
import {list} from './media.js';

let host=null,onEdit=()=>{};
export function initInspector(el,cb){host=el;onEdit=cb||(()=>{});}

const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;
  if(txt!=null)n.textContent=txt;return n;};
function row(label,node,hint){
  const r=el("div","irow");
  const l=el("label","ilab",label);
  r.appendChild(l);r.appendChild(node);
  if(hint)r.appendChild(el("span","ihint",hint));
  return r;
}
function commit(){markDirty();onEdit();}

function fText(get,set,ph,area){
  const n=el(area?"textarea":"input","ifield");
  if(!area)n.type="text";
  if(area)n.rows=area;
  n.placeholder=ph||"";
  n.value=get()==null?"":get();
  n.addEventListener("input",()=>{set(n.value);commit();});
  return n;
}
function fNum(get,set,o){
  o=o||{};
  const n=el("input","ifield num");
  n.type="number";
  if(o.min!=null)n.min=o.min;if(o.max!=null)n.max=o.max;
  n.step=o.step||1;n.value=get();
  n.addEventListener("input",()=>{
    const v=parseFloat(n.value);
    if(isFinite(v)){set(v);commit();}
  });
  return n;
}
function fRange(get,set,o){
  const wrap=el("div","irange");
  const r=el("input");r.type="range";
  r.min=o.min;r.max=o.max;r.step=o.step||1;r.value=get();
  const out=el("b","ival",String(get())+(o.unit||""));
  r.addEventListener("input",()=>{set(+r.value);out.textContent=r.value+(o.unit||"");onEdit();});
  r.addEventListener("change",commit);
  wrap.appendChild(r);wrap.appendChild(out);
  return wrap;
}
function fSel(get,set,opts){
  const n=el("select","ifield");
  for(const o of opts){
    const v=Array.isArray(o)?o[0]:o,t=Array.isArray(o)?o[1]:o;
    const op=el("option",null,t);op.value=v;n.appendChild(op);
  }
  n.value=get();
  n.addEventListener("change",()=>{set(n.value);commit();});
  return n;
}
function fTog(get,set,label){
  const b=el("button","itog",label||"");
  const sync=()=>b.setAttribute("aria-pressed",get()?"true":"false");
  sync();
  b.addEventListener("click",()=>{set(!get());sync();commit();});
  return b;
}
function fColor(get,set,fallback){
  const wrap=el("div","icolor");
  const n=el("input");n.type="color";n.value=get()||fallback||"#FF5C3A";
  const clear=el("button","ilink","auto");
  n.addEventListener("input",()=>{set(n.value);commit();});
  clear.addEventListener("click",()=>{set("");commit();});
  wrap.appendChild(n);wrap.appendChild(clear);
  return wrap;
}
/* Media fields accept a name that has no file yet — a shotlist is normally
   pasted before the assets are dropped in. */
function fMedia(get,set,kind){
  const wrap=el("div","imedia");
  const n=el("input","ifield");n.type="text";n.value=get()||"";
  n.placeholder=kind==="video"?"gameplay clip":kind==="audio"?"voiceover file":"image name";
  n.setAttribute("list","mediaList-"+kind);
  let dl=document.getElementById("mediaList-"+kind);
  if(!dl){dl=el("datalist");dl.id="mediaList-"+kind;document.body.appendChild(dl);}
  dl.innerHTML="";
  for(const m of list(kind)){const o=el("option");o.value=m.key;o.label=m.name;dl.appendChild(o);}
  n.addEventListener("input",()=>{set(n.value);commit();});
  wrap.appendChild(n);
  return wrap;
}
function fItems(get,set){
  const n=el("textarea","ifield");
  n.rows=4;n.placeholder="One name per line";
  n.value=(get()||[]).join("\n");
  n.addEventListener("input",()=>{
    set(n.value.split("\n").map(s=>s.trim()).filter(Boolean));commit();
  });
  return n;
}
function group(title){
  const g=el("div","igroup");
  g.appendChild(el("div","ihead",title));
  return g;
}

/* ---------- per-type content ---------- */
function contentFor(clip,g){
  const p=clip.props,P=(k,v)=>{p[k]=v;};
  switch(clip.type){
    case "text":
      g.appendChild(row("Text",fText(()=>p.text,v=>P("text",v),"What goes on screen",3)));
      g.appendChild(row("Accent word",fText(()=>p.hl,v=>P("hl",v),"a word inside the line to colour")));
      g.appendChild(row("Size",fRange(()=>p.size,v=>P("size",v),{min:40,max:220,unit:"%"})));
      g.appendChild(row("Weight",fSel(()=>String(p.weight||800),v=>P("weight",+v),
        [["400","Regular"],["600","Medium"],["800","Bold"],["900","Black"]])));
      g.appendChild(row("Case",fSel(()=>p.case||"none",v=>P("case",v),
        [["none","As typed"],["upper","UPPERCASE"],["title","Title Case"]])));
      g.appendChild(row("Plate",fTog(()=>p.box,v=>P("box",v),"Dark box behind the text")));
      break;
    case "stamp":
      g.appendChild(row("Word",fText(()=>p.text,v=>P("text",v),"REPORTEDLY")));
      g.appendChild(row("Size",fRange(()=>p.size,v=>P("size",v),{min:50,max:260,unit:"%"})));
      g.appendChild(row("Tilt",fRange(()=>p.rot,v=>P("rot",v),{min:-20,max:20,unit:"°"})));
      break;
    case "list":
      g.appendChild(row("Items",fItems(()=>p.items,v=>P("items",v))));
      g.appendChild(row("One every",fNum(()=>p.step,v=>P("step",v),{min:0,max:5,step:0.05})," s"));
      g.appendChild(row("Marker",fSel(()=>p.marker,v=>P("marker",v),
        [["dot","Dot"],["number","Number"],["none","None"]])));
      g.appendChild(row("Size",fRange(()=>p.size,v=>P("size",v),{min:40,max:200,unit:"%"})));
      break;
    case "lower":
      g.appendChild(row("Line",fText(()=>p.text,v=>P("text",v),"GTA BOOM · Notebookcheck")));
      g.appendChild(row("Second line",fText(()=>p.sub,v=>P("sub",v),"optional")));
      g.appendChild(row("Size",fRange(()=>p.size,v=>P("size",v),{min:40,max:180,unit:"%"})));
      break;
    case "image":
      g.appendChild(row("File",fMedia(()=>p.src,v=>P("src",v),"image")));
      g.appendChild(row("Caption",fText(()=>p.label,v=>P("label",v),"Erling Haaland")));
      g.appendChild(row("Width",fRange(()=>p.size,v=>P("size",v),{min:20,max:200,unit:"%"})));
      g.appendChild(row("Fit",fSel(()=>p.fit,v=>P("fit",v),[["contain","Whole image"],["cover","Fill the box"]])));
      g.appendChild(row("Frame",fTog(()=>p.frame,v=>P("frame",v),"Border and shadow")));
      g.appendChild(row("Corner",fRange(()=>p.radius,v=>P("radius",v),{min:0,max:90,unit:"px"})));
      break;
    case "card":{
      const cd=p.card||(p.card={design:"quote",text:"",theme:"dark"});
      const C=(k,v)=>{cd[k]=v;};
      g.appendChild(row("Type",fSel(()=>cd.design,v=>C("design",v),
        [["quote","Quote card"],["x-post","X post"],["x-reply","X reply"],
         ["reddit-post","Reddit post"],["reddit-comment","Reddit comment"],
         ["yt-comment","YouTube comment"],["ig-post","Instagram post"],
         ["ig-comment","Instagram comment"],["fb-post","Facebook post"],
         ["twitch-comment","Twitch chat"]])));
      g.appendChild(row("Text",fText(()=>cd.text,v=>C("text",v),"What the card says",3)));
      g.appendChild(row("Highlight",fText(()=>cd.hlWord,v=>C("hlWord",v),"a word to mark")));
      g.appendChild(row("Name",fText(()=>cd.name,v=>C("name",v),"Display name")));
      g.appendChild(row("Handle",fText(()=>cd.handle,v=>C("handle",v),"username")));
      g.appendChild(row("Outlet",fText(()=>cd.outlet,v=>C("outlet",v),"for quote cards")));
      g.appendChild(row("Look",fSel(()=>cd.theme||"dark",v=>C("theme",v),
        [["dark","Dark"],["light","Light"],["paper","Paper"]])));
      g.appendChild(row("Avatar",fMedia(()=>cd.avatar,v=>C("avatar",v),"image")));
      g.appendChild(row("Width",fRange(()=>p.size,v=>P("size",v),{min:30,max:160,unit:"%"})));
      break;
    }
    case "bg":
      g.appendChild(row("Clip",fMedia(()=>p.src,v=>P("src",v),"video")));
      g.appendChild(row("Zoom",fRange(()=>p.zoom,v=>P("zoom",v),{min:100,max:320,unit:"%"})));
      g.appendChild(row("Move ←→",fRange(()=>p.x,v=>P("x",v),{min:-100,max:100,unit:"%"})));
      g.appendChild(row("Move ↑↓",fRange(()=>p.y,v=>P("y",v),{min:-100,max:100,unit:"%"})));
      g.appendChild(row("Start at",fNum(()=>p.srcIn,v=>P("srcIn",v),{min:0,step:0.1})," s into the file"));
      g.appendChild(row("Mirror",fTog(()=>p.mirror,v=>P("mirror",v),"Flip horizontally")));
      break;
    case "audio":
      g.appendChild(row("File",fMedia(()=>p.src,v=>P("src",v),"audio")));
      g.appendChild(row("Level",fRange(()=>p.gain,v=>P("gain",v),{min:0,max:200,unit:"%"})));
      g.appendChild(row("Start at",fNum(()=>p.srcIn,v=>P("srcIn",v),{min:0,step:0.05})," s into the file"));
      g.appendChild(row("Fade in",fNum(()=>p.fadeIn,v=>P("fadeIn",v),{min:0,step:0.1})," s"));
      g.appendChild(row("Fade out",fNum(()=>p.fadeOut,v=>P("fadeOut",v),{min:0,step:0.1})," s"));
      break;
    case "say":
      g.appendChild(row("Line",fText(()=>p.text,v=>P("text",v),"the spoken line",3)));
      break;
    case "beat":
      g.appendChild(row("Note",fText(()=>p.text,v=>P("text",v),"what happens here",3)));
      break;
  }
}

/* Split, duplicate and delete used to live only on the keyboard, which put them
   out of reach of the device this tool is most likely to be used on. They are
   the same three operations either way — the shortcuts still work. */
function clipActions(clip){
  const row=el("div","iacts");
  const inside=RT.time>clip.t0+1e-3&&RT.time<clip.t1-1e-3;
  const split=el("button","btn sm","Split");
  split.title=inside?"Cut this clip at the playhead (S)"
    :"Move the playhead inside this clip to split it";
  split.disabled=!inside;
  split.addEventListener("click",()=>{
    const b=splitClip(clip.id,RT.time);
    if(!b)return;
    RT.sel=b.id;markDirty();renderInspector();onEdit();
  });
  const dup=el("button","btn sm","Duplicate");
  dup.title="Copy it to just after itself (⌘D)";
  dup.addEventListener("click",()=>{
    const b=duplicateClip(clip.id);
    if(!b)return;
    RT.sel=b.id;markDirty();renderInspector();onEdit();
  });
  const del=el("button","btn sm danger","Delete");
  del.title="Remove this clip (Delete)";
  del.addEventListener("click",()=>{
    removeClip(clip.id);RT.sel=null;markDirty();renderInspector();onEdit();
  });
  row.appendChild(split);row.appendChild(dup);row.appendChild(del);
  return row;
}

const VISUAL={text:1,stamp:1,list:1,lower:1,image:1,card:1};

export function renderInspector(){
  if(!host)return;
  host.innerHTML="";
  const clip=RT.sel?findClip(RT.sel):null;
  if(!clip){host.appendChild(sequencePanel());return;}
  const p=clip.props,P=(k,v)=>{p[k]=v;};

  const head=el("div","isel");
  head.appendChild(el("span","ipill "+clip.type,clip.type));
  head.appendChild(el("span","idur",fmt(clip.t0)+" → "+fmt(clip.t1)+
    "  ·  "+Math.round((clip.t1-clip.t0)*(SEQ.fps||30))+"f"));
  host.appendChild(head);
  host.appendChild(clipActions(clip));

  const gc=group("Content");contentFor(clip,gc);host.appendChild(gc);

  const gt=group("Timing");
  gt.appendChild(row("Start",fNum(()=>round2(clip.t0),v=>{
    const len=clip.t1-clip.t0;clip.t0=Math.max(0,v);clip.t1=clip.t0+len;},{min:0,step:0.05})," s"));
  gt.appendChild(row("Length",fNum(()=>round2(clip.t1-clip.t0),v=>{
    clip.t1=clip.t0+Math.max(1/(SEQ.fps||30),v);},{min:0.03,step:0.05})," s"));
  host.appendChild(gt);

  if(VISUAL[clip.type]){
    const gp=group("Placement");
    gp.appendChild(row("Anchor",fSel(()=>p.slot,v=>P("slot",v),SLOT_KEYS.map(k=>[k,cap(k)]))));
    gp.appendChild(row("Nudge ←→",fRange(()=>p.x,v=>P("x",v),{min:-50,max:50,step:0.5,unit:"%"})));
    gp.appendChild(row("Nudge ↑↓",fRange(()=>p.y,v=>P("y",v),{min:-50,max:50,step:0.5,unit:"%"})));
    gp.appendChild(row("Scale",fRange(()=>p.scale,v=>P("scale",v),{min:10,max:300,unit:"%"})));
    gp.appendChild(row("Rotate",fRange(()=>p.rot,v=>P("rot",v),{min:-30,max:30,unit:"°"})));
    gp.appendChild(row("Opacity",fRange(()=>p.opacity,v=>P("opacity",v),{min:0,max:100,unit:"%"})));
    gp.appendChild(row("Colour",fColor(()=>p.color,v=>P("color",v),SEQ.accent)));
    host.appendChild(gp);

    const gm=group("Motion");
    gm.appendChild(row("In",fSel(()=>p.anim,v=>P("anim",v),ANIM_IN.map(a=>[a,cap(a)]))));
    gm.appendChild(row("In over",fNum(()=>p.inDur,v=>P("inDur",v),{min:0,max:120})," frames"));
    gm.appendChild(row("Out",fSel(()=>p.out,v=>P("out",v),ANIM_OUT.map(a=>[a,cap(a)]))));
    gm.appendChild(row("Out over",fNum(()=>p.outDur,v=>P("outDur",v),{min:0,max:120})," frames"));
    host.appendChild(gm);

    const gb=group("Background while up");
    gb.appendChild(row("Blur",fTog(()=>p.blur,v=>P("blur",v),"Blur the gameplay")));
    gb.appendChild(row("Darken",fTog(()=>p.dim,v=>P("dim",v),"Dim the gameplay")));
    host.appendChild(gb);
  }
}

function sequencePanel(){
  const wrap=el("div");
  const g=group("Sequence");
  g.appendChild(row("Title",fText(()=>SEQ.title,v=>{SEQ.title=v;},"Used for the file name")));
  g.appendChild(row("Frame",fSel(()=>SEQ.w+"x"+SEQ.h,v=>{
    const [w,h]=v.split("x").map(Number);SEQ.w=w;SEQ.h=h;},
    [["2160x3840","2160 × 3840 · 4K vertical"],["1080x1920","1080 × 1920 · HD vertical"],
     ["3840x2160","3840 × 2160 · 4K wide"],["1920x1080","1920 × 1080 · HD wide"],
     ["2160x2160","2160 × 2160 · square"]])));
  g.appendChild(row("Frame rate",fSel(()=>String(SEQ.fps),v=>{SEQ.fps=+v;},
    [["24","24"],["25","25"],["30","30"],["50","50"],["60","60"]])));
  g.appendChild(row("Accent",fColor(()=>SEQ.accent,v=>{SEQ.accent=v||"#FF5C3A";},"#FF5C3A")));
  wrap.appendChild(g);

  const c2=group("Contrast under overlays");
  c2.appendChild(row("Blur",fRange(()=>SEQ.blurAmt,v=>{SEQ.blurAmt=v;},{min:0,max:80,unit:"px"})));
  c2.appendChild(row("Darken",fRange(()=>SEQ.dimAmt,v=>{SEQ.dimAmt=v;},{min:0,max:85,unit:"%"})));
  c2.appendChild(row("Ramp",fRange(()=>SEQ.blurRamp,v=>{SEQ.blurRamp=v;},{min:0,max:30,unit:"f"})));
  wrap.appendChild(c2);

  const c3=group("Overlay");
  c3.appendChild(row("Captions",fTog(()=>SEQ.captions,v=>{SEQ.captions=v;},"Burn in the script lines")));
  c3.appendChild(row("Caption look",fSel(()=>SEQ.capStyle,v=>{SEQ.capStyle=v;},
    [["bold","Bold"],["upper","UPPERCASE"],["small","Small"]])));
  c3.appendChild(row("Safe zones",fTog(()=>SEQ.safe,v=>{SEQ.safe=v;},"Preview only, never exported")));
  wrap.appendChild(c3);

  const notes=cueNotes();
  if(notes.length){
    const g4=group("Worth a look");
    for(const n of notes){
      const b=el("button","cue",n.msg);
      b.addEventListener("click",()=>{
        RT.time=n.t;
        if(n.id)RT.sel=n.id;
        renderInspector();onEdit();
      });
      g4.appendChild(b);
    }
    g4.appendChild(el("p","ptext",
      "Suggestions, not errors — a late reveal can be the point. Tap one to jump there."));
    wrap.appendChild(g4);
  }

  const note=el("div","inote",
    "Nothing selected. Click a clip to edit it, or drag one on the timeline to retime it.");
  wrap.appendChild(note);
  return wrap;
}
const cap=s=>String(s).replace(/-/g," ").replace(/^\w/,m=>m.toUpperCase());
const round2=v=>Math.round(v*100)/100;
const fmt=t=>{const m=Math.floor(t/60),s=t-m*60;return m+":"+(s<10?"0":"")+s.toFixed(2);};
