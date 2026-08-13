/* paint-util.js — Drawing primitives with no dependencies of their own.

   These used to live in state.js, which also owns the viewport, the keyboard
   and the redraw scheduler — so a card renderer that only wanted a rounded
   rectangle dragged the whole card editor's UI in behind it. The studio page
   renders the same cards without any of that chrome existing, so the two
   primitives moved down here where nothing else can hitch a ride. state.js
   re-exports them, so every existing import still resolves. */

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
