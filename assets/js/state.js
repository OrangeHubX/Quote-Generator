/* state.js — Editable state, viewport sizing and the coalesced redraw scheduler. */
import {R} from './data.js';
import {draw} from './curve.js';

/* ---------- viewport ----------
   Every mobile height derives from --vh, which tracks the *visual* viewport, so
   the layout shrinks with the on-screen keyboard instead of overflowing behind
   it. Static vh units must not be used for layout heights. */
export function syncVH(){
  const vv=window.visualViewport;
  const root=document.documentElement;
  const h=Math.round(vv?vv.height:window.innerHeight);
  const top=Math.round(vv?vv.offsetTop:0);
  /* Size the shell to the *visual* viewport rather than trusting the layout
     viewport to shrink. That holds whether or not the browser honours
     interactive-widget=resizes-content, so no strip of page can ever show
     between the nav bar and the keyboard. */
  if(root.style.getPropertyValue("--vh")!==h+"px")root.style.setProperty("--vh",h+"px");
  if(root.style.getPropertyValue("--vvTop")!==top+"px")root.style.setProperty("--vvTop",top+"px");
  scheduleDraw();
}
/* Editing state drives the mobile canvas strip. Focus is the reliable signal —
   some browsers resize the layout viewport for the keyboard and some don't.

   Only fields that actually raise a keyboard may count. A checkbox, radio or
   range also takes focus when tapped, and treating those as "editing" collapsed
   the canvas on every toggle — which expanded the editor and, because the strip
   height was !important, made the drag grip look dead. */
const KB_TYPES={text:1,search:1,url:1,email:1,tel:1,number:1,password:1};
export function isTextField(el){
  if(!el||!el.tagName)return false;
  if(el.tagName==="TEXTAREA")return true;
  if(el.tagName!=="INPUT")return false;
  return !!KB_TYPES[(el.getAttribute("type")||"text").toLowerCase()];
}
function setEditing(on){
  const root=document.documentElement;
  const v=on?"1":"0";
  if(root.dataset.kb===v)return;
  root.dataset.kb=v;R.editing=on;
  scheduleDraw();
  /* the stage height animates, so re-fit the canvas once it has settled */
  clearTimeout(setEditing._t);
  setEditing._t=setTimeout(scheduleDraw,220);
}
document.addEventListener("focusin",e=>{
  if(!isTextField(e.target))return;
  setEditing(true);
  /* let the strip collapse first, then bring the field into view */
  setTimeout(()=>{try{e.target.scrollIntoView({block:"center",behavior:"smooth"});}catch(_){}},210);
});
document.addEventListener("focusout",()=>{
  setTimeout(()=>{if(!isTextField(document.activeElement))setEditing(false);},80);
});
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",syncVH);
  window.visualViewport.addEventListener("scroll",syncVH);
}
window.addEventListener("resize",syncVH);
window.addEventListener("orientationchange",()=>setTimeout(syncVH,180));

/* ---------- draw scheduler (coalesce work into one frame) ---------- */
let drawPending=false;
export function scheduleDraw(){ if(drawPending||R.playing)return; drawPending=true; requestAnimationFrame(()=>{drawPending=false;draw();}); }

export function rr(c,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  if(c.roundRect){c.beginPath();c.roundRect(x,y,w,h,r);return;}
  c.beginPath();c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
export const GRAIN=(function(){
  const n=document.createElement("canvas");n.width=n.height=160;
  const g=n.getContext("2d"),dd=g.createImageData(160,160);
  for(let i=0;i<dd.data.length;i+=4){const v=200+Math.random()*55|0;dd.data[i]=dd.data[i+1]=dd.data[i+2]=v;dd.data[i+3]=255;}
  g.putImageData(dd,0,0);return n;
})();

