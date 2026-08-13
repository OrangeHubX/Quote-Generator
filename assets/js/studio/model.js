/* model.js — The sequence: tracks, clips, defaults, undo.

   One editable object (`SEQ`) holds everything the renderer and the exporters
   read, so what plays back is what gets written out. Times are seconds
   throughout and only become frames at the edges (the ruler, the encoder),
   because a sequence outlives the frame rate it was pasted at. */

import {parsePaste} from './parse.js';

/* Top to bottom, the way an editor reads a sequence: notes, then the overlay
   stack with V1 nearest the plate, the plate, the read, then sound. */
export const TRACKS=[
  {id:"beat",label:"Beats",  kind:"note", h:20},
  {id:"v4",  label:"V4",     kind:"vis",  h:30},
  {id:"v3",  label:"V3",     kind:"vis",  h:30},
  {id:"v2",  label:"V2",     kind:"vis",  h:30},
  {id:"v1",  label:"V1",     kind:"vis",  h:30},
  {id:"bg",  label:"BG",     kind:"bg",   h:34},
  {id:"say", label:"Script", kind:"say",  h:26},
  {id:"a1",  label:"Voice",  kind:"aud",  h:32},
  {id:"a2",  label:"Music",  kind:"aud",  h:24}
];
export const VIS_TRACKS=["v1","v2","v3","v4"];
export const trackOf=id=>TRACKS.find(t=>t.id===id)||TRACKS[4];

/* Where an element sits before it is nudged. Values are the anchor point in
   fractions of the frame, plus how the element is aligned to it. */
export const SLOTS={
  full:   {x:.5, y:.5,  ax:"c", ay:"c", w:.92},
  center: {x:.5, y:.5,  ax:"c", ay:"c", w:.84},
  upper:  {x:.5, y:.30, ax:"c", ay:"c", w:.84},
  top:    {x:.5, y:.15, ax:"c", ay:"c", w:.84},
  lower:  {x:.5, y:.80, ax:"c", ay:"c", w:.88},
  bottom: {x:.5, y:.90, ax:"c", ay:"c", w:.88},
  left:   {x:.28,y:.45, ax:"c", ay:"c", w:.48},
  right:  {x:.72,y:.45, ax:"c", ay:"c", w:.48},
  "top-left":    {x:.24,y:.20,ax:"c",ay:"c",w:.44},
  "top-right":   {x:.76,y:.20,ax:"c",ay:"c",w:.44},
  "bottom-left": {x:.24,y:.74,ax:"c",ay:"c",w:.44},
  "bottom-right":{x:.76,y:.74,ax:"c",ay:"c",w:.44}
};
export const SLOT_KEYS=Object.keys(SLOTS);

/* In- and out-animations. `f` maps 0..1 progress to a transform; the renderer
   applies it around the element's own centre so nothing has to know its size. */
export const ANIM_IN=["rise","fall","pop","slam","fade","wipe","slide-l","slide-r","none"];
export const ANIM_OUT=["fade","drop","pop-out","wipe-out","slide-l","slide-r","none"];

const DEF_COMMON={slot:"center",x:0,y:0,scale:100,rot:0,opacity:100,
  anim:"rise",out:"fade",inDur:9,outDur:7,blur:true,dim:true};

export function defaultsFor(type){
  const c={...DEF_COMMON};
  switch(type){
    case "text":  return {...c,text:"",size:100,weight:800,align:"center",color:"",case:"none",box:false,hl:""};
    case "stamp": return {...c,text:"",size:120,color:"",rot:-7,anim:"slam",out:"pop-out",inDur:6,outDur:5};
    case "list":  return {...c,items:[],step:0.55,size:88,marker:"dot",align:"left",slot:"center",anim:"rise",color:""};
    case "lower": return {...c,text:"",sub:"",size:72,slot:"lower",anim:"slide-l",out:"slide-l",blur:false,dim:false,inDur:8,outDur:6};
    case "image": return {...c,src:"",label:"",frame:true,radius:28,fit:"contain",size:100,anim:"pop",slot:"center"};
    case "card":  return {...c,card:null,size:100,anim:"rise",slot:"center"};
    case "bg":    return {slot:"full",zoom:100,x:0,y:0,src:"",srcIn:0,speed:100,rot:0,mirror:false};
    case "audio": return {src:"",srcIn:0,gain:100,fadeIn:0,fadeOut:0};
    case "say":   return {text:""};
    case "beat":  return {text:""};
    default:      return c;
  }
}

let uid=1;
export const newId=()=>"c"+(uid++);

export const SEQ={
  title:"Untitled",
  fps:30, w:2160, h:3840,
  accent:"#FF5C3A",
  theme:"dark",
  blurAmt:26,        /* px at 1080-wide scale; scaled with the frame */
  dimAmt:34,         /* % darkening under an overlay */
  blurRamp:6,        /* frames the blur takes to come and go */
  captions:false,    /* burn the spoken lines in as captions */
  capStyle:"bold",
  safe:true,
  clips:[]
};

/* Runtime, never serialised. */
export const RT={
  time:0, playing:false, sel:null, zoom:46 /* px per second */, scroll:0,
  lastPaste:""
};

export function seqDur(){
  let end=0;
  for(const c of SEQ.clips)end=Math.max(end,c.t1);
  return Math.max(1,end);
}
export function clipsAt(t,kind){
  return SEQ.clips.filter(c=>{
    if(kind&&trackOf(c.track).kind!==kind)return false;
    return t>=c.t0-1e-6&&t<c.t1-1e-6;
  });
}
/* Painter order: BG first, then V1 upward, and ties broken by start time so a
   reorder inside one track is stable rather than dependent on insertion. */
export function visibleStack(t){
  const order=id=>VIS_TRACKS.indexOf(id);
  return SEQ.clips
    .filter(c=>trackOf(c.track).kind==="vis"&&t>=c.t0-1e-6&&t<c.t1-1e-6)
    .sort((a,b)=>order(a.track)-order(b.track)||a.t0-b.t0);
}
export function findClip(id){return SEQ.clips.find(c=>c.id===id)||null;}
export function audioClips(){return SEQ.clips.filter(c=>c.type==="audio");}
/* Sequence time → time inside the clip's own media. Retiming a clip therefore
   slides its source with it, which is what dragging a clip in Premiere does. */
export function srcTime(clip,t){
  const speed=(clip.props.speed==null?100:clip.props.speed)/100;
  return (clip.props.srcIn||0)+(t-clip.t0)*speed;
}
export function addClip(type,track,t0,t1,props){
  const c={id:newId(),type,track,t0,t1,props:{...defaultsFor(type),...(props||{})}};
  SEQ.clips.push(c);return c;
}
export function removeClip(id){
  const i=SEQ.clips.findIndex(c=>c.id===id);
  if(i>=0)SEQ.clips.splice(i,1);
}
/* Razor at the playhead. The reason this exists is the plate: one gameplay
   take usually needs different framing at different moments ("this bit is
   better zoomed in on the car"), and splitting is how you give each stretch its
   own zoom and pan. The second half keeps playing the same source from the same
   point, so a split changes framing without changing what is on screen. */
export function splitClip(id,t){
  const c=findClip(id);
  if(!c)return null;
  const min=1/((SEQ.fps||30)*2);
  if(t<=c.t0+min||t>=c.t1-min)return null;
  const b={id:newId(),type:c.type,track:c.track,t0:t,t1:c.t1,
    props:JSON.parse(JSON.stringify(c.props))};
  if(b.props.srcIn!=null)b.props.srcIn=srcTime(c,t);
  /* The tail starts mid-move: replaying the entrance would flash. */
  if(b.props.anim)b.props.anim="none";
  if(c.props.out)c.props.out="none";
  c.t1=t;
  SEQ.clips.push(b);
  return b;
}
export function duplicateClip(id){
  const c=findClip(id);
  if(!c)return null;
  const len=c.t1-c.t0;
  const t0=c.t1;
  const b={id:newId(),type:c.type,
    track:trackOf(c.track).kind==="vis"?freeVisTrack(t0,t0+len):c.track,
    t0,t1:t0+len,props:JSON.parse(JSON.stringify(c.props))};
  SEQ.clips.push(b);
  return b;
}

/* Lowest overlay row this span fits on, so an import stacks the way a human
   would rather than piling everything on V1. */
export function freeVisTrack(t0,t1,ignoreId){
  for(const id of VIS_TRACKS){
    const clash=SEQ.clips.some(c=>c.track===id&&c.id!==ignoreId&&t0<c.t1-1e-4&&t1>c.t0+1e-4);
    if(!clash)return id;
  }
  return VIS_TRACKS[VIS_TRACKS.length-1];
}

/* ---------- import ---------- */
/* Turns a parsed paste into clips. Media names are kept as written; the media
   pool resolves them once real files are loaded, so a shotlist can be pasted
   before the assets exist. */
export function importPaste(text,mediaHints){
  const p=parsePaste(text);
  if(!p)return null;
  SEQ.clips.length=0;
  SEQ.title=p.meta.title||SEQ.title;
  SEQ.fps=p.meta.fps||30;
  SEQ.w=p.meta.w;SEQ.h=p.meta.h;
  if(p.meta.accent)SEQ.accent=p.meta.accent;
  SEQ.theme=p.meta.theme||"dark";
  SEQ.captions=!!p.meta.captions;
  Object.assign(mediaHints||{},p.meta.media||{});

  let cursor=0;
  const withTime=it=>{
    if(it.t0==null){const d=it.type==="say"?2.4:3;const t0=cursor;cursor+=d;return {t0,t1:t0+d};}
    cursor=Math.max(cursor,it.t1);
    return {t0:it.t0,t1:Math.max(it.t0+0.15,it.t1)};
  };
  for(const it of p.items){
    const {t0,t1}=withTime(it);
    const o=it.opts||{};
    const props=propsFromOpts(it.type,it.text,o,mediaHints||{});
    const track=it.type==="say"?"say":it.type==="beat"?"beat":it.type==="bg"?"bg"
      :freeVisTrack(t0,t1);
    addClip(it.type,track,t0,t1,props);
  }
  /* A background for the whole read, so there is something to reposition even
     before a file is picked. */
  const end=seqDur();
  if(!SEQ.clips.some(c=>c.track==="bg"))
    addClip("bg","bg",0,end,{src:(mediaHints&&(mediaHints.gameplay||mediaHints.bg))||""});
  return {...p,end};
}
const NUM=(v,d)=>{const n=parseFloat(v);return isFinite(n)?n:d;};
/* `MEDIA ig=rockstar-instagram.png` then `IMAGE … src=ig` is the whole point of
   declaring the media up front, so the alias has to actually resolve — without
   this the clip went looking for a file literally called "ig" and only found
   the right one by accident, when the substring happened to appear inside a
   longer name. An alias with no entry stays as written; it is still a fine
   thing to match a dropped file against. */
const viaAlias=(v,hints)=>{
  const k=String(v||"").trim().toLowerCase();
  return (k&&hints[k])?hints[k]:v;
};
function propsFromOpts(type,text,o,hints){
  hints=hints||{};
  const p=defaultsFor(type);
  if(text)p.text=text;
  if(type==="list"){
    const src=o.items||text||"";
    p.items=src.split(/\s*[;,]\s*/).map(s=>s.trim()).filter(Boolean);
    p.text="";
    if(o.step!=null)p.step=NUM(o.step,p.step);
  }
  if(o.slot&&SLOTS[String(o.slot).toLowerCase()])p.slot=String(o.slot).toLowerCase();
  if(o.pos&&SLOTS[String(o.pos).toLowerCase()])p.slot=String(o.pos).toLowerCase();
  if(o.x!=null)p.x=NUM(o.x,0);
  if(o.y!=null)p.y=NUM(o.y,0);
  if(o.scale!=null)p.scale=NUM(o.scale,100);
  if(o.size!=null)p.size=NUM(o.size,p.size);
  if(o.rot!=null)p.rot=NUM(o.rot,p.rot||0);
  if(o.anim)p.anim=String(o.anim).toLowerCase();
  if(o.out)p.out=String(o.out).toLowerCase();
  if(o.color)p.color=o.color;
  if(o.src)p.src=viaAlias(String(o.src).toLowerCase(),hints);
  if(o.label)p.label=o.label;
  if(o.sub)p.sub=o.sub;
  if(o.hl)p.hl=o.hl;
  if(o.blur!=null)p.blur=!/^(0|off|no|false)$/i.test(o.blur);
  if(o.dim!=null)p.dim=!/^(0|off|no|false)$/i.test(o.dim);
  if(o.frame!=null)p.frame=!/^(0|off|no|false)$/i.test(o.frame);
  if(o.design)p.card={design:o.design,name:o.name||"",handle:o.handle||"",text:text||o.quote||"",
                      theme:o.theme||"dark",outlet:o.outlet||"",
                      avatar:o.avatar?viaAlias(String(o.avatar).toLowerCase(),hints):""};
  if(type==="card"&&!p.card)p.card={design:"quote",text:text||"",theme:"dark",outlet:o.outlet||""};
  return p;
}

/* ---------- cue check ----------
   A visual exists to show the viewer what is being said *while* it is being
   said. Arriving after the words have finished is the single easiest mistake to
   make when times are written by hand, and the hardest to notice while editing,
   because scrubbing to a clip always shows it looking fine on its own.

   So the sequence checks itself: for every visual, find the first spoken line
   that names it, and say so when the picture turns up after that line is over.
   Matching is deliberately loose at the stem — "@rockstargames" should match
   "Rockstar" — and deliberately blind to short words, which match everything
   and mean nothing. These are notes, not errors: a late reveal can be the
   point. */
const STOP={about:1,after:1,again:1,their:1,there:1,these:1,those:1,which:1,
  while:1,would:1,could:1,should:1,because:1,really:1,thing:1,things:1,
  going:1,never:1,every:1,other:1,another:1,still:1,right:1,being:1};
function tokens(s){
  return String(s||"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").split(/\s+/)
    .filter(w=>w.length>=5&&!STOP[w]);
}
function subjectOf(c){
  const p=c.props;
  if(c.type==="image")return p.label||p.src||"";
  if(c.type==="list")return (p.items||[]).join(" ");
  if(c.type==="card")return (p.card&&(p.card.text||p.card.name))||"";
  if(c.type==="lower")return "";        /* a standing credit names nothing */
  return p.text||"";
}
function mentions(says,subject){
  const toks=tokens(subject);
  if(!toks.length)return [];
  return says.filter(s=>{
    const words=tokens(s.props.text);
    return toks.some(t=>words.some(w=>w===t||w.startsWith(t)||t.startsWith(w)));
  });
}
/* Seconds between a clip and a line, zero if they overlap at all. */
function gapTo(c,s){
  if(c.t0>=s.t1)return c.t0-s.t1;
  if(c.t1<=s.t0)return s.t0-c.t1;
  return 0;
}
const at=t=>{const m=Math.floor(t/60),x=t-m*60;return m+":"+(x<10?"0":"")+x.toFixed(1);};
export function cueNotes(){
  const notes=[];
  const says=SEQ.clips.filter(c=>c.type==="say"&&c.props.text).sort((a,b)=>a.t0-b.t0);
  const vis=SEQ.clips.filter(c=>trackOf(c.track).kind==="vis").sort((a,b)=>a.t0-b.t0);

  for(const c of vis){
    const len=c.t1-c.t0;
    /* The test is overlap, not order. A word can appear in passing long before
       the line that actually cues the picture — "six streamers" at 0:04 is not
       what puts NOT JUST STREAMERS on screen at 0:13, "not just streamers" at
       0:14 is. So a visual is on cue if it is up while *any* line names it, and
       only the ones that never coincide with their own subject get flagged. */
    const said=mentions(says,subjectOf(c));
    if(said.length){
      let near=said[0],gap=gapTo(c,near);
      for(const s of said){const g=gapTo(c,s);if(g<gap){gap=g;near=s;}}
      if(gap>0.05)
        notes.push({id:c.id,t:Math.max(0,near.t0-0.3),
          msg:c.type+" is never on screen while it is being talked about — the "+
              "nearest line naming it is "+gap.toFixed(1)+"s away, at "+at(near.t0)});
    }
    if(len<0.8)
      notes.push({id:c.id,t:c.t0,
        msg:c.type+" is only "+len.toFixed(1)+"s long — too quick to read"});
    if(c.type==="list"){
      const need=(c.props.items||[]).length*(c.props.step||0.55);
      if(need>len+0.05)
        notes.push({id:c.id,t:c.t0,
          msg:"the last names never appear — the build takes "+need.toFixed(1)+
              "s but the clip is "+len.toFixed(1)+"s"});
    }
  }
  /* Holes in the read. A short breath is deliberate; five seconds is a mistake
     nobody sees until the voiceover is laid against it. */
  for(let i=1;i<says.length;i++){
    const gap=says[i].t0-says[i-1].t1;
    if(gap>1.2)notes.push({id:null,t:says[i-1].t1,
      msg:gap.toFixed(1)+"s of no voice at "+at(says[i-1].t1)});
  }
  return notes;
}

/* ---------- persistence + undo ---------- */
export function snapshot(){
  return JSON.stringify({
    title:SEQ.title,fps:SEQ.fps,w:SEQ.w,h:SEQ.h,accent:SEQ.accent,theme:SEQ.theme,
    blurAmt:SEQ.blurAmt,dimAmt:SEQ.dimAmt,blurRamp:SEQ.blurRamp,captions:SEQ.captions,
    capStyle:SEQ.capStyle,safe:SEQ.safe,clips:SEQ.clips
  });
}
export function restore(json){
  let o;try{o=JSON.parse(json);}catch(_){return false;}
  Object.assign(SEQ,{title:o.title,fps:o.fps,w:o.w,h:o.h,accent:o.accent,theme:o.theme,
    blurAmt:o.blurAmt,dimAmt:o.dimAmt,blurRamp:o.blurRamp,captions:o.captions,
    capStyle:o.capStyle,safe:o.safe});
  SEQ.clips.length=0;
  for(const c of o.clips||[])SEQ.clips.push(c);
  for(const c of SEQ.clips){const n=+String(c.id).replace(/\D/g,"");if(n>=uid)uid=n+1;}
  return true;
}
/* Snapshot after activity settles rather than at every mutation site: nothing
   can be forgotten, and a slider drag coalesces into one step for free. */
const UNDO=[],REDO=[];let pending=null,base=null;
export function markDirty(){
  if(base==null)base=snapshot();
  clearTimeout(pending);
  pending=setTimeout(()=>{
    const now=snapshot();
    if(now!==base){UNDO.push(base);if(UNDO.length>60)UNDO.shift();REDO.length=0;}
    base=null;
  },420);
}
export function undo(){
  if(!UNDO.length)return false;
  clearTimeout(pending);
  const cur=snapshot();
  const prev=UNDO.pop();
  REDO.push(cur);restore(prev);base=null;return true;
}
export function redo(){
  if(!REDO.length)return false;
  clearTimeout(pending);
  const cur=snapshot();
  const next=REDO.pop();
  UNDO.push(cur);restore(next);base=null;return true;
}
