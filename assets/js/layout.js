/* layout.js — Layout dispatch with caching, easing curves and whole-frame paint. */
import {FH, FW, S, SANS, clamp, ctx, d} from './data.js';
import {layoutQuote, paintQuote} from './card-quote.js';
import {layoutSocial, paintSocial} from './card-social.js';

/* ---------- layout dispatch + fitting ---------- */
let layoutCache=null,layoutSig="";
function sigOf(){
  return [S.design,S.text,JSON.stringify(S.ranges),S.theme,S.face,S.size,S.width,S.ypos,S.marks,S.header,
    S.outlet,S.url,S.hlStyle,S.crop,S.res,S.name,S.handle,S.badge,S.follow,S.sub,S.time,S.likes,S.retweets,S.replies,S.views,
    S.avatar?S.avatar.src.length:0,S.media?(S.media.width+"x"+S.media.height):0,
    S.avShape,S.likeOn,S.audio,S.mediaSrc].join("|");
}
function computeLayout(c,fs){ return d().social?layoutSocial(c,fs):layoutQuote(c,fs); }
export function fitLayout(c){
  const maxH=FH*0.92;let fs=S.size,L=computeLayout(c,fs),n=0;
  while(L.cardH>maxH&&fs>14&&n++<80){fs-=1;L=computeLayout(c,fs);}
  L.fitted=fs<S.size;L.overflow=L.cardH>maxH;
  const m=FH*0.025;let y=(FH-L.cardH)/2+(S.ypos/100)*FH;
  if(L.cardH<=FH-m*2)y=Math.min(Math.max(y,m),FH-L.cardH-m);else y=(FH-L.cardH)/2;
  L.x=Math.round((FW-L.cardW)/2);L.y=Math.round(y);
  return L;
}
export function fitLayoutCached(){
  const s=sigOf();
  if(s===layoutSig&&layoutCache)return layoutCache;
  layoutCache=fitLayout(ctx);layoutSig=s;return layoutCache;
}
export function invalidateLayout(){layoutSig="";}

/* ---------- easing ---------- */
export const EASE={
  inout:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  out:t=>1-Math.pow(1-t,3),
  smooth:t=>1-Math.pow(1-t,3),
  back:(t,k)=>{const c1=k,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);},
  spring:(t,k)=>{
    if(t<=0)return 0;if(t>=1)return 1;
    const z=6.4-Math.min(k,3.4),w=Math.PI*2*1.12;
    const r=1-Math.exp(-z*t)*Math.cos(w*t);
    const b=t<.85?0:(t-.85)/.15;return r*(1-b)+b;
  }
};
function cubicBezier(x1,y1,x2,y2){
  const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx;
  const cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
  const fx=t=>((ax*t+bx)*t+cx)*t, fy=t=>((ay*t+by)*t+cy)*t, dfx=t=>(3*ax*t+2*bx)*t+cx;
  return function(x){let t=x;for(let i=0;i<8;i++){const e=fx(t)-x;if(Math.abs(e)<1e-4)break;const dv=dfx(t);if(Math.abs(dv)<1e-6)break;t-=e/dv;}
    return fy(clamp(t,0,1));};
}
export function scaleFn(t){
  if(!S.anim||S.scaleEase==="none")return 1;
  let f;
  if(S.scaleEase==="back")f=EASE.back(t,S.over/10);
  else if(S.scaleEase==="spring")f=EASE.spring(t,S.over/10);
  else if(S.scaleEase==="custom")f=cubicBezier(S.bezier[0],S.bezier[1],S.bezier[2],S.bezier[3])(t);
  else f=EASE.smooth(t);
  return (S.sFrom/100)+(1-S.sFrom/100)*f;
}
export function animEndSec(){
  const fps=+S.fps;let end=0;
  if(S.anim)end=S.dur/30;
  if(S.hlAnim)end=Math.max(end,S.hlOffset/30+S.hlDur/30);
  return end;
}
export function animAt(sec){
  const durSec=S.dur/30;
  let alpha=1,scale=1,dy=0;
  if(S.anim){
    const t=clamp(sec/durSec,0,1);
    alpha=S.fadeEase==="none"?1:EASE[S.fadeEase](t);
    scale=scaleFn(t);
    dy=S.drift*(1-EASE.out(t));
  }
  let hp=1;
  if(S.hlAnim){const offs=S.hlOffset/30,hd=Math.max(.05,S.hlDur/30);hp=clamp((sec-offs)/hd,0,1);}
  return {alpha,scale,dy,hp};
}
export function totalFrames(){const fps=+S.fps;const end=animEndSec();return (S.anim||S.hlAnim)?Math.max(1,Math.round(end*fps))+S.hold:1;}

/* ---------- paint (whole frame) ---------- */
export function paint(c,scale,L,o){
  o=o||{};
  c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,c.canvas.width,c.canvas.height);
  if(S.bg!=="transparent"){c.fillStyle=S.bg;c.fillRect(0,0,c.canvas.width,c.canvas.height);}
  c.restore();
  c.setTransform(scale,0,0,scale,0,0);
  c.translate(o.tx||0,o.ty||0);
  c.textBaseline="alphabetic";c.textAlign="left";
  const A=o.anim||{alpha:1,scale:1,dy:0,hp:1};
  const {x,y,cardW,cardH,fs}=L;
  c.save();
  c.globalAlpha=A.alpha;
  const cx=x+cardW/2,cy0=y+cardH/2;
  c.translate(cx,cy0+A.dy);c.scale(A.scale,A.scale);c.translate(-cx,-cy0);
  if(L.kind==="social")paintSocial(c,L,A);else paintQuote(c,L,A);
  c.restore();
  if(o.guides){
    c.globalAlpha=1;
    c.strokeStyle="rgba(255,180,171,.6)";c.lineWidth=2;c.setLineDash([10,8]);
    c.strokeRect(1,FH*0.795,FW-2,FH*0.205);
    c.strokeRect(FW*0.80,FH*0.30,FW*0.20-1,FH*0.50);
    c.setLineDash([]);c.fillStyle="rgba(255,180,171,.8)";
    c.font="600 22px "+SANS;c.fillText("SHORTS UI",22,FH*0.795-14);
  }
}

