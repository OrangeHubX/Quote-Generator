/* sheet.js — Draggable editor sheet (mobile). The canvas height is the single
   knob: dragging the grip up shrinks the canvas so the editor grows, dragging
   down parks the editor at the bottom leaving only the grip in reach. */
import {$, clamp, isPhone} from './data.js';
import {scheduleDraw} from './state.js';

const SHEET_KEY="qs-sheet";
const SHEET_PEEK=54;          /* editor sliver left visible when parked */

function vhPx(){
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vh"))
    ||window.innerHeight;
}
function sheetSpan(){
  const vh=vhPx();
  const mbar=($(".mbar").offsetHeight)||56;
  const grip=($("#grip").offsetHeight)||22;
  /* canvas can grow until only the sliver of editor is left */
  const max=Math.max(0,vh-mbar-grip-SHEET_PEEK);
  return {vh,max,mid:Math.round(Math.min(max,vh*0.40))};
}
function snapName(px,sp){
  if(px<=8)return "full";                 /* editor takes everything */
  if(px>=sp.max-8)return "peek";          /* editor parked at the bottom */
  return "mid";
}
function setCanvasH(px,opts){
  const sp=sheetSpan();
  px=clamp(Math.round(px),0,sp.max);
  const app=$(".app");
  app.style.setProperty("--canvasH",px+"px");
  app.dataset.sheet=snapName(px,sp);
  if(!(opts&&opts.silent)){
    try{localStorage.setItem(SHEET_KEY,String(px));}catch(_){}
  }
  /* re-fit the canvas once the height transition has settled */
  scheduleDraw();
  clearTimeout(setCanvasH._t);
  setCanvasH._t=setTimeout(scheduleDraw,230);
}
export function initSheet(){
  if(!isPhone())return;
  const sp=sheetSpan();
  let saved=parseFloat(localStorage.getItem(SHEET_KEY));
  if(!isFinite(saved))saved=sp.mid;
  setCanvasH(saved,{silent:true});
}
(function dragSheet(){
  const grip=$("#grip"),app=$(".app");
  let startY=0,startH=0,sp=null,dragging=false,moved=false;
  grip.addEventListener("pointerdown",e=>{
    if(!isPhone())return;
    dragging=true;moved=false;
    startY=e.clientY;
    startH=parseFloat(getComputedStyle(app).getPropertyValue("--canvasH"))||sheetSpan().mid;
    sp=sheetSpan();
    app.dataset.drag="true";
    try{grip.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
  });
  grip.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const dy=e.clientY-startY;
    if(Math.abs(dy)>3)moved=true;
    /* dragging down grows the canvas and pushes the editor away */
    setCanvasH(startH+dy,{silent:true});
  });
  const end=e=>{
    if(!dragging)return;
    dragging=false;delete app.dataset.drag;
    try{grip.releasePointerCapture(e.pointerId);}catch(_){}
    const cur=parseFloat(getComputedStyle(app).getPropertyValue("--canvasH"))||0;
    if(!moved){                       /* a tap cycles the three positions */
      const now=snapName(cur,sp);
      setCanvasH(now==="mid"?0:now==="full"?sp.max:sp.mid);
      return;
    }
    /* snap to whichever of the three stops is nearest */
    const stops=[0,sp.mid,sp.max];
    let best=stops[0];
    for(const s of stops) if(Math.abs(s-cur)<Math.abs(best-cur)) best=s;
    setCanvasH(best);
  };
  grip.addEventListener("pointerup",end);
  grip.addEventListener("pointercancel",end);
  /* keyboard access */
  grip.addEventListener("keydown",e=>{
    if(!isPhone())return;
    const sp2=sheetSpan();
    const cur=parseFloat(getComputedStyle(app).getPropertyValue("--canvasH"))||0;
    if(e.key==="ArrowUp"){e.preventDefault();setCanvasH(cur-40);}
    if(e.key==="ArrowDown"){e.preventDefault();setCanvasH(cur+40);}
    if(e.key==="Home"){e.preventDefault();setCanvasH(0);}
    if(e.key==="End"){e.preventDefault();setCanvasH(sp2.max);}
  });
})();
/* keep the sheet inside bounds when the viewport changes */
window.addEventListener("resize",()=>{
  if(!isPhone())return;
  const cur=parseFloat(getComputedStyle($(".app")).getPropertyValue("--canvasH"));
  if(isFinite(cur))setCanvasH(cur,{silent:true});
});
