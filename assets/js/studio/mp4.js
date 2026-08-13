/* mp4.js — H.264 + AAC encoding and a real MP4 to put them in.

   WebCodecs gives encoded chunks, not a file, so there has to be a muxer. This
   one writes a plain (non-fragmented) MP4 with `moov` in front of `mdat`, which
   is what "faststart" means and what YouTube and Premiere both prefer: no
   index-hunting at the end of a 170MB file.

   Two decisions worth knowing about:

   • The media timescale for video is the frame rate itself and every sample
     lasts exactly one tick. Frames are rendered deterministically, one per
     tick, so there is no reason to carry microsecond timestamps into the
     sample table and every reason not to — integer durations cannot drift.

   • Samples are interleaved in one-second chunks rather than written as two
     giant runs. It costs one extra `stsc` entry and makes the file behave in a
     player that streams rather than loads.

   `stco` is 32-bit, so the ceiling is 4GB — about 12 minutes at the 4K bitrate
   below. `finalize()` refuses rather than writing a file with wrapped offsets. */

/* ---------- byte plumbing ---------- */
const enc=new TextEncoder();
function concat(parts){
  let n=0;for(const p of parts)n+=p.length;
  const out=new Uint8Array(n);let o=0;
  for(const p of parts){out.set(p,o);o+=p.length;}
  return out;
}
const u8=(...a)=>new Uint8Array(a);
function u16(n){return u8((n>>8)&255,n&255);}
function u32(n){return u8((n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255);}
function box(type,...parts){
  const body=concat(parts.filter(Boolean));
  return concat([u32(body.length+8),enc.encode(type),body]);
}
function full(type,version,flags,...parts){
  return box(type,u8(version,(flags>>16)&255,(flags>>8)&255,flags&255),...parts);
}
const ZERO=n=>new Uint8Array(n);
/* Unity matrix, 16.16/2.30 fixed point — every mp4 carries one. */
const MATRIX=concat([u32(0x00010000),u32(0),u32(0),u32(0),u32(0x00010000),u32(0),
                     u32(0),u32(0),u32(0x40000000)]);

/* ---------- descriptors (esds) ---------- */
function desc(tag,payload){
  /* Lengths here are always well under 128 bytes, so one length byte is enough
     and the multi-byte continuation form is not worth carrying. */
  return concat([u8(tag),u8(payload.length),payload]);
}
function esds(asc,bitrate){
  const dsi=desc(0x05,asc);
  const dcd=desc(0x04,concat([
    u8(0x40),            /* MPEG-4 Audio */
    u8(0x15),            /* audio stream */
    u8(0,0,0),           /* buffer size */
    u32(bitrate||0),u32(bitrate||0),
    dsi
  ]));
  const sl=desc(0x06,u8(0x02));
  const es=desc(0x03,concat([u16(2),u8(0),dcd,sl]));
  return full("esds",0,0,es);
}

/* ---------- the muxer ---------- */
export class Mp4Muxer{
  constructor(o){
    this.w=o.width;this.h=o.height;this.fps=o.fps;
    this.movieTs=1000;
    this.video={samples:[],ts:o.fps,desc:null};
    this.audio=o.audio?{samples:[],ts:o.audio.sampleRate,ch:o.audio.channels,
      bitrate:o.audio.bitrate||384000,desc:null}:null;
  }
  addVideo(chunk,meta){
    if(meta&&meta.decoderConfig&&meta.decoderConfig.description&&!this.video.desc)
      this.video.desc=new Uint8Array(meta.decoderConfig.description);
    const data=new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    this.video.samples.push({data,dur:1,sync:chunk.type==="key"});
  }
  addAudio(chunk,meta){
    if(!this.audio)return;
    if(meta&&meta.decoderConfig&&meta.decoderConfig.description&&!this.audio.desc)
      this.audio.desc=new Uint8Array(meta.decoderConfig.description);
    const data=new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    /* Chunk durations come back in microseconds; the sample table wants them in
       the media timescale, and AAC-LC is 1024 samples a frame regardless. */
    const dur=chunk.duration?Math.round(chunk.duration*this.audio.ts/1e6):1024;
    this.audio.samples.push({data,dur:dur||1024,sync:true});
  }

  /* Group a track's samples into ~1s chunks and return the grouping. */
  _chunks(track,perChunk){
    const out=[];
    for(let i=0;i<track.samples.length;i+=perChunk)
      out.push(track.samples.slice(i,i+perChunk));
    return out;
  }
  _stbl(track,entry,isVideo){
    const s=track.samples;
    /* stts — runs of equal duration */
    const runs=[];
    for(const smp of s){
      const last=runs[runs.length-1];
      if(last&&last[1]===smp.dur)last[0]++;else runs.push([1,smp.dur]);
    }
    const stts=full("stts",0,0,u32(runs.length),
      concat(runs.map(r=>concat([u32(r[0]),u32(r[1])]))));
    const stsz=full("stsz",0,0,u32(0),u32(s.length),
      concat(s.map(x=>u32(x.data.length))));
    const stscEntries=track._stsc.map(e=>concat([u32(e[0]),u32(e[1]),u32(1)]));
    const stsc=full("stsc",0,0,u32(stscEntries.length),concat(stscEntries));
    const stco=full("stco",0,0,u32(track._offsets.length),
      concat(track._offsets.map(o=>u32(o))));
    const parts=[full("stsd",0,0,u32(1),entry),stts,stsc,stsz,stco];
    if(isVideo){
      const keys=[];
      s.forEach((x,i)=>{if(x.sync)keys.push(i+1);});
      if(keys.length&&keys.length<s.length)
        parts.splice(2,0,full("stss",0,0,u32(keys.length),concat(keys.map(k=>u32(k)))));
    }
    return box("stbl",...parts);
  }
  _trak(track,id,kind){
    const durMedia=track.samples.reduce((a,x)=>a+x.dur,0);
    const durMovie=Math.round(durMedia/track.ts*this.movieTs);
    const isVideo=kind==="vide";
    const tkhd=full("tkhd",0,3,
      u32(0),u32(0),u32(id),u32(0),u32(durMovie),
      ZERO(8),u16(0),u16(0),
      u16(isVideo?0:0x0100),u16(0),
      MATRIX,
      u32(isVideo?this.w*65536:0),u32(isVideo?this.h*65536:0));
    const mdhd=full("mdhd",0,0,u32(0),u32(0),u32(track.ts),u32(durMedia),
      u16(0x55C4),u16(0));   /* 'und' */
    const hdlr=full("hdlr",0,0,u32(0),enc.encode(kind),ZERO(12),
      enc.encode(isVideo?"VideoHandler\0":"SoundHandler\0"));
    const dinf=box("dinf",full("dref",0,0,u32(1),full("url ",0,1)));
    let entry;
    if(isVideo){
      const name=new Uint8Array(32);
      const cn="AVC Coding";name[0]=cn.length;name.set(enc.encode(cn),1);
      entry=box("avc1",
        ZERO(6),u16(1),u16(0),u16(0),ZERO(12),
        u16(this.w),u16(this.h),
        u32(0x00480000),u32(0x00480000),u32(0),
        u16(1),name,u16(0x0018),u16(0xFFFF),
        box("avcC",track.desc||new Uint8Array(0)));
    }else{
      entry=box("mp4a",
        ZERO(6),u16(1),ZERO(8),
        u16(track.ch),u16(16),u16(0),u16(0),
        u32(track.ts*65536),
        esds(track.desc||new Uint8Array([0x12,0x10]),track.bitrate));
    }
    const minf=box("minf",
      isVideo?full("vmhd",0,1,u16(0),u16(0),u16(0),u16(0)):full("smhd",0,0,u16(0),u16(0)),
      dinf,this._stbl(track,entry,isVideo));
    return box("trak",tkhd,box("mdia",mdhd,hdlr,minf));
  }
  _moov(){
    const dur=Math.max(
      Math.round(this.video.samples.reduce((a,x)=>a+x.dur,0)/this.video.ts*this.movieTs),
      this.audio?Math.round(this.audio.samples.reduce((a,x)=>a+x.dur,0)/this.audio.ts*this.movieTs):0);
    const mvhd=full("mvhd",0,0,u32(0),u32(0),u32(this.movieTs),u32(dur),
      u32(0x00010000),u16(0x0100),u16(0),ZERO(8),MATRIX,ZERO(24),
      u32(this.audio?3:2));
    const traks=[this._trak(this.video,1,"vide")];
    if(this.audio&&this.audio.samples.length)traks.push(this._trak(this.audio,2,"soun"));
    return box("moov",mvhd,...traks);
  }
  finalize(){
    if(!this.video.samples.length)throw new Error("Nothing was encoded.");
    const fps=this.fps;
    const vChunks=this._chunks(this.video,fps);
    const aChunks=this.audio&&this.audio.samples.length
      ? this._chunks(this.audio,Math.max(1,Math.round(this.audio.ts/1024)))
      : [];
    const useAudio=aChunks.length>0;

    /* One `stsc` entry per distinct samples-per-chunk run. In practice that is
       two: the full chunks, then whatever is left over at the end. */
    const stscOf=chunks=>{
      const e=[];
      chunks.forEach((c,i)=>{
        const last=e[e.length-1];
        if(!last||last[1]!==c.length)e.push([i+1,c.length]);
      });
      return e;
    };
    this.video._stsc=stscOf(vChunks);
    if(useAudio)this.audio._stsc=stscOf(aChunks);

    /* Lay the payload out first with offsets relative to the start of mdat's
       payload, then build moov to learn its size, then shift every offset by
       the header bytes that end up in front. The layout never changes between
       the two passes, so the box sizes cannot change either. */
    const order=[];let rel=0;
    const vOff=[],aOff=[];
    const n=Math.max(vChunks.length,aChunks.length);
    for(let i=0;i<n;i++){
      if(i<vChunks.length){
        vOff.push(rel);
        for(const s of vChunks[i]){order.push(s.data);rel+=s.data.length;}
      }
      if(i<aChunks.length){
        aOff.push(rel);
        for(const s of aChunks[i]){order.push(s.data);rel+=s.data.length;}
      }
    }
    const mdatSize=rel+8;
    this.video._offsets=vOff;
    if(useAudio)this.audio._offsets=aOff;

    const ftyp=box("ftyp",enc.encode("isom"),u32(512),
      enc.encode("isom"),enc.encode("iso2"),enc.encode("avc1"),enc.encode("mp41"));
    let moov=this._moov();
    const headBytes=ftyp.length+moov.length+8;
    if(headBytes+rel>0xFFFFFFF0)
      throw new Error("Clip too long for a 32-bit MP4 index — export in parts.");
    this.video._offsets=vOff.map(o=>o+headBytes);
    if(useAudio)this.audio._offsets=aOff.map(o=>o+headBytes);
    moov=this._moov();   /* same shape, real offsets */

    return new Blob([ftyp,moov,u32(mdatSize),enc.encode("mdat"),...order],
      {type:"video/mp4"});
  }
}

/* ---------- codec selection ----------
   Level has to cover the frame: a vertical 4K frame is the same macroblock
   count as a landscape one, so 5.1 carries 2160×3840 fine, but asking for a
   level below the picture makes Chrome refuse the config outright. */
function levelsFor(w,h){
  const mb=Math.ceil(w/16)*Math.ceil(h/16);
  if(mb>22080)return ["34","33","32"];        /* 5.2, 5.1, 5.0 */
  if(mb>8704) return ["33","32","2a","29"];
  return ["2a","29","28","1f"];
}
export async function pickVideoCodec(w,h,fps,bitrate){
  if(typeof VideoEncoder==="undefined")return null;
  const profiles=["64","4d","42"];            /* High, Main, Baseline */
  for(const lv of levelsFor(w,h)){
    for(const pr of profiles){
      const codec="avc1."+pr+"00"+lv;
      const cfg={codec,width:w,height:h,bitrate,framerate:fps,
        avc:{format:"avc"},latencyMode:"quality"};
      try{
        const r=await VideoEncoder.isConfigSupported(cfg);
        if(r&&r.supported)return r.config||cfg;
      }catch(_){}
    }
  }
  return null;
}
export async function audioSupported(sampleRate,channels,bitrate){
  if(typeof AudioEncoder==="undefined")return null;
  const cfg={codec:"mp4a.40.2",sampleRate,numberOfChannels:channels,bitrate};
  try{
    const r=await AudioEncoder.isConfigSupported(cfg);
    if(r&&r.supported)return r.config||cfg;
  }catch(_){}
  return null;
}

/* ---------- audio ----------
   Encoded in one pass from the mixed buffer, before the video loop starts, so
   a slow frame render can never stall the audio encoder's own pacing. */
export async function encodeAudio(muxer,buffer,cfg,onProgress){
  const ch=Math.min(2,buffer.numberOfChannels||1);
  const rate=buffer.sampleRate;
  let error=null;
  const encoder=new AudioEncoder({
    output:(c,m)=>muxer.addAudio(c,m),
    error:e=>{error=e;}
  });
  encoder.configure(cfg);
  const CH=Math.max(1024,Math.round(rate/10));
  const total=buffer.length;
  const planes=[];
  for(let i=0;i<ch;i++)planes.push(buffer.getChannelData(i));
  for(let off=0;off<total;off+=CH){
    if(error)break;
    const n=Math.min(CH,total-off);
    const data=new Float32Array(n*ch);
    for(let c=0;c<ch;c++)data.set(planes[c].subarray(off,off+n),c*n);
    const ad=new AudioData({
      format:"f32-planar",sampleRate:rate,numberOfFrames:n,numberOfChannels:ch,
      timestamp:Math.round(off/rate*1e6),data
    });
    encoder.encode(ad);
    ad.close();
    if(off%(CH*20)===0){
      onProgress&&onProgress(off/total);
      await new Promise(r=>setTimeout(r,0));
    }
  }
  await encoder.flush();
  encoder.close();
  if(error)throw error;
}

/* ---------- YouTube's own recommendations ----------
   The upload help page gives a range per resolution; the top of the range is
   what "max recommended" means and what this defaults to. Going past it does
   not survive YouTube's re-encode, it only makes the upload slower. */
export function ytBitrate(w,h,fps){
  const short=Math.min(w,h),hfr=fps>34;
  if(short>=2000)return hfr?66e6:45e6;
  if(short>=1400)return hfr?24e6:16e6;
  if(short>=1000)return hfr?12e6:8e6;
  if(short>=700) return hfr?7.5e6:5e6;
  return 2.5e6;
}
