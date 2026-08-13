/* draw.js — The compositor: one function paints one frame.

   Preview and export call the same `renderFrame()` at different pixel sizes,
   so the only thing that can differ between what you scrub and what you upload
   is resolution. Nothing here reads the clock or the DOM; the caller says what
   time it is and guarantees the plate video is parked on the right frame. That
   is what makes the exporter deterministic — it can take as long as it likes
   per frame without the picture drifting. */

import {SEQ, SLOTS, clipsAt, visibleStack} from './model.js';
import {clamp, plateEffect, transformFor} from './anim.js';
import {ELEMENTS, font} from './elements.js';
import {CardEl} from './card.js';
import {get} from './media.js';

/* Where each clip last landed, in frame pixels — the preview needs it to know
   what the pointer is over and how far a drag moved. */
export const BOUNDS=new Map();

function elementFor(type){
  if(type==="card")return CardEl;
  return ELEMENTS[type]||null;
}

/* ---------- the plate ----------
   Blur is done small and then scaled up. A 40px blur across a 2160-wide frame
   is tens of milliseconds per frame and looks identical to a 9px blur on a
   480-wide copy stretched back out — the upscale does the last of the work. */
let blurCv=null,blurCtx=null;
function blurCanvas(w,h){
  if(!blurCv){blurCv=document.createElement("canvas");blurCtx=blurCv.getContext("2d");}
  if(blurCv.width!==w||blurCv.height!==h){blurCv.width=w;blurCv.height=h;}
  return blurCtx;
}
function plateBox(src,clip,W,H){
  const p=clip?clip.props:{zoom:100,x:0,y:0};
  const vw=src.w||src.videoWidth||src.naturalWidth||16;
  const vh=src.h||src.videoHeight||src.naturalHeight||9;
  const k=Math.max(W/vw,H/vh)*((p.zoom||100)/100);
  const dw=vw*k,dh=vh*k;
  const slackX=Math.max(0,dw-W),slackY=Math.max(0,dh-H);
  return {
    dw,dh,
    dx:(W-dw)/2+((p.x||0)/100)*slackX/2,
    dy:(H-dh)/2+((p.y||0)/100)*slackY/2
  };
}
function drawPlate(c,W,H,el,src,clip,blurPx){
  const box=plateBox(src,clip,W,H);
  const mirror=clip&&clip.props.mirror;
  const paintInto=(cc,scale)=>{
    cc.save();
    if(mirror){cc.translate(W*scale,0);cc.scale(-1,1);}
    try{cc.drawImage(el,box.dx*scale,box.dy*scale,box.dw*scale,box.dh*scale);}catch(_){}
    cc.restore();
  };
  if(blurPx>0.4){
    const bw=Math.max(64,Math.round(320*(W/H>1?W/H:1))),bh=Math.max(64,Math.round(bw*H/W));
    const bc=blurCanvas(bw,bh);
    const s=bw/W;
    bc.setTransform(1,0,0,1,0,0);
    bc.clearRect(0,0,bw,bh);
    bc.filter="none";
    paintInto(bc,s);
    /* Radius is authored against a 1080 short edge, so convert twice: into
       frame pixels, then into the small canvas. */
    const r=blurPx*(Math.min(W,H)/1080)*s;
    bc.filter="blur("+r.toFixed(2)+"px)";
    bc.drawImage(blurCv,0,0);
    bc.filter="none";
    c.save();
    c.imageSmoothingQuality="high";
    /* Overdraw slightly: a blurred edge otherwise shows the frame's own border. */
    const bleed=Math.ceil(r/s*1.5);
    c.drawImage(blurCv,-bleed,-bleed,W+bleed*2,H+bleed*2);
    c.restore();
  }else{
    paintInto(c,1);
  }
}

/* ---------- one element ---------- */
function drawElement(c,clip,env){
  const El=elementFor(clip.type);
  if(!El)return;
  c.save();
  c.setTransform(1,0,0,1,0,0);
  let m;
  try{m=El.measure(c,clip,env);}catch(_){c.restore();return;}
  const slot=SLOTS[clip.props.slot]||SLOTS.center;
  const tr=transformFor(clip,env.t,env.fps);
  const px=slot.x*env.W+((clip.props.x||0)/100)*env.W+tr.dx*env.W;
  const py=slot.y*env.H+((clip.props.y||0)/100)*env.H+tr.dy*env.H;
  const s=((clip.props.scale||100)/100)*tr.scale;
  const rot=((clip.props.rot||0)*Math.PI/180)+tr.rot;
  BOUNDS.set(clip.id,{x:px,y:py,w:m.w*s,h:m.h*s});
  c.globalAlpha=clamp(tr.alpha,0,1);
  c.translate(px,py);
  if(rot)c.rotate(rot);
  if(s!==1)c.scale(s,s);
  if(tr.reveal<1){
    c.beginPath();
    const w=m.w*1.06,h=m.h*1.2;
    if(tr.revealFrom==="end")c.rect(-w/2+w*(1-tr.reveal),-h/2,w*tr.reveal,h);
    else c.rect(-w/2,-h/2,w*tr.reveal,h);
    c.clip();
  }
  try{El.paint(c,clip,env,m);}catch(_){}
  c.restore();
}

/* ---------- safe zones (preview only) ---------- */
function drawSafe(c,W,H){
  c.save();
  c.setTransform(1,0,0,1,0,0);
  c.globalAlpha=1;c.lineWidth=Math.max(1,W/540);
  c.strokeStyle="rgba(255,180,171,.55)";c.setLineDash([W/108,W/135]);
  c.strokeRect(1,H*0.795,W-2,H*0.205-1);
  c.strokeRect(W*0.80,H*0.30,W*0.20-1,H*0.50);
  c.setLineDash([]);
  c.fillStyle="rgba(255,180,171,.75)";
  c.font=font(600,W/49);c.textAlign="left";c.textBaseline="alphabetic";
  c.fillText("SHORTS UI",W/49,H*0.795-W/78);
  c.restore();
}

/* ---------- the frame ---------- */
export function renderFrame(c,W,H,t,opts){
  opts=opts||{};
  const seq=SEQ,fps=seq.fps||30;
  const env={W,H,U:Math.min(W,H)/1080,t,fps,seq};
  c.save();
  c.setTransform(1,0,0,1,0,0);
  c.globalAlpha=1;c.filter="none";
  c.fillStyle="#000";c.fillRect(0,0,W,H);

  const stack=visibleStack(t);
  const fx=plateEffect(stack,t,fps,seq);

  /* plate */
  const bg=clipsAt(t,"bg")[0]||null;
  const item=bg?get(bg.props.src,"video")||get(bg.props.src,"image"):null;
  if(item){
    const el=opts.exporting&&item.ex?item.ex:item.el;
    drawPlate(c,W,H,el,item,bg,fx.blur);
  }else{
    const g=c.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#14161C");g.addColorStop(1,"#080A0E");
    c.fillStyle=g;c.fillRect(0,0,W,H);
    if(opts.preview){
      c.fillStyle="rgba(255,255,255,.30)";
      c.font=font(600,W/34);c.textAlign="center";c.textBaseline="middle";
      c.fillText("Drop a gameplay clip to fill the frame",W/2,H*0.5);
    }
  }
  if(fx.dim>0){
    c.fillStyle="rgba(0,0,0,"+fx.dim.toFixed(3)+")";
    c.fillRect(0,0,W,H);
  }
  c.restore();

  /* overlays, bottom track first */
  BOUNDS.clear();
  for(const clip of stack)drawElement(c,clip,env);

  /* captions */
  if(seq.captions){
    for(const s of clipsAt(t,"say")){
      if(!s.props.text)continue;
      const cap={id:"cap-"+s.id,type:"caption",track:"v1",t0:s.t0,t1:s.t1,
        props:{slot:"bottom",x:0,y:-4,scale:100,rot:0,opacity:100,
          anim:"fade",out:"fade",inDur:3,outDur:3,text:s.props.text}};
      drawElement(c,cap,env);
    }
  }

  if(opts.preview&&seq.safe)drawSafe(c,W,H);
  c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.restore();
}

/* Which clip is under a point, topmost first — the preview's hit test. */
export function clipAtPoint(x,y,t){
  const stack=visibleStack(t);
  for(let i=stack.length-1;i>=0;i--){
    const b=BOUNDS.get(stack[i].id);
    if(!b)continue;
    if(Math.abs(x-b.x)<=b.w/2&&Math.abs(y-b.y)<=b.h/2)return stack[i];
  }
  return null;
}
