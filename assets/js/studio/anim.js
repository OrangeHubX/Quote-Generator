/* anim.js — In/out animation presets.

   Each preset maps 0..1 progress to one transform record. The renderer applies
   it around the element's own centre, so a preset never has to know how big the
   thing it is moving is — which is what lets the same "rise" read correctly on a
   one-word stamp and a six-name roster. Offsets are fractions of the frame, not
   pixels, so a sequence pasted at 1080 and exported at 4K moves identically. */

export const EZ={
  linear:t=>t,
  out:   t=>1-Math.pow(1-t,3),
  expo:  t=>t>=1?1:1-Math.pow(2,-10*t),
  inout: t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
  back:  t=>{const c=1.70158,c3=c+1;return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2);},
  soft:  t=>1-Math.pow(1-t,2)
};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ID={alpha:1,dx:0,dy:0,scale:1,rot:0,reveal:1,blurPx:0};

const IN={
  none: ()=>ID,
  fade: p=>({...ID,alpha:EZ.out(p)}),
  rise: p=>({...ID,alpha:EZ.out(Math.min(1,p*1.5)),dy:(1-EZ.back(p))*0.075}),
  fall: p=>({...ID,alpha:EZ.out(Math.min(1,p*1.5)),dy:-(1-EZ.back(p))*0.075}),
  pop:  p=>({...ID,alpha:EZ.out(Math.min(1,p*2)),scale:0.72+0.28*EZ.back(p)}),
  /* A stamp lands: most of the travel is gone in the first third, then a small
     rotational settle so it reads as impact rather than a scale tween. */
  slam: p=>{const e=EZ.expo(p);
    return {...ID,alpha:Math.min(1,p*4),scale:1.9-0.9*e,rot:(1-e)*0.10,blurPx:(1-e)*10};},
  wipe: p=>({...ID,alpha:1,reveal:EZ.inout(p)}),
  "slide-l":p=>({...ID,alpha:EZ.out(Math.min(1,p*1.6)),dx:(1-EZ.out(p))*0.20}),
  "slide-r":p=>({...ID,alpha:EZ.out(Math.min(1,p*1.6)),dx:-(1-EZ.out(p))*0.20})
};
const OUT={
  none: ()=>ID,
  fade: p=>({...ID,alpha:EZ.soft(p)}),
  drop: p=>({...ID,alpha:EZ.soft(p),dy:(1-p)*0.05}),
  "pop-out":p=>({...ID,alpha:EZ.soft(p),scale:0.88+0.12*EZ.out(p)}),
  "wipe-out":p=>({...ID,alpha:1,reveal:EZ.inout(p)}),
  "slide-l":p=>({...ID,alpha:EZ.soft(p),dx:-(1-EZ.out(p))*0.20}),
  "slide-r":p=>({...ID,alpha:EZ.soft(p),dx:(1-EZ.out(p))*0.20})
};

/* Progress of a clip at time t. `p` is 0..1 across the whole clip; `inP` and
   `outP` are the two ends, both counted in frames so retiming a clip does not
   stretch its entrance. */
export function progress(clip,t,fps){
  const len=Math.max(1e-4,clip.t1-clip.t0);
  const local=t-clip.t0;
  const inS=Math.min(len*0.9,(clip.props.inDur||0)/fps);
  const outS=Math.min(len*0.9,(clip.props.outDur||0)/fps);
  return {
    p:clamp(local/len,0,1),
    local,
    inP:inS<=0?1:clamp(local/inS,0,1),
    outP:outS<=0?1:clamp((len-local)/outS,0,1)
  };
}

export function transformFor(clip,t,fps){
  const {inP,outP}=progress(clip,t,fps);
  const a=(IN[clip.props.anim]||IN.fade)(inP);
  const b=(OUT[clip.props.out]||OUT.fade)(outP);
  return {
    alpha:a.alpha*b.alpha*((clip.props.opacity==null?100:clip.props.opacity)/100),
    dx:a.dx+b.dx,
    dy:a.dy+b.dy,
    scale:a.scale*b.scale,
    rot:a.rot+b.rot,
    /* Both ends can wipe; the visible band is whichever is tighter. */
    reveal:Math.min(a.reveal,b.reveal),
    revealFrom:(clip.props.out==="wipe-out"&&b.reveal<1)?"end":"start",
    blurPx:a.blurPx+b.blurPx
  };
}

/* How much the plate should be blurred and dimmed at time t: the strongest
   request from any overlay that is up, ramped so it breathes in and out with
   the element rather than snapping. */
export function plateEffect(stack,t,fps,seq){
  let blur=0,dim=0;
  for(const c of stack){
    const ramp=Math.max(1,seq.blurRamp||6)/fps;
    const up=clamp((t-c.t0)/ramp,0,1);
    const down=clamp((c.t1-t)/ramp,0,1);
    const w=EZ.inout(Math.min(up,down));
    if(c.props.blur)blur=Math.max(blur,w);
    if(c.props.dim)dim=Math.max(dim,w);
  }
  return {blur:blur*(seq.blurAmt||0),dim:dim*((seq.dimAmt||0)/100)};
}
