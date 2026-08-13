/* media.js — The media pool: images, video plates and audio.

   A shotlist can name files that do not exist yet (`src=haaland`), so clips
   store the *name* and resolve it here. Matching is deliberately loose —
   exact key, then prefix, then substring — because what a script calls
   "haaland" arrives from a phone as "IMG_4471 haaland.jpeg". */

const AC=window.AudioContext||window.webkitAudioContext;
export const MEDIA={items:new Map()};
let actx=null;
export function audioCtx(){
  if(!actx&&AC)actx=new AC();
  if(actx&&actx.state==="suspended")actx.resume();
  return actx;
}

export const keyOf=name=>String(name||"").replace(/\.[a-z0-9]{2,5}$/i,"")
  .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

function kindOf(file){
  const t=file.type||"";
  if(t.startsWith("image/"))return "image";
  if(t.startsWith("video/"))return "video";
  if(t.startsWith("audio/"))return "audio";
  if(/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(file.name))return "image";
  if(/\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name))return "video";
  if(/\.(wav|mp3|m4a|aac|ogg|flac|opus)$/i.test(file.name))return "audio";
  return "";
}

export async function addFiles(files,onProgress){
  const out=[];
  for(const f of Array.from(files||[])){
    const kind=kindOf(f);
    if(!kind)continue;
    try{
      const item=await load(f,kind);
      MEDIA.items.set(item.key,item);
      out.push(item);
      onProgress&&onProgress(item);
    }catch(e){ /* one bad file must not stop a drop of twenty */ }
  }
  return out;
}

async function load(file,kind){
  const url=URL.createObjectURL(file);
  const base={key:keyOf(file.name),name:file.name,kind,url,file,size:file.size};
  if(kind==="image"){
    const img=await new Promise((res,rej)=>{
      const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
    return {...base,el:img,w:img.naturalWidth,h:img.naturalHeight};
  }
  if(kind==="video"){
    const v=document.createElement("video");
    v.src=url;v.muted=true;v.playsInline=true;v.preload="auto";
    /* Never let a video element carry audio into the mix — the plate is muted
       by design and the voiceover is the only thing that should be heard. */
    v.volume=0;
    await new Promise((res,rej)=>{
      v.onloadedmetadata=()=>res();v.onerror=()=>rej(new Error("video"));
      setTimeout(res,6000);
    });
    /* A second element seeks for the exporter so preview playback keeps its
       own position and the two never fight over currentTime. */
    const ex=document.createElement("video");
    ex.src=url;ex.muted=true;ex.playsInline=true;ex.preload="auto";ex.volume=0;
    return {...base,el:v,ex,w:v.videoWidth||1920,h:v.videoHeight||1080,dur:v.duration||0};
  }
  const buf=await file.arrayBuffer();
  const ctx=audioCtx();
  let ab=null;
  if(ctx){try{ab=await ctx.decodeAudioData(buf.slice(0));}catch(_){ab=null;}}
  return {...base,buffer:ab,dur:ab?ab.duration:0,peaks:ab?peaksOf(ab,1400):null,raw:buf};
}

function peaksOf(ab,n){
  const ch=ab.getChannelData(0),step=Math.max(1,Math.floor(ch.length/n)),out=new Float32Array(n);
  for(let i=0;i<n;i++){
    let m=0;const s=i*step,e=Math.min(ch.length,s+step);
    for(let j=s;j<e;j+=3){const v=Math.abs(ch[j]);if(v>m)m=v;}
    out[i]=m;
  }
  return out;
}

/* Loose lookup — see the header. Returns null rather than throwing so a
   missing asset renders as a placeholder instead of stopping the frame. */
export function get(name,kind){
  if(!name)return null;
  const k=keyOf(name);
  if(!k)return null;
  const it=MEDIA.items.get(k);
  if(it&&(!kind||it.kind===kind))return it;
  let best=null;
  for(const m of MEDIA.items.values()){
    if(kind&&m.kind!==kind)continue;
    if(m.key===k)return m;
    if(m.key.startsWith(k)||k.startsWith(m.key)){best=best||m;continue;}
    if(m.key.includes(k)||k.includes(m.key))best=best||m;
  }
  return best;
}
export function list(kind){
  return [...MEDIA.items.values()].filter(m=>!kind||m.kind===kind);
}

/* ---------- video seeking ----------
   Frame-exact export means asking for one time and waiting for it. Playback
   rate tricks are faster and non-deterministic; a dropped plate frame is the
   kind of bug you only notice after upload. */
export function seek(video,t){
  return new Promise(res=>{
    if(!video){res();return;}
    const target=Math.max(0,Math.min(t,(video.duration||1e9)-1/1000));
    if(video.readyState>=2&&Math.abs(video.currentTime-target)<1e-3){res();return;}
    let done=false;
    const finish=()=>{if(done)return;done=true;
      video.removeEventListener("seeked",finish);
      video.removeEventListener("loadeddata",finish);
      clearTimeout(timer);res();};
    video.addEventListener("seeked",finish);
    video.addEventListener("loadeddata",finish);
    const timer=setTimeout(finish,1200);
    try{video.currentTime=target;}catch(_){finish();}
  });
}

/* ---------- audio playback (preview) ----------
   WebAudio rather than an <audio> element: scrubbing needs to start mid-buffer
   at an exact offset, which `currentTime` on an element only approximates. */
let nodes=[];
export function stopAudio(){
  for(const n of nodes){try{n.stop();}catch(_){}}
  nodes=[];
}
export function playAudio(tracks,fromSec){
  stopAudio();
  const ctx=audioCtx();
  if(!ctx)return;
  for(const t of tracks){
    const item=t.item;
    if(!item||!item.buffer)continue;
    const off=fromSec-(t.at||0);
    if(off>=item.buffer.duration)continue;
    const src=ctx.createBufferSource();
    src.buffer=item.buffer;
    const g=ctx.createGain();
    g.gain.value=Math.max(0,(t.gain==null?100:t.gain)/100);
    src.connect(g).connect(ctx.destination);
    if(off>=0)src.start(ctx.currentTime,off);
    else src.start(ctx.currentTime-off);
    nodes.push(src);
  }
}
export function releaseAll(){
  stopAudio();
  for(const m of MEDIA.items.values())URL.revokeObjectURL(m.url);
  MEDIA.items.clear();
}
