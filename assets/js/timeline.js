/* timeline.js — Frame ruler, playhead and scrubbing.

   The scrubber reads frames through layout.js's frameSec(), the same mapping
   every exporter uses, so the frame under the playhead is exactly the frame that
   gets written out. Playback advances whole frames rather than continuous time
   for the same reason: what you preview is what you export. */
import {$, R, S, SANS, clamp} from './data.js';
import {FPS, animFrames, totalFrames} from './layout.js';

const PAD={l:6,r:6};
const C={track:"#1D2027",tick:"#3A4050",ink:"#6B7183",anim:"rgba(125,147,255,.22)",
  hold:"rgba(152,160,178,.14)",wipe:"rgba(255,168,197,.30)",head:"#E7E9F0",acc:"#7D93FF"};

function tickStep(n,want){
  for(const s of [1,2,5,10,15,20,30,60,120,300])if(n/s<=want)return s;
  return Math.ceil(n/want);
}
/* local rounded rect — state.js has one, but importing it would close a third
   cycle through curve.js for no gain */
function pill(c,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  if(c.roundRect){c.beginPath();c.roundRect(x,y,w,h,r);return;}
  c.beginPath();c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
export function animated(){return S.anim||S.hlAnim;}

/* R.frame is the authority. Clamp it whenever the frame count changes so
   shortening the animation can never leave the playhead past the end. */
export function clampFrame(){
  const n=totalFrames();
  if(!isFinite(R.frame))R.frame=n-1;
  R.frame=clamp(Math.round(R.frame),0,n-1);
}
export function setFrame(n,keepPlaying){
  if(!keepPlaying&&R.playing)stop();
  R.frame=clamp(Math.round(n),0,totalFrames()-1);
  drawTimeline();
}
export function step(delta){setFrame(R.frame+delta);}
export function play(){
  if(!animated())return;
  /* restarting from the settled tail should replay from the top */
  if(R.frame>=totalFrames()-1)R.frame=0;
  R.playing=true;R.playT0=performance.now()-R.frame*1000/FPS();
  syncPlayBtn();
}
export function stop(){R.playing=false;syncPlayBtn();}
export function toggle(){R.playing?stop():play();}

/* Advance the playhead from the wall clock. Called from the draw loop, which
   owns the rAF, so playback and repaint can never fall out of step. */
export function advance(){
  const n=totalFrames(),f=FPS();
  const el=(performance.now()-R.playT0)/1000;
  let i=Math.floor(el*f);
  const pause=Math.round(f*0.45);       /* beat on the last frame before looping */
  if(i>=n+pause){R.playT0=performance.now();i=0;}
  R.frame=Math.min(i,n-1);
}

export function syncPlayBtn(){
  const b=$("#play");if(!b)return;
  b.setAttribute("aria-pressed",String(!!R.playing));
  b.setAttribute("aria-label",R.playing?"Pause":"Play");
  b.setAttribute("title",R.playing?"Pause (space)":"Play (space)");
  b.querySelector("svg").innerHTML=R.playing
    ?'<rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect>'
    :'<path d="M8 5l11 7-11 7z"></path>';
}

export function drawTimeline(){
  const wrap=$("#tl");if(!wrap)return;
  const on=animated();
  wrap.classList.toggle("hide",!on);
  if(!on)return;
  clampFrame();
  const el=$("#tlBar");if(!el||!el.clientWidth)return;
  const W=el.clientWidth,H=el.clientHeight||34;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
  if(el.width!==pw||el.height!==ph){el.width=pw;el.height=ph;}
  const c=el.getContext("2d");
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);

  const n=totalFrames(),nf=animFrames();
  const gw=W-PAD.l-PAD.r;
  /* a frame occupies a slot, so frame i spans [i, i+1) of the ruler */
  const X=f=>PAD.l+gw*(f/n);
  const rowY=H-11, rowH=8;

  /* ---- spans: animated, hold tail, and the highlight wipe ---- */
  c.fillStyle=C.track;pill(c,PAD.l,rowY,gw,rowH,4);c.fill();
  c.fillStyle=C.anim;pill(c,PAD.l,rowY,Math.max(2,X(nf)-PAD.l),rowH,4);c.fill();
  if(n>nf){c.fillStyle=C.hold;c.fillRect(X(nf),rowY,Math.max(1,X(n)-X(nf)),rowH);}
  if(S.hlAnim){
    const a=X(S.hlOffset),b=X(Math.min(nf,S.hlOffset+S.hlDur));
    c.fillStyle=C.wipe;c.fillRect(a,rowY+rowH-2.5,Math.max(2,b-a),2.5);
  }

  /* ---- ruler ---- */
  const step=tickStep(n,Math.max(3,Math.floor(gw/44)));
  c.font="9px "+SANS;c.textBaseline="alphabetic";
  for(let f=0;f<=n;f+=step){
    const x=Math.round(X(f))+.5;
    c.strokeStyle=C.tick;c.lineWidth=1;
    c.beginPath();c.moveTo(x,rowY-4);c.lineTo(x,rowY-1);c.stroke();
    c.fillStyle=C.ink;
    c.textAlign=f===0?"left":(f>=n-step*0.5?"right":"center");
    c.fillText(String(f),clamp(x,PAD.l,W-PAD.r),rowY-7);
  }

  /* ---- playhead ---- */
  const hx=X(R.frame+0.5);
  c.strokeStyle=C.head;c.lineWidth=1.6;
  c.beginPath();c.moveTo(hx,rowY-5);c.lineTo(hx,rowY+rowH);c.stroke();
  c.fillStyle=C.head;
  c.beginPath();c.moveTo(hx-4,rowY-9);c.lineTo(hx+4,rowY-9);c.lineTo(hx,rowY-4);c.closePath();c.fill();

  const rd=$("#tlRead");
  if(rd)rd.innerHTML="<b>"+R.frame+"</b> / "+(n-1);
}

export function initTimeline(){
  const el=$("#tlBar");if(!el)return;
  const frameAt=cx=>{
    const r=el.getBoundingClientRect();
    const gw=r.width-PAD.l-PAD.r;
    return Math.floor(clamp((cx-r.left-PAD.l)/Math.max(1,gw),0,0.9999)*totalFrames());
  };
  let scrub=false;
  el.addEventListener("pointerdown",e=>{
    if(!animated())return;
    scrub=true;stop();el.setPointerCapture(e.pointerId);
    setFrame(frameAt(e.clientX));e.preventDefault();
  });
  el.addEventListener("pointermove",e=>{if(scrub)setFrame(frameAt(e.clientX));});
  const up=e=>{if(!scrub)return;scrub=false;try{el.releasePointerCapture(e.pointerId);}catch(_){}};
  el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up);
  $("#play").addEventListener("click",toggle);
  $("#tlEnd").addEventListener("click",()=>setFrame(totalFrames()-1));
  syncPlayBtn();
}
