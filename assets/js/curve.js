/* curve.js — Motion graph, draggable bezier handles and the preview draw loop. */
/* ---------- bezier / curve editor ---------- */
const BEZ_BUILTIN=[
  ["Ease out back",[.34,1.56,.64,1]],
  ["Ease in-out",[.65,0,.35,1]],
  ["Ease out",[.16,1,.3,1]],
  ["Soft overshoot",[.2,1.3,.4,1]],
  ["Snappy",[.5,1.8,.5,1]],
  ["Linear",[0,0,1,1]]
];
function loadBez(){try{return JSON.parse(localStorage.getItem("qs-bez")||"[]");}catch(_){return [];}}
function saveBez(list){try{localStorage.setItem("qs-bez",JSON.stringify(list));}catch(_){}}
function allBez(){return BEZ_BUILTIN.concat(loadBez());}
function refreshBezSelect(){
  const sel=$("#bezPreset");sel.innerHTML="";
  allBez().forEach((b,i)=>{const o=document.createElement("option");o.value=i;o.textContent=b[0];sel.appendChild(o);});
}
let bezDrag=null;
function drawCurve(){
  const el=$("#curve");if(!el.offsetParent)return;
  /* draw in CSS pixels at device resolution so the labels stay legible */
  const W=el.clientWidth||340,H=el.clientHeight||132;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
  if(el.width!==pw||el.height!==ph){el.width=pw;el.height=ph;}
  const c=el.getContext("2d");
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const pl=32,pr=10,pt=12,gh=H-26,gw=W-pl-pr;
  const custom=S.anim&&S.scaleEase==="custom";
  c.strokeStyle="#262A33";c.lineWidth=1;
  for(let i=0;i<=4;i++){const yy=pt+gh*i/4;c.beginPath();c.moveTo(pl,yy+.5);c.lineTo(W-pr,yy+.5);c.stroke();}
  c.fillStyle="#6B7183";c.font="9px "+SANS;
  c.fillText("100%",2,pt+3);c.fillText("0",2,pt+gh+3);
  /* scale curve auto-range */
  let peak=1,peakT=0;
  const sfn=t=>{const v=scaleFn(t);if(v>peak){peak=v;peakT=t;}return v;};
  for(let i=0;i<=240;i++)sfn(i/240);
  const lo=Math.min(0.6,S.sFrom/100-0.02),hi=Math.max(1.02,peak+0.03),span=hi-lo;
  const Y=v=>pt+gh-gh*((v-lo)/span);
  const y100=Y(1);
  c.strokeStyle="#3A4050";c.setLineDash([4,4]);c.beginPath();c.moveTo(pl,y100);c.lineTo(W-pr,y100);c.stroke();c.setLineDash([]);
  const plot=(fn,col,wd)=>{c.strokeStyle=col;c.lineWidth=wd;c.lineJoin="round";c.beginPath();
    for(let i=0;i<=180;i++){const t=i/180,x=pl+gw*t,y=Y(fn(t));i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();};
  plot(t=>0.6+0.4*(S.anim&&S.fadeEase!=="none"?EASE[S.fadeEase](t):1),"#5A6480",1.5);
  plot(sfn,"#7D93FF",2);
  if(custom){
    /* editable handles on a -0.4..1.9 vertical box — wide enough for every preset's overshoot */
    const b=S.bezier;
    const HX=t=>pl+gw*t, HY=v=>pt+gh-gh*((v+0.4)/2.3);
    const p0=[HX(0),HY(0)],p3=[HX(1),HY(1)],p1=[HX(b[0]),HY(b[1])],p2=[HX(b[2]),HY(b[3])];
    c.strokeStyle="#4B5470";c.lineWidth=1;
    c.beginPath();c.moveTo(p0[0],p0[1]);c.lineTo(p1[0],p1[1]);c.stroke();
    c.beginPath();c.moveTo(p3[0],p3[1]);c.lineTo(p2[0],p2[1]);c.stroke();
    [[p1,"#7D93FF"],[p2,"#FFA8C5"]].forEach(([p,col])=>{
      c.fillStyle=col;c.beginPath();c.arc(p[0],p[1],5,0,7);c.fill();
      c.strokeStyle="#0B0C0F";c.lineWidth=1.5;c.stroke();});
    el._map={HX,HY,pl,pr,pt,gh,gw};
  }
  const fps=+S.fps,af=Math.max(1,Math.round(animEndSec()*fps));
  $("#curveInfo").innerHTML=(S.anim||S.hlAnim)
    ? "Peak scale <b>"+(peak*100).toFixed(1)+"%</b> at "+(peakT*100).toFixed(0)+"% &middot; "
      +af+" animated + "+S.hold+" hold = <b>"+(af+S.hold)+" frames</b> at "+fps+"fps"
    : "Animation off — still frame only.";
}
(function bezierInteractions(){
  const el=$("#curve");
  const toState=(e)=>{
    if(!(S.anim&&S.scaleEase==="custom")||!el._map)return null;
    const r=el.getBoundingClientRect(),m=el._map;
    /* the graph is drawn in CSS pixels, so pointer coords map 1:1 */
    return {px:e.clientX-r.left,py:e.clientY-r.top,m};
  };
  el.addEventListener("pointerdown",e=>{
    const s=toState(e);if(!s)return;const {px,py,m}=s,b=S.bezier;
    const p1=[m.HX(b[0]),m.HY(b[1])],p2=[m.HX(b[2]),m.HY(b[3])];
    const d1=Math.hypot(px-p1[0],py-p1[1]),d2=Math.hypot(px-p2[0],py-p2[1]);
    if(Math.min(d1,d2)>16)return;
    bezDrag=d1<d2?1:2;el.setPointerCapture(e.pointerId);e.preventDefault();
  });
  el.addEventListener("pointermove",e=>{
    if(!bezDrag)return;const s=toState(e);if(!s)return;const {px,py,m}=s;
    const t=clamp((px-m.pl)/m.gw,0,1);
    const v=clamp(-0.4+2.3*(1-(py-m.pt)/m.gh),-0.4,1.9);
    if(bezDrag===1){S.bezier[0]=t;S.bezier[1]=v;}else{S.bezier[2]=t;S.bezier[3]=v;}
    drawCurve();scheduleDraw();
  });
  const up=e=>{if(bezDrag){bezDrag=null;try{el.releasePointerCapture(e.pointerId);}catch(_){}}};
  el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up);
})();

/* ---------- preview ---------- */
function viewBox(L){
  if(S.view==="card"){const m=Math.round(L.fs*0.85);
    return {x:L.x-m,y:L.y-m,w:L.cardW+m*2,h:L.cardH+m*2};}
  return {x:0,y:0,w:FW,h:FH};
}
function draw(){
  const L=fitLayoutCached(),vb=viewBox(L);
  const stage=document.querySelector(".stage");
  const vh=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--vh"))||window.innerHeight;
  const availW=Math.max(140,stage.clientWidth-(isPhone()?28:44));
  const maxH=isPhone()?Math.max(160,stage.clientHeight-70):Math.max(200,stage.clientHeight-92);
  const w=Math.min(availW,maxH*vb.w/vb.h),h=w*vb.h/vb.w;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cv.style.width=Math.round(w)+"px";cv.style.height=Math.round(h)+"px";
  const pw=Math.round(w*dpr),ph=Math.round(h*dpr);
  if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}
  let A={alpha:1,scale:1,dy:0,hp:1};
  if(playing){
    const end=animEndSec(),tail=S.hold/(+S.fps),el=(performance.now()-playT0)/1000;
    if(el>end+tail+0.6)playT0=performance.now();
    A=animAt(el);
  }
  paint(ctx,pw/vb.w,L,{tx:-vb.x,ty:-vb.y,guides:S.guides&&S.view==="frame",anim:A});
  const k=parseFloat(S.res),m=Math.round(L.fs*1.35);
  $("#rOut").textContent=(S.crop==="card"
    ? Math.round((L.cardW+m*2)*k)+"×"+Math.round((L.cardH+m*2)*k)
    : (FW*k)+"×"+(FH*k))+((S.anim||S.hlAnim)&&S.format!=="still"?" · "+totalFrames()+"f":"");
  const f=$("#rFit");
  f.textContent=L.overflow?L.fs+" too long":(L.fitted?L.fs+" fit":String(L.fs));
  f.className=L.overflow?"warn":"";
  if($("#curve").offsetParent)drawCurve();
  syncWords();
  if(playing)requestAnimationFrame(draw);
}

