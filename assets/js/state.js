/* state.js — Editable state, viewport sizing and the coalesced redraw scheduler. */
/* ---------- viewport ---------- */
function syncVH(){
  const h=(window.visualViewport?window.visualViewport.height:window.innerHeight);
  document.documentElement.style.setProperty("--vh",Math.round(h)+"px");
  scheduleDraw();
}
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",syncVH);
}
window.addEventListener("resize",syncVH);

/* ---------- draw scheduler (coalesce work into one frame) ---------- */
let drawPending=false;
function scheduleDraw(){ if(drawPending||playing)return; drawPending=true; requestAnimationFrame(()=>{drawPending=false;draw();}); }

function rr(c,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  if(c.roundRect){c.beginPath();c.roundRect(x,y,w,h,r);return;}
  c.beginPath();c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
const GRAIN=(function(){
  const n=document.createElement("canvas");n.width=n.height=160;
  const g=n.getContext("2d"),dd=g.createImageData(160,160);
  for(let i=0;i<dd.data.length;i+=4){const v=200+Math.random()*55|0;dd.data[i]=dd.data[i+1]=dd.data[i+2]=v;dd.data[i+3]=255;}
  g.putImageData(dd,0,0);return n;
})();

