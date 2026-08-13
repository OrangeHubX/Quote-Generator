/* timeline.js — The Premiere-shaped part: tracks, clips, trimming, scrubbing.

   One canvas draws the whole thing. A DOM node per clip would be easier to
   style and worse at everything else — a 40-clip sequence redraws on every
   pointer move while dragging, and canvas makes that one paint instead of
   forty layout invalidations.

   Snapping is the feature that makes retiming feel like an editor rather than
   a form: edges pull to the playhead, to other clips' edges and to whole
   seconds, all within the same pixel threshold, and Shift turns it off. */

import {RT, SEQ, TRACKS, markDirty, removeClip, seqDur} from './model.js';
import {get} from './media.js';

const GUT=70, RULER=24, GAP=3;
/* Canvas font strings are not CSS: `var(--ui)` never resolves and the
   context silently keeps whatever font it had. Spell the stacks out. */
const UI=(w,s)=>w+" "+s+'px -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,system-ui,sans-serif';
const MONO=(w,s)=>w+" "+s+'px ui-monospace,"SF Mono",Menlo,Consolas,monospace';
const COLORS={
  bg:   ["#2B3550","#4E6396"],
  text: ["#2E2C55","#7D93FF"],
  stamp:["#4A2A28","#FF8E7E"],
  list: ["#1F3F42","#4FD0C0"],
  lower:["#3A2A48","#B98CFF"],
  image:["#243C2C","#6FD69A"],
  card: ["#452A3A","#FF8ABF"],
  say:  ["#232733","#8FA0BF"],
  audio:["#1E3A2E","#6FD69A"],
  beat: ["#1B1D24","#5C6478"]
};
const ALLOWED={
  text:["v1","v2","v3","v4"],stamp:["v1","v2","v3","v4"],list:["v1","v2","v3","v4"],
  lower:["v1","v2","v3","v4"],image:["v1","v2","v3","v4"],card:["v1","v2","v3","v4"],
  bg:["bg"],say:["say"],audio:["a1","a2"],beat:["beat"]
};

let cv=null,c=null,hooks={},HIT=[],drag=null,hover=null;

export function initTimeline(canvas,h){
  cv=canvas;c=cv.getContext("2d");hooks=h||{};
  cv.addEventListener("pointerdown",onDown);
  cv.addEventListener("pointermove",onMove);
  window.addEventListener("pointerup",onUp);
  cv.addEventListener("pointerleave",()=>{hover=null;drawTL();});
  cv.addEventListener("wheel",onWheel,{passive:false});
  cv.addEventListener("dblclick",onDbl);
  new ResizeObserver(()=>drawTL()).observe(cv.parentElement||cv);
}

/* ---------- geometry ---------- */
export const tToX=t=>GUT+(t-RT.scroll)*RT.zoom;
export const xToT=x=>(x-GUT)/RT.zoom+RT.scroll;
function rows(){
  const out=[];let y=RULER+GAP;
  for(const t of TRACKS){out.push({...t,y,bot:y+t.h});y+=t.h+GAP;}
  return out;
}
export function tlHeight(){
  return RULER+GAP+TRACKS.reduce((a,t)=>a+t.h+GAP,0)+4;
}
function rowAt(y){
  for(const r of rows())if(y>=r.y-GAP/2&&y<=r.bot+GAP/2)return r;
  return null;
}

/* ---------- draw ---------- */
export function drawTL(){
  if(!cv)return;
  const box=cv.getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(200,Math.round(box.width)),h=Math.round(tlHeight());
  if(cv.style.height!==h+"px")cv.style.height=h+"px";
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){
    cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
  }
  c.setTransform(dpr,0,0,dpr,0,0);
  c.clearRect(0,0,w,h);
  c.fillStyle="#0E1016";c.fillRect(0,0,w,h);

  const dur=seqDur();
  const R=rows();
  HIT=[];

  /* track lanes + gutter */
  for(const r of R){
    c.fillStyle=r.kind==="note"?"#0F1117":"#141721";
    c.fillRect(GUT,r.y,w-GUT,r.h);
    c.fillStyle="#0B0C11";c.fillRect(0,r.y,GUT-1,r.h);
    c.fillStyle=r.kind==="vis"?"#98A0B2":r.kind==="bg"?"#7D93FF":r.kind==="aud"?"#6FD69A":"#6B7183";
    c.font=MONO(600,10.5);
    c.textAlign="left";c.textBaseline="middle";
    c.fillText(r.label,8,r.y+r.h/2);
  }
  /* past the end of the sequence */
  const endX=tToX(dur);
  if(endX<w){c.fillStyle="rgba(0,0,0,.42)";c.fillRect(Math.max(GUT,endX),RULER,w-Math.max(GUT,endX),h-RULER);}

  drawRuler(w,dur);

  for(const clip of SEQ.clips){
    const r=R.find(x=>x.id===clip.track);
    if(!r)continue;
    const x0=tToX(clip.t0),x1=tToX(clip.t1);
    if(x1<GUT-4||x0>w+4)continue;
    const cx=Math.max(GUT,x0),cw=Math.max(2,Math.min(w,x1)-cx);
    HIT.push({clip,x0,x1,y:r.y,h:r.h});
    drawClip(clip,cx,r.y,cw,r.h,x0,x1);
  }

  /* playhead */
  const px=tToX(RT.time);
  if(px>=GUT-1){
    c.strokeStyle="#FF5C3A";c.lineWidth=1.5;
    c.beginPath();c.moveTo(px+.5,RULER-6);c.lineTo(px+.5,h);c.stroke();
    c.fillStyle="#FF5C3A";
    c.beginPath();c.moveTo(px-5,RULER-12);c.lineTo(px+5,RULER-12);c.lineTo(px,RULER-3);c.closePath();c.fill();
  }
  c.fillStyle="#0B0C11";c.fillRect(0,0,GUT-1,RULER);
  c.strokeStyle="#262A33";c.lineWidth=1;
  c.beginPath();c.moveTo(GUT-.5,0);c.lineTo(GUT-.5,h);c.stroke();
}

/* Tick spacing that always lands on a round number: seconds while there is
   room, then 2s, 5s, 10s … A ruler that labels 0.37s is unreadable. */
const STEPS=[1/30,1/10,0.25,0.5,1,2,5,10,15,30,60,120,300];
function drawRuler(w,dur){
  const h=RULER;
  c.fillStyle="#101219";c.fillRect(0,0,w,h);
  let step=STEPS[STEPS.length-1];
  for(const s of STEPS)if(s*RT.zoom>=54){step=s;break;}
  const t0=Math.floor(RT.scroll/step)*step;
  c.font=MONO(500,9.5);
  c.textBaseline="alphabetic";c.textAlign="left";
  for(let t=t0;;t+=step){
    const x=tToX(t);
    if(x>w)break;
    if(x<GUT)continue;
    const major=Math.abs(t/ (step*(step<1?5:2)) % 1)<1e-6;
    c.strokeStyle=major?"#39404F":"#252A34";
    c.beginPath();c.moveTo(Math.round(x)+.5,major?h-11:h-6);c.lineTo(Math.round(x)+.5,h);c.stroke();
    if(major||step*RT.zoom>=76){
      c.fillStyle="#6B7183";
      c.fillText(tc(t),Math.round(x)+3,11);
    }
  }
  c.strokeStyle="#262A33";c.beginPath();c.moveTo(0,h-.5);c.lineTo(w,h-.5);c.stroke();
}
export function tc(t){
  const s=Math.max(0,t),m=Math.floor(s/60),r=s-m*60;
  return m+":"+(r<10?"0":"")+r.toFixed(r%1?2:0).replace(/\.00$/,"");
}
export function tcFrames(t){
  const f=SEQ.fps||30,n=Math.round(t*f);
  const s=Math.floor(n/f);
  return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")+":"+String(n%f).padStart(2,"0");
}

function label(clip){
  const p=clip.props;
  if(clip.type==="list")return (p.items||[]).join(", ")||"list";
  if(clip.type==="image")return p.label||p.src||"image";
  if(clip.type==="audio")return p.src||"audio";
  if(clip.type==="bg")return p.src||"background";
  if(clip.type==="card")return (p.card&&p.card.text)||"card";
  return p.text||clip.type;
}
function drawClip(clip,x,y,w,h,x0,x1){
  const sel=RT.sel===clip.id,hov=hover===clip.id;
  const col=COLORS[clip.type]||COLORS.text;
  c.save();
  c.beginPath();
  const r=Math.min(5,h/2,w/2);
  if(c.roundRect)c.roundRect(x,y+1,w,h-2,r);else c.rect(x,y+1,w,h-2);
  c.fillStyle=col[0];c.fill();
  if(clip.type==="audio")drawWave(clip,x,y,w,h,x0,x1);
  c.beginPath();
  if(c.roundRect)c.roundRect(x,y+1,w,h-2,r);else c.rect(x,y+1,w,h-2);
  c.clip();
  /* type stripe: identifies a clip when it is too narrow to hold a word */
  c.fillStyle=col[1];c.fillRect(x,y+1,3,h-2);
  if(w>26){
    c.fillStyle=sel?"#FFFFFF":"rgba(231,233,240,.86)";
    c.font=UI(sel?700:500,10.5);
    c.textAlign="left";c.textBaseline="middle";
    const txt=String(label(clip)).replace(/\s+/g," ");
    /* No maxWidth here: it condenses the glyphs instead of cropping, which
       turned a long label into an unreadable smear. The clip above crops. */
    c.fillText(txt,x+8,y+h/2);
  }
  c.restore();
  c.beginPath();
  if(c.roundRect)c.roundRect(x+.5,y+1.5,w-1,h-3,r);else c.rect(x+.5,y+1.5,w-1,h-3);
  c.strokeStyle=sel?"#FF5C3A":hov?col[1]:"rgba(255,255,255,.10)";
  c.lineWidth=sel?1.6:1;c.stroke();
  if(sel&&w>10){
    c.fillStyle="#FF5C3A";
    c.fillRect(x,y+1,3,h-2);c.fillRect(x+w-3,y+1,3,h-2);
  }
}
function drawWave(clip,x,y,w,h,x0,x1){
  const item=get(clip.props.src,"audio");
  if(!item||!item.peaks)return;
  const peaks=item.peaks,n=peaks.length;
  const mid=y+h/2,amp=(h-8)/2;
  c.fillStyle="rgba(111,214,154,.55)";
  const dur=item.dur||1;
  for(let px=Math.floor(x);px<x+w;px++){
    const t=xToT(px)-clip.t0+(clip.props.srcIn||0);
    if(t<0||t>dur)continue;
    const i=Math.min(n-1,Math.max(0,Math.floor(t/dur*n)));
    const v=peaks[i]*amp;
    c.fillRect(px,mid-v,1,v*2);
  }
}

/* ---------- snapping ---------- */
function snapPoints(ignoreId){
  const pts=[0,seqDur(),RT.time];
  for(const c2 of SEQ.clips){
    if(c2.id===ignoreId)continue;
    pts.push(c2.t0,c2.t1);
  }
  return pts;
}
function snap(t,ignoreId,off){
  if(off)return t;
  const tol=8/RT.zoom;
  let best=t,bd=tol;
  for(const p of snapPoints(ignoreId)){
    const d=Math.abs(p-t);
    if(d<bd){bd=d;best=p;}
  }
  /* whole seconds, but only when they are far enough apart to aim at */
  if(bd===tol&&RT.zoom>=22){
    const s=Math.round(t);
    if(Math.abs(s-t)<tol){best=s;}
  }
  return Math.max(0,best);
}

/* ---------- pointer ---------- */
function local(e){
  const b=cv.getBoundingClientRect();
  return {x:e.clientX-b.left,y:e.clientY-b.top};
}
function hit(p){
  for(let i=HIT.length-1;i>=0;i--){
    const H=HIT[i];
    if(p.y<H.y||p.y>H.y+H.h)continue;
    if(p.x<H.x0-4||p.x>H.x1+4)continue;
    const edge=Math.min(9,Math.max(4,(H.x1-H.x0)/4));
    const mode=p.x<H.x0+edge?"l":p.x>H.x1-edge?"r":"move";
    return {H,mode};
  }
  return null;
}
function onDown(e){
  const p=local(e);
  cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);
  if(p.y<RULER||p.x<GUT){
    if(p.x>=GUT){RT.time=Math.max(0,xToT(p.x));drag={kind:"scrub"};hooks.onSeek&&hooks.onSeek(RT.time);drawTL();}
    return;
  }
  const h=hit(p);
  if(!h){
    RT.sel=null;RT.time=Math.max(0,xToT(p.x));
    drag={kind:"scrub"};
    hooks.onSelect&&hooks.onSelect(null);hooks.onSeek&&hooks.onSeek(RT.time);
    drawTL();return;
  }
  RT.sel=h.H.clip.id;
  hooks.onSelect&&hooks.onSelect(h.H.clip);
  drag={kind:h.mode,clip:h.H.clip,t:xToT(p.x),
    t0:h.H.clip.t0,t1:h.H.clip.t1,track:h.H.clip.track,moved:false};
  drawTL();
}
function onMove(e){
  const p=local(e);
  if(!drag){
    const h=hit(p);
    const id=h?h.H.clip.id:null;
    cv.style.cursor=p.y<RULER?"ew-resize":h?(h.mode==="move"?"grab":"col-resize"):"default";
    if(id!==hover){hover=id;drawTL();}
    return;
  }
  if(drag.kind==="scrub"){
    RT.time=Math.max(0,xToT(p.x));
    hooks.onSeek&&hooks.onSeek(RT.time);drawTL();return;
  }
  const clip=drag.clip,dt=xToT(p.x)-drag.t,off=e.shiftKey;
  const len=drag.t1-drag.t0;
  if(drag.kind==="move"){
    let nt0=snap(Math.max(0,drag.t0+dt),clip.id,off);
    const nt1=snap(nt0+len,clip.id,off);
    if(Math.abs(nt1-(nt0+len))>1e-6)nt0=nt1-len;
    clip.t0=Math.max(0,nt0);clip.t1=clip.t0+len;
    const r=rowAt(p.y);
    const allow=ALLOWED[clip.type]||[];
    if(r&&allow.indexOf(r.id)>=0)clip.track=r.id;
  }else if(drag.kind==="l"){
    const nt=Math.min(clip.t1-1/(SEQ.fps||30),snap(Math.max(0,drag.t0+dt),clip.id,off));
    if(clip.type==="audio"||clip.type==="bg")
      clip.props.srcIn=Math.max(0,(clip.props.srcIn||0)+(nt-clip.t0));
    clip.t0=nt;
  }else{
    clip.t1=Math.max(clip.t0+1/(SEQ.fps||30),snap(drag.t1+dt,clip.id,off));
  }
  drag.moved=true;
  hooks.onChange&&hooks.onChange(clip);
  drawTL();
}
function onUp(){
  if(drag&&drag.kind!=="scrub"&&drag.moved)markDirty();
  drag=null;
  if(cv)cv.style.cursor="default";
}
function onDbl(e){
  const h=hit(local(e));
  if(h)hooks.onOpen&&hooks.onOpen(h.H.clip);
}
function onWheel(e){
  /* Ctrl/⌘ zooms around the pointer, everything else scrolls — the same
     bargain every NLE makes, so the muscle memory transfers. */
  if(e.ctrlKey||e.metaKey){
    e.preventDefault();
    const p=local(e),tAt=xToT(p.x);
    RT.zoom=Math.max(4,Math.min(600,RT.zoom*(e.deltaY<0?1.14:1/1.14)));
    RT.scroll=Math.max(0,tAt-(p.x-GUT)/RT.zoom);
  }else{
    const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
    if(!d)return;
    e.preventDefault();
    RT.scroll=Math.max(0,RT.scroll+d/RT.zoom*0.9);
  }
  drawTL();
}

export function zoomBy(k){
  const mid=RT.scroll+(cv?(cv.getBoundingClientRect().width-GUT)/2/RT.zoom:0);
  RT.zoom=Math.max(4,Math.min(600,RT.zoom*k));
  RT.scroll=Math.max(0,mid-(cv?(cv.getBoundingClientRect().width-GUT)/2/RT.zoom:0));
  drawTL();
}
export function zoomFit(){
  if(!cv)return;
  const w=cv.getBoundingClientRect().width-GUT-16;
  RT.zoom=Math.max(4,Math.min(600,w/Math.max(1,seqDur())));
  RT.scroll=0;drawTL();
}
/* Keep the playhead on screen during playback without snatching the view back
   every frame — only nudge when it has actually left. */
export function followPlayhead(){
  if(!cv)return;
  const w=cv.getBoundingClientRect().width-GUT;
  const x=tToX(RT.time);
  if(x>GUT+w-40||x<GUT){RT.scroll=Math.max(0,RT.time-w/RT.zoom*0.15);}
}
export function deleteSelected(){
  if(!RT.sel)return false;
  removeClip(RT.sel);RT.sel=null;markDirty();drawTL();return true;
}
