/* sheet.js — Draggable editor sheet (mobile).
   The canvas height is the single knob and the editor takes whatever is left.
   What persists is the *snap state*, not a pixel height: mobile browser chrome
   (the address bar) changes --vh constantly, and re-clamping a stored pixel
   value against a fresh maximum made the sheet drift on its own. */
import {$, clamp, isPhone} from './data.js';
import {scheduleDraw} from './state.js';

const SHEET_KEY="qs-sheet-state";
const SHEET_PEEK=54;               /* editor sliver left visible when parked */
const STATES=["full","mid","peek"];
let sheetState="mid";

function vhPx(){
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vh"))
    ||window.innerHeight;
}
function sheetSpan(){
  const vh=vhPx();
  const mbar=($(".mbar").offsetHeight)||56;
  const grip=($("#grip").offsetHeight)||22;
  const max=Math.max(0,vh-mbar-grip-SHEET_PEEK);
  return {vh,max,mid:Math.round(Math.min(max,vh*0.40))};
}
function pxForState(st,sp){
  return st==="full"?0:st==="peek"?sp.max:sp.mid;
}
function nearestState(px,sp){
  let best="mid",bd=Infinity;
  for(const st of STATES){
    const dd=Math.abs(pxForState(st,sp)-px);
    if(dd<bd){bd=dd;best=st;}
  }
  return best;
}
function writePx(px){
  $(".app").style.setProperty("--canvasH",Math.round(px)+"px");
  scheduleDraw();
}
/* Re-apply the current snap state. Safe to call any time — it is idempotent, so
   viewport wobble can never move the sheet. */
export function applySheet(){
  if(!isPhone())return;
  const sp=sheetSpan();
  const app=$(".app");
  app.dataset.sheet=sheetState;
  writePx(pxForState(sheetState,sp));
  clearTimeout(applySheet._t);
  applySheet._t=setTimeout(scheduleDraw,240);
}
function setState(st){
  if(STATES.indexOf(st)<0)st="mid";
  sheetState=st;
  try{localStorage.setItem(SHEET_KEY,st);}catch(_){}
  applySheet();
}
export function initSheet(){
  if(!isPhone())return;
  let saved=null;
  try{saved=localStorage.getItem(SHEET_KEY);}catch(_){}
  sheetState=STATES.indexOf(saved)>=0?saved:"mid";
  applySheet();
}
(function dragSheet(){
  const grip=$("#grip"),app=$(".app");
  let startY=0,startH=0,sp=null,dragging=false,moved=false;
  const curPx=()=>{
    const v=parseFloat(getComputedStyle(app).getPropertyValue("--canvasH"));
    /* NB: 0 is a valid height — do not fall back with || here */
    return isFinite(v)?v:sheetSpan().mid;
  };
  grip.addEventListener("pointerdown",e=>{
    if(!isPhone())return;
    dragging=true;moved=false;
    startY=e.clientY;startH=curPx();sp=sheetSpan();
    app.dataset.drag="true";
    try{grip.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
  });
  grip.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const dy=e.clientY-startY;
    if(Math.abs(dy)>3)moved=true;
    /* free movement while dragging; the snap happens on release */
    writePx(clamp(startH+dy,0,sp.max));
  });
  const end=e=>{
    if(!dragging)return;
    dragging=false;delete app.dataset.drag;
    try{grip.releasePointerCapture(e.pointerId);}catch(_){}
    if(!moved){                       /* a tap cycles the three positions */
      setState(sheetState==="mid"?"full":sheetState==="full"?"peek":"mid");
      return;
    }
    setState(nearestState(curPx(),sp));
  };
  grip.addEventListener("pointerup",end);
  grip.addEventListener("pointercancel",end);
  grip.addEventListener("keydown",e=>{
    if(!isPhone())return;
    const i=STATES.indexOf(sheetState);
    if(e.key==="ArrowUp"){e.preventDefault();setState(STATES[Math.max(0,i-1)]);}
    if(e.key==="ArrowDown"){e.preventDefault();setState(STATES[Math.min(STATES.length-1,i+1)]);}
    if(e.key==="Home"){e.preventDefault();setState("full");}
    if(e.key==="End"){e.preventDefault();setState("peek");}
  });
})();
/* Only react to real viewport changes, and always re-derive from the state so
   nothing drifts. Height-only wobble from browser chrome is ignored. */
let lastW=window.innerWidth;
window.addEventListener("resize",()=>{
  if(!isPhone())return;
  if(window.innerWidth===lastW)return;
  lastW=window.innerWidth;
  applySheet();
});
window.addEventListener("orientationchange",()=>setTimeout(applySheet,220));
