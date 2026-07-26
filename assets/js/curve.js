/* curve.js — The preview draw loop: canvas sizing, playback and the readouts. */
import {$, FH, FW, R, S, ctx, cv, isPhone} from './data.js';
import {animAt, fitLayoutCached, frameSec, paint, totalFrames} from './layout.js';
import {advance, animated, clampFrame, drawTimeline} from './timeline.js';
import {drawGraph} from './graph.js';
import {syncWords} from './ui.js';

function viewBox(L){
  if(S.view==="card"){const m=Math.round(L.fs*0.85);
    return {x:L.x-m,y:L.y-m,w:L.cardW+m*2,h:L.cardH+m*2};}
  return {x:0,y:0,w:FW,h:FH};
}
/* Vertical space the stage must give up before the canvas gets any. The tools
   moved onto the canvas as floating pills, so the timeline is the only thing
   still taking room — measure it and the stage's own padding rather than
   guessing, because the timeline hides itself when nothing animates. */
function chromeH(stage){
  const cs=getComputedStyle(stage);
  const pad=parseFloat(cs.paddingTop||0)+parseFloat(cs.paddingBottom||0);
  const tl=$("#tl");
  if(!tl||tl.classList.contains("hide")||!tl.offsetHeight)return pad;
  return pad+tl.offsetHeight+parseFloat(cs.rowGap||cs.gap||0);
}
export function draw(){
  /* The playhead is the single source of truth for what the preview shows, and
     frameSec() is the mapping the exporters use — so the frame on screen is the
     frame that gets written out. Advance it before anything is measured. */
  clampFrame();
  if(R.playing)advance();
  drawTimeline();

  const L=fitLayoutCached(),vb=viewBox(L);
  const stage=document.querySelector(".stage");
  const availW=Math.max(140,stage.clientWidth-(isPhone()?28:44));
  const maxH=Math.max(56,stage.clientHeight-chromeH(stage));
  const w=Math.min(availW,maxH*vb.w/vb.h),h=w*vb.h/vb.w;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cv.style.width=Math.round(w)+"px";cv.style.height=Math.round(h)+"px";
  const pw=Math.round(w*dpr),ph=Math.round(h*dpr);
  if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}

  const A=animated()?animAt(frameSec(R.frame)):{alpha:1,scale:1,dy:0,hp:1};
  paint(ctx,pw/vb.w,L,{tx:-vb.x,ty:-vb.y,guides:S.guides&&S.view==="frame",anim:A});

  const k=parseFloat(S.res),m=Math.round(L.fs*1.35);
  $("#rOut").textContent=(S.crop==="card"
    ? Math.round((L.cardW+m*2)*k)+"×"+Math.round((L.cardH+m*2)*k)
    : (FW*k)+"×"+(FH*k))+(animated()&&S.format!=="still"?" · "+totalFrames()+"f":"");
  const f=$("#rFit");
  f.textContent=L.overflow?L.fs+" too long":(L.fitted?L.fs+" fit":String(L.fs));
  f.className=L.overflow?"warn":"";

  if($("#curve").offsetParent)drawGraph();
  syncWords();
  if(R.playing)requestAnimationFrame(draw);
}
