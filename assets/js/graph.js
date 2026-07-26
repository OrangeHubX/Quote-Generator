/* graph.js — The motion graph, modelled on Premiere's graph editor.

   One canvas holds two stacked plots that share a frame-numbered time axis:

     value    the eased 0..1 progress of the move, auto-fitted so overshoot and
              undershoot stay visible, with the two bezier handles drawn *in the
              same coordinate space as the curve they control*
     velocity the derivative of that curve, which is how an editor reads whether
              a move accelerates smoothly or snaps

   The handles used to be plotted on a fixed -0.4..1.9 scale while the curve was
   auto-ranged, so a handle never sat on its own curve. Everything below shares
   one mapping, and the mapping is frozen for the duration of a drag so the
   handle cannot slide out from under the pointer as the range re-fits. */
import {$, R, S, SANS, clamp} from './data.js';
import {scheduleDraw} from './state.js';
import {EASE, FPS, animFrames, bez, easeProgress} from './layout.js';

/* ---------- presets ----------
   Named the way an editor reads a keyframe: "Ease Out" is Premiere's outgoing
   interpolation — a slow *start*. That is the opposite of the CSS keyword of the
   same name, so each one spells out what it does. */
const BEZ_BUILTIN=[
  ["Linear",                 [0,0,1,1]],
  ["Ease In and Out",        [.42,0,.58,1]],
  ["Ease Out (slow start)",  [.42,0,1,1]],
  ["Ease In (slow end)",     [0,0,.58,1]],
  ["Ease out back",          [.34,1.56,.64,1]],
  ["Soft overshoot",         [.2,1.3,.4,1]],
  ["Snappy",                 [.5,1.8,.5,1]],
  ["Anticipate",             [.5,-.4,.5,1.2]]
];
export function loadBez(){try{return JSON.parse(localStorage.getItem("qs-bez")||"[]");}catch(_){return [];}}
export function saveBez(list){try{localStorage.setItem("qs-bez",JSON.stringify(list));}catch(_){}}
export function allBez(){return BEZ_BUILTIN.concat(loadBez());}
export function builtinCount(){return BEZ_BUILTIN.length;}
function sameCurve(a,b){for(let i=0;i<4;i++)if(Math.abs(a[i]-b[i])>1e-4)return false;return true;}
export function matchBez(){
  const all=allBez();
  for(let i=0;i<all.length;i++)if(sameCurve(all[i][1],S.bezier))return i;
  return -1;
}

/* The shape of any ease mode, independent of which one is selected — the pickers
   draw thumbnails with it, so a list entry always shows what it will do. */
export function easeFnFor(mode){
  if(mode==="none")return ()=>1;
  if(mode==="back")return t=>EASE.back(t,S.over/10);
  if(mode==="spring")return t=>EASE.spring(t,S.over/10);
  if(mode==="custom")return t=>bez()(t);
  return t=>EASE.smooth(t);
}
/* Thumbnails are drawn by the same auto-ranging logic as the big graph, so a
   preset's tile and its curve cannot disagree. */
export function drawCurveThumb(el,fn,col){
  const W=el.clientWidth||34,H=el.clientHeight||22;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
  if(el.width!==pw||el.height!==ph){el.width=pw;el.height=ph;}
  const c=el.getContext("2d");
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  let lo=0,hi=1;
  for(let i=0;i<=48;i++){const v=fn(i/48);if(v<lo)lo=v;if(v>hi)hi=v;}
  const pad=Math.max(.06,(hi-lo)*.10);lo-=pad;hi+=pad;
  const m=2.5,gw=W-m*2,gh=H-m*2;
  const Y=v=>m+gh-gh*((v-lo)/(hi-lo));
  c.strokeStyle="rgba(107,113,131,.5)";c.lineWidth=1;
  c.beginPath();c.moveTo(m,Y(1)+.5);c.lineTo(W-m,Y(1)+.5);c.stroke();
  c.strokeStyle=col||C.curve;c.lineWidth=1.5;c.lineJoin="round";c.beginPath();
  for(let i=0;i<=40;i++)c.lineTo(m+gw*(i/40),Y(fn(i/40)));
  c.stroke();
}

/* ---------- colours ---------- */
const C={grid:"#22262F",grid2:"#2C313C",axis:"#3A4050",ink:"#6B7183",ink2:"#98A0B2",
  fade:"#5A6480",curve:"#7D93FF",vel:"#6FD69A",h1:"#7D93FF",h2:"#FFA8C5",key:"#E7E9F0",
  band:"rgba(125,147,255,.09)",hl:"#FFA8C5"};

/* ---------- geometry ---------- */
const PAD={l:30,r:9,t:11,b:15};
const SPLIT=0.62;            /* share of the plot height given to the value graph */
const GAPV=17;               /* room for the shared frame axis between the plots */
let map=null;                /* live pixel<->graph mapping, rebuilt each repaint */
let frozen=null;             /* value range held steady while a handle is dragged */

function velocityAt(t,h){
  /* central difference — the analytic derivative would have to special-case
     spring and back, and this matches what is drawn either way */
  const a=easeProgress(clamp(t-h,0,1)),b=easeProgress(clamp(t+h,0,1));
  return (b-a)/(2*h);
}
function fitValueRange(){
  let lo=0,hi=1;
  for(let i=0;i<=120;i++){const v=easeProgress(i/120);if(v<lo)lo=v;if(v>hi)hi=v;}
  /* A control point sits far outside the curve it produces — y=1.56 yields a
     peak of only ~1.05 — so the range has to cover the handles too, or the thing
     you are meant to drag is off-screen. Premiere auto-fits the same way. */
  if(S.anim&&S.scaleEase==="custom"){
    for(const v of [S.bezier[1],S.bezier[3]]){if(v<lo)lo=v;if(v>hi)hi=v;}
  }
  const pad=Math.max(.06,(hi-lo)*.10);
  return {lo:lo-pad,hi:hi+pad};
}
function fitVelRange(){
  let lo=0,hi=0.001;
  for(let i=0;i<=120;i++){const v=velocityAt(i/120,1/240);if(v<lo)lo=v;if(v>hi)hi=v;}
  const pad=Math.max(.08,(hi-lo)*.10);
  return {lo:lo-pad,hi:hi+pad};
}
/* nice tick step for a frame axis with at most `want` labels */
function tickStep(n,want){
  for(const s of [1,2,5,10,15,20,30,60,120,300])if(n/s<=want)return s;
  return Math.ceil(n/want);
}

export function drawGraph(){
  const el=$("#curve");if(!el||!el.offsetParent)return;
  const W=el.clientWidth||340,H=el.clientHeight||196;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
  if(el.width!==pw||el.height!==ph){el.width=pw;el.height=ph;}
  const c=el.getContext("2d");
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);

  const gw=W-PAD.l-PAD.r;
  const plotH=H-PAD.t-PAD.b-GAPV;
  const vaH=Math.round(plotH*SPLIT), veH=plotH-vaH;
  const vaTop=PAD.t, vaBot=vaTop+vaH;
  const veTop=vaBot+GAPV, veBot=veTop+veH;

  const vr=frozen||fitValueRange();
  const er=fitVelRange();
  const X=t=>PAD.l+gw*t;
  const T=x=>clamp((x-PAD.l)/gw,0,1);
  const Y=v=>vaBot-vaH*((v-vr.lo)/(vr.hi-vr.lo));
  const V=y=>vr.lo+(vr.hi-vr.lo)*((vaBot-y)/vaH);
  const YE=v=>veBot-veH*((v-er.lo)/(er.hi-er.lo));
  map={X,T,Y,V,YE,gw,vaTop,vaBot,veTop,veBot};
  el._map=map;

  const nf=animFrames(),hold=(S.anim||S.hlAnim)?S.hold:0;
  const custom=S.anim&&S.scaleEase==="custom";

  /* ---- highlight-wipe band, drawn behind everything ---- */
  if(S.hlAnim&&nf>0){
    const a=X(clamp(S.hlOffset/nf,0,1)),b=X(clamp((S.hlOffset+S.hlDur)/nf,0,1));
    c.fillStyle="rgba(255,168,197,.10)";c.fillRect(a,vaTop,Math.max(1,b-a),vaH);
    c.fillStyle=C.hl;c.fillRect(a,vaBot-1,Math.max(1,b-a),1.5);
  }

  /* ---- value grid: 0 and 1 are always drawn, they are what the move means ---- */
  c.lineWidth=1;
  for(const v of [0,1]){
    const y=Math.round(Y(v))+.5;
    if(y<vaTop-1||y>vaBot+1)continue;
    c.strokeStyle=v===1?C.axis:C.grid2;
    c.setLineDash(v===1?[4,4]:[]);
    c.beginPath();c.moveTo(PAD.l,y);c.lineTo(W-PAD.r,y);c.stroke();
  }
  c.setLineDash([]);
  c.fillStyle=C.ink;c.font="9px "+SANS;c.textAlign="right";
  c.fillText("100%",PAD.l-5,Y(1)+3);
  c.fillText("0",PAD.l-5,Y(0)+3);

  /* ---- shared frame axis ----
     Interior ticks are centred on their gridline; the two ends are aligned
     inward so neither can spill past the plot, and the unit rides on the last
     label rather than sitting in a slot of its own where it would collide. */
  const step=tickStep(nf,6);
  c.strokeStyle=C.grid;c.fillStyle=C.ink;c.textAlign="center";
  for(let f=step;f<nf;f+=step){
    if(nf-f<step*0.55)break;           /* too close to the end label */
    const x=Math.round(X(f/nf))+.5;
    c.beginPath();c.moveTo(x,vaTop);c.lineTo(x,vaBot);c.stroke();
    c.fillText(String(f),x,vaBot+12);
  }
  c.textAlign="left";c.fillText("0",X(0),vaBot+12);
  c.textAlign="right";c.fillText(nf+"f",X(1),vaBot+12);

  /* ---- velocity plot ---- */
  c.strokeStyle=C.grid2;
  const zy=Math.round(YE(0))+.5;
  c.beginPath();c.moveTo(PAD.l,zy);c.lineTo(W-PAD.r,zy);c.stroke();
  c.strokeStyle=C.grid;
  c.beginPath();c.moveTo(PAD.l,veTop+.5);c.lineTo(W-PAD.r,veTop+.5);c.stroke();
  c.beginPath();c.moveTo(PAD.l,veBot+.5);c.lineTo(W-PAD.r,veBot+.5);c.stroke();
  c.textAlign="right";c.fillStyle=C.ink;c.fillText("vel",PAD.l-5,veTop+9);

  if(S.anim&&S.scaleEase!=="none"){
    c.strokeStyle=C.vel;c.lineWidth=1.4;c.lineJoin="round";c.beginPath();
    for(let i=0;i<=180;i++){
      const t=i/180,y=clamp(YE(velocityAt(t,1/240)),veTop,veBot);
      i?c.lineTo(X(t),y):c.moveTo(X(t),y);
    }
    c.stroke();
    /* fill under the curve so the shape reads at a glance */
    c.lineTo(X(1),zy);c.lineTo(X(0),zy);c.closePath();
    c.fillStyle="rgba(111,214,154,.10)";c.fill();
  }

  /* ---- value curves ---- */
  const plot=(fn,col,wd,dash)=>{
    c.strokeStyle=col;c.lineWidth=wd;c.lineJoin="round";
    c.setLineDash(dash||[]);c.beginPath();
    for(let i=0;i<=180;i++){const t=i/180;c.lineTo(X(t),clamp(Y(fn(t)),vaTop-40,vaBot+40));}
    c.stroke();c.setLineDash([]);
  };
  if(S.anim&&S.fadeEase!=="none")plot(t=>EASE[S.fadeEase](t),C.fade,1.3,[3,3]);
  if(S.anim&&S.scaleEase!=="none")plot(easeProgress,C.curve,2);

  /* ---- keyframes and handles ---- */
  if(custom){
    const b=S.bezier;
    const k0=[X(0),Y(0)],k1=[X(1),Y(1)];
    const p1=[X(b[0]),Y(b[1])],p2=[X(b[2]),Y(b[3])];
    c.strokeStyle=C.axis;c.lineWidth=1;
    c.beginPath();c.moveTo(k0[0],k0[1]);c.lineTo(p1[0],p1[1]);c.stroke();
    c.beginPath();c.moveTo(k1[0],k1[1]);c.lineTo(p2[0],p2[1]);c.stroke();
    /* keyframes as diamonds, the way Premiere marks a bezier key */
    c.fillStyle=C.key;
    for(const k of [k0,k1]){
      c.beginPath();c.moveTo(k[0],k[1]-4);c.lineTo(k[0]+4,k[1]);
      c.lineTo(k[0],k[1]+4);c.lineTo(k[0]-4,k[1]);c.closePath();c.fill();
    }
    [[p1,C.h1,1],[p2,C.h2,2]].forEach(([p,col,idx])=>{
      if(sel===idx){c.strokeStyle="#FFFFFF";c.lineWidth=1.4;
        c.beginPath();c.arc(p[0],p[1],8.5,0,7);c.stroke();}
      c.fillStyle=col;c.beginPath();c.arc(p[0],p[1],5.2,0,7);c.fill();
      c.strokeStyle="#0B0C0F";c.lineWidth=1.6;c.stroke();
    });
  }

  /* ---- playhead, so the graph and the timeline read as one ---- */
  if((S.anim||S.hlAnim)&&R.frame<nf){
    const x=Math.round(X(clamp(R.frame/nf,0,1)))+.5;
    c.strokeStyle="rgba(231,233,240,.55)";c.lineWidth=1;
    c.beginPath();c.moveTo(x,vaTop);c.lineTo(x,veBot);c.stroke();
  }

  syncGraphInfo(nf,hold);
}

/* ---------- readouts ---------- */
/* Influence and Speed are AE's Keyframe Velocity fields, which is how an editor
   already thinks about an ease: how far into the segment the handle reaches, and
   how fast the value is moving as it leaves or arrives. */
export function influence(side){
  const b=S.bezier;
  return side===1?b[0]*100:(1-b[2])*100;
}
export function speed(side){
  const b=S.bezier;
  if(side===1)return b[0]<1e-4?0:b[1]/b[0];
  return (1-b[2])<1e-4?0:(1-b[3])/(1-b[2]);
}
export function setInfluence(side,pct){
  const sp=speed(side),f=clamp(pct,0,100)/100;
  if(side===1){S.bezier[0]=f;S.bezier[1]=sp*f;}
  else{S.bezier[2]=1-f;S.bezier[3]=1-sp*f;}
  afterEdit();
}
export function setSpeed(side,sp){
  const b=S.bezier;
  if(side===1)S.bezier[1]=sp*b[0];
  else S.bezier[3]=1-sp*(1-b[2]);
  afterEdit();
}
function fmt(n,dp){const v=Math.abs(n)<1e-9?0:n;return v.toFixed(dp===undefined?2:dp).replace(/\.?0+$/,"")||"0";}
export function bezText(){
  return "cubic-bezier("+S.bezier.map(v=>fmt(v)).join(", ")+")";
}
function syncGraphInfo(nf,hold){
  const info=$("#curveInfo");if(!info)return;
  if(!(S.anim||S.hlAnim)){info.textContent="Animation off — still frame only.";return;}
  let peak=1;
  for(let i=0;i<=120;i++)peak=Math.max(peak,easeProgress(i/120));
  const sc=(S.sFrom/100)+(1-S.sFrom/100)*peak;
  const f=FPS(),total=nf+hold;
  info.innerHTML="Peak <b>"+(sc*100).toFixed(1)+"%</b> &middot; "
    +nf+" animated + "+hold+" hold = <b>"+total+"f</b> &middot; "
    +(total/f).toFixed(2)+"s at "+f+"fps";
}
/* Push the curve back into the numeric fields. While the user is typing, leave
   the focused field alone or its caret jumps mid-edit — but an undo or a preset
   has to overwrite it even so, otherwise the field keeps showing a value the
   state no longer holds. */
export function syncBezFields(force){
  const set=(el,v)=>{if(el&&(force||document.activeElement!==el))el.value=v;};
  set($("#infOut"),Math.round(influence(1)));
  set($("#spdOut"),fmt(speed(1)));
  set($("#infIn"),Math.round(influence(2)));
  set($("#spdIn"),fmt(speed(2)));
  set($("#bezText"),bezText());
}
function afterEdit(){
  syncBezFields();drawGraph();scheduleDraw();
}
/* Picking a curve implies Custom ease. The control that shows the ease lives in
   panels.js, so it registers a hook rather than being imported here — that would
   close an import cycle. */
let easeHook=null;
export function setEaseHook(fn){easeHook=fn;}
export function applyCurve(v){
  S.bezier=v.slice();
  if(S.scaleEase!=="custom"){S.scaleEase="custom";if(easeHook)easeHook();}
  afterEdit();
}

/* ---------- handle dragging ---------- */
let drag=null,sel=1,dragStart=null;
function hitHandle(px,py){
  if(!(S.anim&&S.scaleEase==="custom")||!map)return 0;
  const b=S.bezier;
  const p1=[map.X(b[0]),map.Y(b[1])],p2=[map.X(b[2]),map.Y(b[3])];
  const d1=Math.hypot(px-p1[0],py-p1[1]),d2=Math.hypot(px-p2[0],py-p2[1]);
  const near=Math.min(d1,d2);
  if(near>17)return 0;
  return d1<=d2?1:2;
}
function setHandle(side,t,v){
  if(side===1){S.bezier[0]=t;S.bezier[1]=v;}
  else{S.bezier[2]=t;S.bezier[3]=v;}
}
export function initGraph(){
  const el=$("#curve");if(!el)return;
  el.setAttribute("tabindex","0");
  const local=e=>{const r=el.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};

  el.addEventListener("pointerdown",e=>{
    const [px,py]=local(e);
    const h=hitHandle(px,py);
    if(!h)return;
    sel=h;drag=h;
    /* hold the vertical range steady for the whole gesture, otherwise re-fitting
       moves the graph under the pointer and the handle appears to slip */
    frozen=fitValueRange();
    dragStart={px,py,b:S.bezier.slice()};
    el.setPointerCapture(e.pointerId);el.focus();
    e.preventDefault();drawGraph();
  });
  el.addEventListener("pointermove",e=>{
    if(!drag||!map)return;
    let [px,py]=local(e);
    if(e.shiftKey&&dragStart){
      /* constrain to whichever axis the gesture committed to */
      if(Math.abs(px-dragStart.px)>=Math.abs(py-dragStart.py))py=dragStart.py;
      else px=dragStart.px;
    }
    const t=map.T(px);
    const v=clamp(map.V(py),frozen.lo,frozen.hi);
    setHandle(drag,t,v);
    if(e.altKey){
      /* mirror the far handle — Premiere's continuous-bezier feel, and the
         quickest way to a symmetric ease in and out */
      if(drag===1){S.bezier[2]=1-t;S.bezier[3]=1-v;}
      else{S.bezier[0]=1-t;S.bezier[1]=1-v;}
    }
    afterEdit();
  });
  const up=e=>{
    if(!drag)return;
    drag=null;frozen=null;dragStart=null;
    try{el.releasePointerCapture(e.pointerId);}catch(_){}
    afterEdit();
  };
  el.addEventListener("pointerup",up);
  el.addEventListener("pointercancel",up);
  /* double-click a handle to pull it back onto its keyframe (linear that side) */
  el.addEventListener("dblclick",e=>{
    const [px,py]=local(e);
    const h=hitHandle(px,py);if(!h)return;
    if(h===1){S.bezier[0]=0;S.bezier[1]=0;}else{S.bezier[2]=1;S.bezier[3]=1;}
    afterEdit();
  });
  el.addEventListener("keydown",e=>{
    if(!(S.anim&&S.scaleEase==="custom"))return;
    const big=e.shiftKey?.05:.01;
    const b=S.bezier,ix=sel===1?0:2,iy=sel===1?1:3;
    let hit=true;
    switch(e.key){
      case "ArrowLeft":  b[ix]=clamp(b[ix]-big,0,1);break;
      case "ArrowRight": b[ix]=clamp(b[ix]+big,0,1);break;
      case "ArrowUp":    b[iy]=clamp(b[iy]+big,-1,2);break;
      case "ArrowDown":  b[iy]=clamp(b[iy]-big,-1,2);break;
      case "Tab":        if(e.shiftKey)return;sel=sel===1?2:1;break;
      default: hit=false;
    }
    if(!hit)return;
    e.preventDefault();afterEdit();
  });
  el.addEventListener("blur",()=>{drawGraph();});
}
