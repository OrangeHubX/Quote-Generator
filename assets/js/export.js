/* export.js — Zip writer, GIF encoder and the still/sequence/video export paths. */
import {$, FH, FW, S, d} from './data.js';
import {animAt, animEndSec, fitLayout, paint, totalFrames} from './layout.js';

/* ---------- zip ---------- */
const CRC=(()=>{const t=new Uint32Array(256);
  for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c>>>0;}return t;})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function makeZip(files){
  const enc=new TextEncoder(),parts=[],cd=[],now=new Date();
  const tm=((now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2))&0xFFFF;
  const dt=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate())&0xFFFF;
  let off=0;
  for(const f of files){
    const nm=enc.encode(f.name),data=f.data,cr=crc32(data);
    const lh=new Uint8Array(30+nm.length),v=new DataView(lh.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(10,tm,true);v.setUint16(12,dt,true);
    v.setUint32(14,cr,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,nm.length,true);
    lh.set(nm,30);parts.push(lh,data);
    const ch=new Uint8Array(46+nm.length),w=new DataView(ch.buffer);
    w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);
    w.setUint16(12,tm,true);w.setUint16(14,dt,true);w.setUint32(16,cr,true);
    w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,nm.length,true);
    w.setUint32(42,off,true);ch.set(nm,46);cd.push(ch);off+=lh.length+data.length;
  }
  const cdSize=cd.reduce((a,c)=>a+c.length,0);
  const e=new Uint8Array(22),ev=new DataView(e.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true);ev.setUint32(16,off,true);
  return new Blob([...parts,...cd,e],{type:"application/zip"});
}

/* ---------- GIF encoder (median-cut + LZW, 1-bit alpha) ---------- */
function quantize(frames,w,h){
  /* collect opaque pixels, median-cut to 255 colours; index 0 reserved transparent */
  const box=[]; const step=Math.max(1,Math.floor(frames.length*w*h/60000));
  let cnt=0;
  for(const fr of frames){const d=fr.data;for(let i=0;i<d.length;i+=4){ if(d[i+3]<128)continue; if((cnt++%step))continue; box.push([d[i],d[i+1],d[i+2]]); }}
  if(!box.length)box.push([255,255,255]);
  const boxes=[box];
  const medianCut=(bx)=>{
    let rmin=255,rmax=0,gmin=255,gmax=0,bmin=255,bmax=0;
    for(const p of bx){rmin=Math.min(rmin,p[0]);rmax=Math.max(rmax,p[0]);gmin=Math.min(gmin,p[1]);gmax=Math.max(gmax,p[1]);bmin=Math.min(bmin,p[2]);bmax=Math.max(bmax,p[2]);}
    const rr2=rmax-rmin,gg=gmax-gmin,bb=bmax-bmin,ch=rr2>=gg&&rr2>=bb?0:gg>=bb?1:2;
    bx.sort((a,b)=>a[ch]-b[ch]);const mid=bx.length>>1;return [bx.slice(0,mid),bx.slice(mid)];
  };
  while(boxes.length<255){
    let idx=-1,best=-1;
    for(let i=0;i<boxes.length;i++)if(boxes[i].length>best&&boxes[i].length>1){best=boxes[i].length;idx=i;}
    if(idx<0)break;const [a,b]=medianCut(boxes[idx]);if(!a.length||!b.length){boxes[idx]=boxes[idx].slice(0,1);continue;}
    boxes.splice(idx,1,a,b);
  }
  const pal=[[0,0,0]]; /* index0 transparent placeholder */
  for(const bx of boxes){let r=0,g=0,b=0;for(const p of bx){r+=p[0];g+=p[1];b+=p[2];}const n=bx.length||1;pal.push([r/n|0,g/n|0,b/n|0]);}
  while(pal.length<256)pal.push([0,0,0]);
  return pal;
}
function nearest(pal,r,g,b){
  let bi=1,bd=1e12;
  for(let i=1;i<pal.length;i++){const p=pal[i],dr=p[0]-r,dg=p[1]-g,db=p[2]-b,dd=dr*dr+dg*dg+db*db;if(dd<bd){bd=dd;bi=i;}}
  return bi;
}
function lzwEncode(idx,minCode){
  const out=[];let cur=0,curBits=0;
  const clear=1<<minCode,eoi=clear+1;let size=minCode+1,next=eoi+1;
  let dict=new Map();const reset=()=>{dict=new Map();for(let i=0;i<clear;i++)dict.set(String(i),i);next=eoi+1;size=minCode+1;};
  const push=code=>{cur|=code<<curBits;curBits+=size;while(curBits>=8){out.push(cur&255);cur>>=8;curBits-=8;}};
  reset();push(clear);
  let prev=String(idx[0]);
  for(let i=1;i<idx.length;i++){
    const k=idx[i],comb=prev+","+k;
    if(dict.has(comb))prev=comb;
    else{push(dict.get(prev));dict.set(comb,next++);if(next>(1<<size)&&size<12)size++;
      if(next>4095){push(clear);reset();}prev=String(k);}
  }
  push(dict.get(prev));push(eoi);
  if(curBits>0)out.push(cur&255);
  return out;
}
function encodeGif(frames,w,h,delayCs){
  const pal=quantize(frames,w,h);
  const bytes=[];const put=a=>{for(const x of a)bytes.push(x&255);};
  const putStr=s=>{for(let i=0;i<s.length;i++)bytes.push(s.charCodeAt(i));};
  putStr("GIF89a");
  put([w&255,w>>8,h&255,h>>8]);
  put([0xF7,0,0]); /* global colour table, 256 */
  for(let i=0;i<256;i++){const p=pal[i]||[0,0,0];put([p[0],p[1],p[2]]);}
  /* netscape loop */
  put([0x21,0xFF,11]);putStr("NETSCAPE2.0");put([3,1,0,0,0]);
  for(const fr of frames){
    /* graphic control: transparent index 0 */
    put([0x21,0xF9,4,0x05,delayCs&255,delayCs>>8,0,0]);
    put([0x2C,0,0,0,0,w&255,w>>8,h&255,h>>8,0]);
    const d=fr.data,idx=new Uint8Array(w*h);
    for(let i=0,j=0;i<d.length;i+=4,j++){ idx[j]=d[i+3]<128?0:nearest(pal,d[i],d[i+1],d[i+2]); }
    const minCode=8;bytes.push(minCode);
    const lzw=lzwEncode(idx,minCode);
    for(let i=0;i<lzw.length;i+=255){const chunk=lzw.slice(i,i+255);bytes.push(chunk.length);for(const b of chunk)bytes.push(b);}
    bytes.push(0);
  }
  bytes.push(0x3B);
  return new Blob([new Uint8Array(bytes)],{type:"image/gif"});
}

/* ---------- export ---------- */
function makeCanvas(L,k){
  const out=document.createElement("canvas");
  if(S.crop==="card"){
    const m=Math.round(L.fs*1.35);
    out.width=Math.round((L.cardW+m*2)*k);out.height=Math.round((L.cardH+m*2)*k);
    out._tx=-L.x+m;out._ty=-L.y+m;
  }else{out.width=FW*k;out.height=FH*k;out._tx=0;out._ty=0;}
  return out;
}
function saveBlob(b,name){
  const u=URL.createObjectURL(b),a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),8000);
}
function baseName(){
  const custom=(S.exportName||"").trim();
  if(custom)return custom.replace(/[^a-z0-9\-_ ]/gi,"").replace(/\s+/g,"-").toLowerCase()||"slate";
  const src=d().social?(S.name+" "+S.text):S.text;
  return "slate-"+((src.trim().split(/\s+/).slice(0,4).join("-")||"quote").replace(/[^a-z0-9\-]/gi,"").toLowerCase());
}
export function snack(m,keep){
  const t=$("#snack");t.textContent=m;t.classList.add("on");
  clearTimeout(snack._t);if(!keep)snack._t=setTimeout(()=>t.classList.remove("on"),3200);
}
function stillMime(){return S.imgFmt==="jpeg"?"image/jpeg":"image/png";}
function stillExt(){return S.imgFmt==="jpeg"?".jpg":".png";}
async function exportStill(){
  const k=parseFloat(S.res),L=fitLayout(document.createElement("canvas").getContext("2d"));
  const out=makeCanvas(L,k);
  if(S.imgFmt==="jpeg"&&S.bg==="transparent"){ /* JPEG has no alpha */ out.getContext("2d").fillStyle="#FFFFFF";out.getContext("2d").fillRect(0,0,out.width,out.height); }
  paint(out.getContext("2d"),k,L,{tx:out._tx,ty:out._ty,anim:animAt(1e4)});
  const b=await new Promise(r=>out.toBlob(r,stillMime(),S.jq/100));
  if(!b){snack("Export failed.");return;}
  saveBlob(b,baseName()+stillExt());snack("Saved "+out.width+"×"+out.height+" "+S.imgFmt.toUpperCase());
}
function frameSecs(){
  const fps=+S.fps,n=totalFrames(),end=animEndSec(),af=Math.max(1,Math.round(end*fps));
  const secs=[];for(let i=0;i<n;i++)secs.push(i<af?(i/fps):end+ (i-af+1)/fps);
  return {fps,n,secs};
}
async function exportSeq(){
  const k=parseFloat(S.res),L=fitLayout(document.createElement("canvas").getContext("2d"));
  const out=makeCanvas(L,k),c=out.getContext("2d");
  const {n,secs}=frameSecs(),files=[],base=baseName();
  for(let i=0;i<n;i++){
    paint(c,k,L,{tx:out._tx,ty:out._ty,anim:animAt(secs[i])});
    const b=await new Promise(r=>out.toBlob(r,"image/png"));
    files.push({name:base+"_"+String(i).padStart(4,"0")+".png",data:new Uint8Array(await b.arrayBuffer())});
    snack("Rendering frame "+(i+1)+" of "+n,true);
    if(i%3===0)await new Promise(r=>setTimeout(r,0));
  }
  saveBlob(makeZip(files),base+"_seq.zip");
  snack(n+" frames saved — import frame 0000 with Image Sequence ticked");
}
async function exportGif(){
  const k=Math.min(parseFloat(S.res),1); /* GIF at 1080-scale max for sanity */
  const L=fitLayout(document.createElement("canvas").getContext("2d"));
  const out=makeCanvas(L,k),c=out.getContext("2d");
  const {fps,n,secs}=frameSecs(),frames=[],base=baseName();
  const delay=Math.max(2,Math.round(100/fps));
  for(let i=0;i<n;i++){
    paint(c,k,L,{tx:out._tx,ty:out._ty,anim:animAt(secs[i])});
    frames.push(c.getImageData(0,0,out.width,out.height));
    snack("Rendering GIF frame "+(i+1)+" of "+n,true);
    if(i%2===0)await new Promise(r=>setTimeout(r,0));
  }
  snack("Encoding GIF …",true);
  await new Promise(r=>setTimeout(r,20));
  const blob=encodeGif(frames,out.width,out.height,delay);
  saveBlob(blob,base+".gif");
  snack("Saved "+out.width+"×"+out.height+" GIF ("+n+" frames)");
}
async function exportWebm(){
  if(typeof MediaRecorder==="undefined"||!HTMLCanvasElement.prototype.captureStream){snack("This browser can't record video. Use Sequence.");return;}
  const k=parseFloat(S.res),L=fitLayout(document.createElement("canvas").getContext("2d"));
  const out=makeCanvas(L,k),c=out.getContext("2d");
  const fps=+S.fps,end=animEndSec(),tail=S.hold/fps;
  const mt=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mt){snack("WebM not supported here. Use Sequence.");return;}
  const stream=out.captureStream(0),track=stream.getVideoTracks()[0];
  const rec=new MediaRecorder(stream,{mimeType:mt,videoBitsPerSecond:24e6}),chunks=[];
  rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const done=new Promise(r=>rec.onstop=r);
  rec.start();const t0=performance.now();
  await new Promise(res=>{(function frame(){
    const el=(performance.now()-t0)/1000;
    paint(c,k,L,{tx:out._tx,ty:out._ty,anim:animAt(el)});
    if(track.requestFrame)track.requestFrame();
    snack("Recording "+Math.min(100,Math.round(el/(end+tail)*100))+"%",true);
    if(el<end+tail)requestAnimationFrame(frame);else res();
  })();});
  rec.stop();await done;
  saveBlob(new Blob(chunks,{type:mt}),baseName()+".webm");
  snack("Saved WebM — check it imports before relying on it");
}
$("#dl").addEventListener("click",async()=>{
  const b=$("#dl");b.disabled=true;
  try{
    if(S.format==="still")await exportStill();
    else if(S.format==="seq")await exportSeq();
    else if(S.format==="gif")await exportGif();
    else await exportWebm();
  }catch(e){snack("Export failed: "+e.message);}
  b.disabled=false;
});

