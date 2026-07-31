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

  /* Dismissing the keyboard with its own close button does not blur the field, so
     focusout never fires and the canvas would stay a strip with the grip looking
     dead. The visual viewport growing back is the only signal that it is gone.

     It has to be measured against its *own* pre-keyboard height, not against
     window.innerHeight: this page asks for interactive-widget=resizes-content, so
     the keyboard shrinks the layout viewport too and the gap between the two stays
     near zero the whole time the keyboard is up. Comparing them closed the
     keyboard the instant it opened, on every field.

     And the shrink has to actually have been seen before a re-grow can mean
     anything — focusin sets data-kb before the viewport has moved, so without
     `sawKb` the first event after focus would look like a dismissal. */
  if(root.dataset.kb!=="1"){
    vvFull=h;                       /* tracks browser chrome while nothing is up */
  }else if(vvFull){
    if(h<vvFull-KB_MIN)sawKb=true;
    else if(sawKb){
      const el=document.activeElement;
      if(isTextField(el))el.blur();
      setEditing(false);
    }
  }
  scheduleDraw();
}
/* Editing state drives the mobile canvas strip. Focus is the reliable signal —
   some browsers resize the layout viewport for the keyboard and some don't.

   Only fields that actually raise a keyboard may count. A checkbox, radio or
   range also takes focus when tapped, and treating those as "editing" collapsed
   the canvas on every toggle — which expanded the editor and, because the strip
   height was !important, made the drag grip look dead. */
/* Below this much missing viewport height, no keyboard is up. Browser chrome and
   URL bars move by less than this; a keyboard is always far more. */
const KB_MIN=110;
let vvFull=0;      /* visual viewport height with nothing covering it */
let sawKb=false;   /* the keyboard has actually been observed, this focus */
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
  /* Only on a real 0→1 transition, so moving between two fields does not forget
     that the keyboard is already up. */
  if(on)sawKb=false;
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
/* a rotation invalidates the baseline, so drop it rather than measure against a
   height from the other orientation */
window.addEventListener("orientationchange",()=>{vvFull=0;sawKb=false;setTimeout(syncVH,180);});

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

