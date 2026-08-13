/* output.js — Turning the sequence into a file.

   The whole export is a loop of "park the plate, paint the frame, hand it to
   the encoder". Nothing is real-time: a frame that takes 300ms to seek and
   render still lands on its own tick, so a slow machine produces a slower
   export rather than a dropped frame. That is the entire reason this does not
   use MediaRecorder.

   Audio is mixed and encoded up front, before the first frame is drawn. It is
   cheap, it fails fast if the browser cannot do AAC, and it keeps the audio
   encoder off the critical path while the video loop hogs the main thread. */

import {SEQ, audioClips, clipsAt, seqDur, srcTime} from './model.js';
import {renderFrame} from './draw.js';
import {get, seek} from './media.js';
import {Mp4Muxer, audioSupported, encodeAudio, pickVideoCodec, ytBitrate} from './mp4.js';
import {makeZip, saveBlob} from '../export.js';

export {ytBitrate};
const RATE=48000;
export const hasWebCodecs=()=>typeof VideoEncoder!=="undefined"&&typeof VideoFrame!=="undefined";

/* ---------- audio ---------- */
export async function mixAudio(dur){
  const clips=audioClips().filter(c=>{const m=get(c.props.src,"audio");return m&&m.buffer;});
  if(!clips.length)return null;
  const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!OAC)return null;
  const ctx=new OAC(2,Math.max(1,Math.ceil(dur*RATE)),RATE);
  for(const c of clips){
    const item=get(c.props.src,"audio");
    const t0=Math.max(0,c.t0);
    const len=Math.min(c.t1,dur)-t0;
    if(len<=0)continue;
    const src=ctx.createBufferSource();
    src.buffer=item.buffer;
    const g=ctx.createGain();
    const gv=Math.max(0,(c.props.gain==null?100:c.props.gain)/100);
    const fi=Math.min(c.props.fadeIn||0,len/2),fo=Math.min(c.props.fadeOut||0,len/2);
    g.gain.setValueAtTime(fi>0?0.0001:gv,t0);
    if(fi>0)g.gain.linearRampToValueAtTime(gv,t0+fi);
    if(fo>0){g.gain.setValueAtTime(gv,t0+len-fo);g.gain.linearRampToValueAtTime(0.0001,t0+len);}
    src.connect(g).connect(ctx.destination);
    src.start(t0,Math.max(0,c.props.srcIn||0),len);
  }
  return await ctx.startRendering();
}

/* ---------- plate parking ----------
   A plate shorter than the read loops rather than freezing on its last frame —
   30 seconds of gameplay under a 40-second script is the normal case, not an
   error worth stopping for. */
export async function parkPlate(t,forExport){
  const bg=clipsAt(t,"bg")[0];
  if(!bg)return;
  const item=get(bg.props.src,"video");
  if(!item)return;
  const el=forExport&&item.ex?item.ex:item.el;
  const d=item.dur||el.duration||0;
  let st=srcTime(bg,t);
  if(d>0.1)st=st%d;
  await seek(el,Math.max(0,st));
}

/* ---------- MP4 ---------- */
export async function exportMp4(opt,report){
  const W=opt.w,H=opt.h,fps=opt.fps||SEQ.fps||30;
  const bitrate=Math.round(opt.bitrate||ytBitrate(W,H,fps));
  const dur=opt.dur||seqDur();
  const n=Math.max(1,Math.round(dur*fps));
  const say=m=>report&&report(m);

  const cfg=await pickVideoCodec(W,H,fps,bitrate);
  if(!cfg)throw new Error("This browser can't encode H.264 at "+W+"×"+H+". Try Chrome, or export frames.");

  say({phase:"audio",p:0,label:"Mixing audio"});
  const mixed=await mixAudio(dur);
  const acfg=mixed?await audioSupported(RATE,2,opt.audioBitrate||384000):null;

  const muxer=new Mp4Muxer({width:W,height:H,fps,
    audio:acfg?{sampleRate:RATE,channels:2,bitrate:opt.audioBitrate||384000}:null});
  if(mixed&&acfg)await encodeAudio(muxer,mixed,acfg,p=>say({phase:"audio",p,label:"Encoding audio"}));
  else if(mixed&&!acfg)say({phase:"warn",label:"No AAC encoder here — the MP4 will be silent."});

  const cv=document.createElement("canvas");
  cv.width=W;cv.height=H;
  const c=cv.getContext("2d",{alpha:false});
  c.imageSmoothingQuality="high";

  let failed=null;
  const enc=new VideoEncoder({output:(ch,m)=>muxer.addVideo(ch,m),error:e=>{failed=e;}});
  enc.configure(cfg);
  const gop=Math.max(1,Math.round(fps*2));
  const frameUs=1e6/fps;

  for(let i=0;i<n;i++){
    if(opt.stopped&&opt.stopped()){try{enc.close();}catch(_){}throw new Error("cancelled");}
    if(failed)break;
    const t=i/fps;
    await parkPlate(t,true);
    renderFrame(c,W,H,t,{exporting:true});
    const vf=new VideoFrame(cv,{timestamp:Math.round(i*frameUs),duration:Math.round(frameUs)});
    enc.encode(vf,{keyFrame:i%gop===0});
    vf.close();
    /* Backpressure: let the encoder drain rather than queueing 900 raw 4K
       frames, which is how a tab runs out of memory mid-export. */
    while(enc.encodeQueueSize>4&&!failed)await new Promise(r=>setTimeout(r,3));
    if((i&7)===0)say({phase:"video",p:i/n,frame:i+1,total:n,label:"Rendering"});
  }
  if(failed)throw failed;
  await enc.flush();
  enc.close();
  if(failed)throw failed;
  say({phase:"mux",p:1,label:"Writing the file"});
  return muxer.finalize();
}

/* ---------- fallback: frames + a WAV ----------
   Used when the browser has no VideoEncoder. It still gets the job finished —
   the sequence lands in Premiere as an image sequence with its own audio, at
   the same size and frame rate the MP4 would have been. */
export async function exportFrames(opt,report){
  const W=opt.w,H=opt.h,fps=opt.fps||30,dur=opt.dur||seqDur();
  const n=Math.max(1,Math.round(dur*fps));
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const c=cv.getContext("2d",{alpha:false});
  const base=safeName(SEQ.title||"sequence");
  const files=[];
  for(let i=0;i<n;i++){
    if(opt.stopped&&opt.stopped())throw new Error("cancelled");
    const t=i/fps;
    await parkPlate(t,true);
    renderFrame(c,W,H,t,{exporting:true});
    const b=await new Promise(r=>cv.toBlob(r,"image/png"));
    files.push({name:base+"/"+base+"_"+String(i).padStart(5,"0")+".png",
      data:new Uint8Array(await b.arrayBuffer())});
    report&&report({phase:"video",p:i/n,frame:i+1,total:n,label:"Rendering frames"});
    if((i&3)===0)await new Promise(r=>setTimeout(r,0));
  }
  const mixed=await mixAudio(dur);
  if(mixed)files.push({name:base+"/"+base+"_audio.wav",data:wavOf(mixed)});
  files.push({name:base+"/_import.txt",data:new TextEncoder().encode(
    "Import "+base+"_00000.png with Image Sequence ticked and interpret at "+fps+" fps.\n"+
    (mixed?"Then drop "+base+"_audio.wav on the audio track at 00:00.\n"
          :"There is no audio in this sequence, so no WAV was written.\n"))});
  report&&report({phase:"mux",p:1,label:"Zipping"});
  return makeZip(files);
}
export function wavOf(buf){
  const ch=Math.min(2,buf.numberOfChannels),n=buf.length,rate=buf.sampleRate;
  const bytes=44+n*ch*2,out=new Uint8Array(bytes),v=new DataView(out.buffer);
  const tag=(o,s)=>{for(let i=0;i<s.length;i++)out[o+i]=s.charCodeAt(i);};
  tag(0,"RIFF");v.setUint32(4,bytes-8,true);tag(8,"WAVE");tag(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate*ch*2,true);
  v.setUint16(32,ch*2,true);v.setUint16(34,16,true);
  tag(36,"data");v.setUint32(40,n*ch*2,true);
  const planes=[];for(let i=0;i<ch;i++)planes.push(buf.getChannelData(i));
  let o=44;
  for(let i=0;i<n;i++)for(let cI=0;cI<ch;cI++){
    let s=planes[cI][i];s=s<-1?-1:s>1?1:s;
    v.setInt16(o,s<0?s*0x8000:s*0x7FFF,true);o+=2;
  }
  return out;
}
export const safeName=s=>String(s||"sequence").trim()
  .replace(/[^a-z0-9\-_ ]/gi,"").replace(/\s+/g,"-").toLowerCase()||"sequence";
export {saveBlob};
