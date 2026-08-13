/* elements.js — What each clip type actually draws.

   Every element is authored against a 1080-unit short edge and multiplied by
   `env.U` at paint time, so one sequence renders identically at preview size
   and at 4K. Each type exposes `measure` (natural size, unrotated) and `paint`
   (draw centred on the origin). The wrapper in draw.js owns placement,
   animation and the reveal clip — an element never positions itself, which is
   why the same renderer works for a slot, a nudge and a drag. */

import {SLOTS} from './model.js';
import {get} from './media.js';

export const STACK='"Inter","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';
export const font=(w,s)=>w+" "+Math.max(1,Math.round(s))+"px "+STACK;

export function rr(c,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  c.beginPath();
  if(c.roundRect){c.roundRect(x,y,w,h,r);return;}
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
export function shadow(c,blur,y,a){
  c.shadowColor="rgba(0,0,0,"+(a==null?.55:a)+")";
  c.shadowBlur=blur;c.shadowOffsetY=y||0;c.shadowOffsetX=0;
}
export function noShadow(c){c.shadowColor="transparent";c.shadowBlur=0;c.shadowOffsetY=0;}

/* Greedy wrap. Words longer than the box are left to overflow rather than
   broken mid-word — a hyphenated creator name reads worse than a wide line. */
export function wrap(c,text,maxW){
  const out=[];
  for(const para of String(text||"").split(/\n+/)){
    const words=para.split(/\s+/).filter(Boolean);
    if(!words.length){out.push("");continue;}
    let line=words[0];
    for(let i=1;i<words.length;i++){
      const t=line+" "+words[i];
      if(c.measureText(t).width<=maxW)line=t;
      else{out.push(line);line=words[i];}
    }
    out.push(line);
  }
  return out;
}
const casify=(s,mode)=>mode==="upper"?String(s).toUpperCase():mode==="title"
  ? String(s).replace(/\b\w/g,m=>m.toUpperCase()):String(s);

/* Split a line into [text, isHighlight] runs for the accent colour. */
function runs(line,needle){
  if(!needle)return [[line,false]];
  const out=[];let i=0;const low=line.toLowerCase(),n=needle.toLowerCase();
  while(i<line.length){
    const at=low.indexOf(n,i);
    if(at<0){out.push([line.slice(i),false]);break;}
    if(at>i)out.push([line.slice(i,at),false]);
    out.push([line.slice(at,at+needle.length),true]);
    i=at+needle.length;
  }
  return out.length?out:[[line,false]];
}
function drawRuns(c,line,needle,cx,y,base,accent){
  const parts=runs(line,needle);
  let total=0;for(const p of parts)total+=c.measureText(p[0]).width;
  let x=cx-total/2;
  for(const [txt,hi] of parts){
    c.fillStyle=hi?accent:base;
    c.fillText(txt,x,y);
    x+=c.measureText(txt).width;
  }
}
export const accentOf=(clip,env)=>clip.props.color||env.seq.accent||"#FF5C3A";
const INK="#FFFFFF";

/* ---------- text ---------- */
const TextEl={
  measure(c,clip,env){
    const U=env.U;
    let size=(clip.props.size||100)/100*88*U;
    /* Wrap to the slot, not to the scaled result: scale is an explicit override
       and should be free to overflow the slot when that is what was asked for. */
    const maxW=(SLOTS[clip.props.slot]||SLOTS.center).w*env.W;
    const weight=clip.props.weight||800;
    c.font=font(weight,size);
    const lines=wrap(c,casify(clip.props.text,clip.props.case),maxW);
    let w=0;for(const l of lines)w=Math.max(w,c.measureText(l).width);
    /* wrap() will not break inside a word, so one long word — a URL, a handle —
       can still be wider than the box. Shrink the whole block to match rather
       than letting it run off the frame. */
    if(w>maxW){
      size*=maxW/w;
      c.font=font(weight,size);
      w=0;for(const l of lines)w=Math.max(w,c.measureText(l).width);
    }
    const lh=size*1.12;
    return {w:w+size*0.3,h:lines.length*lh+size*0.24,lines,size,lh};
  },
  paint(c,clip,env,m){
    const {lines,size,lh}=m;
    if(clip.props.box){
      noShadow(c);shadow(c,size*0.5,size*0.12,.45);
      c.fillStyle="rgba(9,10,13,.62)";
      rr(c,-m.w/2,-m.h/2,m.w,m.h,size*0.26);c.fill();
      noShadow(c);
    }
    c.font=font(clip.props.weight||800,size);
    c.textBaseline="middle";c.textAlign="left";
    shadow(c,size*0.42,size*0.06,.72);
    let y=-m.h/2+size*0.12+lh/2;
    for(const l of lines){drawRuns(c,l,clip.props.hl,0,y,INK,accentOf(clip,env));y+=lh;}
    noShadow(c);
  }
};

/* ---------- stamp ---------- */
const StampEl={
  measure(c,clip,env){
    const U=env.U;
    const txt=String(clip.props.text||"").toUpperCase();
    /* A stamp is one word on one line, so it cannot wrap out of trouble — it
       shrinks instead. Without this, "UNCONFIRMED" runs off both edges of the
       frame at the default size and there is no control that obviously fixes it. */
    let size=(clip.props.size||120)/100*104*U;
    const room=env.W*0.94;
    for(let i=0;i<24;i++){
      c.font=font(900,size);
      if(c.measureText(txt).width+size*0.84<=room)break;
      size*=0.93;
    }
    c.font=font(900,size);
    const w=c.measureText(txt).width;
    const padX=size*0.42,padY=size*0.26;
    return {w:w+padX*2,h:size*1.02+padY*2,size,txt,padX,padY};
  },
  paint(c,clip,env,m){
    const a=accentOf(clip,env);
    shadow(c,m.size*0.5,m.size*0.10,.6);
    c.fillStyle="rgba(10,11,14,.55)";
    rr(c,-m.w/2,-m.h/2,m.w,m.h,m.size*0.16);c.fill();
    noShadow(c);
    c.lineWidth=Math.max(2,m.size*0.075);c.strokeStyle=a;
    rr(c,-m.w/2,-m.h/2,m.w,m.h,m.size*0.16);c.stroke();
    c.font=font(900,m.size);
    c.textAlign="center";c.textBaseline="middle";
    c.fillStyle=a;
    c.fillText(m.txt,0,m.size*0.03);
  }
};

/* ---------- name list ----------
   Items land one at a time on `step`, which is what the beat sheet means by
   "builds out the six names one by one as they're read". */
const ListEl={
  measure(c,clip,env){
    const U=env.U,size=(clip.props.size||88)/100*62*U;
    const items=clip.props.items||[];
    c.font=font(700,size);
    let w=0;for(const it of items)w=Math.max(w,c.measureText(String(it)).width);
    const rowH=size*1.62,dot=size*0.5;
    return {w:w+dot+size*1.25,h:Math.max(rowH,items.length*rowH),size,rowH,dot,items};
  },
  paint(c,clip,env,m){
    const a=accentOf(clip,env);
    const step=Math.max(0.01,clip.props.step||0.55);
    const local=env.t-clip.t0;
    c.textBaseline="middle";c.textAlign="left";
    const x0=-m.w/2;
    for(let i=0;i<m.items.length;i++){
      const p=Math.max(0,Math.min(1,(local-i*step)/0.28));
      if(p<=0)continue;
      const ease=1-Math.pow(1-p,3);
      const y=-m.h/2+m.rowH*(i+0.5);
      c.save();
      c.globalAlpha=c.globalAlpha*ease;
      c.translate((1-ease)*m.size*0.55,0);
      if(clip.props.marker!=="none"){
        c.fillStyle=a;
        if(clip.props.marker==="number"){
          c.font=font(900,m.size*0.62);c.textAlign="left";
          c.fillText(String(i+1).padStart(2,"0"),x0,y);
        }else{
          c.beginPath();c.arc(x0+m.dot/2,y,m.dot/2,0,7);c.fill();
        }
      }
      c.font=font(700,m.size);c.textAlign="left";
      shadow(c,m.size*0.4,m.size*0.05,.7);
      c.fillStyle=INK;
      c.fillText(String(m.items[i]),x0+m.dot+m.size*0.62,y);
      noShadow(c);
      c.restore();
    }
  }
};

/* ---------- lower third ---------- */
const LowerEl={
  measure(c,clip,env){
    const U=env.U,size=(clip.props.size||72)/100*46*U;
    c.font=font(800,size);
    const t=String(clip.props.text||"");
    const s=String(clip.props.sub||"");
    c.font=font(800,size);const w1=c.measureText(t).width;
    c.font=font(600,size*0.76);const w2=s?c.measureText(s).width:0;
    const bar=size*0.32,padX=size*0.85,padY=size*0.55;
    const h=s?size*1.05+size*0.98+padY*1.4:size*1.05+padY*1.5;
    return {w:Math.max(w1,w2)+padX*2+bar,h,size,bar,padX,t,s};
  },
  paint(c,clip,env,m){
    const a=accentOf(clip,env);
    shadow(c,m.size*0.7,m.size*0.14,.5);
    c.fillStyle="rgba(9,10,13,.80)";
    rr(c,-m.w/2,-m.h/2,m.w,m.h,m.size*0.22);c.fill();
    noShadow(c);
    c.fillStyle=a;
    rr(c,-m.w/2,-m.h/2,m.bar,m.h,m.size*0.16);c.fill();
    c.fillRect(-m.w/2+m.bar*0.5,-m.h/2,m.bar*0.5,m.h);
    c.textAlign="left";c.textBaseline="middle";
    const x=-m.w/2+m.bar+m.padX;
    if(m.s){
      c.font=font(800,m.size);c.fillStyle=INK;
      c.fillText(m.t,x,-m.size*0.46);
      c.font=font(600,m.size*0.76);c.fillStyle="rgba(255,255,255,.68)";
      c.fillText(m.s,x,m.size*0.58);
    }else{
      c.font=font(800,m.size);c.fillStyle=INK;
      c.fillText(m.t,x,0);
    }
  }
};

/* ---------- image ---------- */
const ImageEl={
  measure(c,clip,env){
    const U=env.U;
    const slot=SLOTS[clip.props.slot]||SLOTS.center;
    const w=slot.w*env.W*(clip.props.size||100)/100;
    const it=get(clip.props.src,"image");
    const ar=it?(it.h/it.w):(9/16);
    /* The caption band is sized from the image, not from a fixed number of
       units: a narrow image needs a smaller caption or the label is cropped
       to an ellipsis nobody asked for. */
    let capF=0,capH=0;
    if(clip.props.label){
      capF=Math.min(34*U,w*0.075);
      c.font=font(700,capF);
      const need=c.measureText(String(clip.props.label)).width+capF*1.6;
      if(need>w)capF*=w/need;
      capH=capF*2.1;
    }
    return {w,h:w*ar+capH,imgH:w*ar,capH,capF,it,U};
  },
  paint(c,clip,env,m){
    const r=(clip.props.radius||28)*m.U;
    const x=-m.w/2,y=-m.h/2;
    shadow(c,60*m.U,18*m.U,.6);
    c.fillStyle="rgba(10,11,14,.9)";
    rr(c,x,y,m.w,m.h,r);c.fill();
    noShadow(c);
    c.save();
    rr(c,x,y,m.w,m.imgH,r);c.clip();
    if(m.it){
      const iw=m.it.w,ih=m.it.h;
      const k=clip.props.fit==="contain"
        ? Math.min(m.w/iw,m.imgH/ih) : Math.max(m.w/iw,m.imgH/ih);
      const dw=iw*k,dh=ih*k;
      c.drawImage(m.it.el,x+(m.w-dw)/2,y+(m.imgH-dh)/2,dw,dh);
    }else{
      c.fillStyle="rgba(125,147,255,.14)";c.fillRect(x,y,m.w,m.imgH);
      c.strokeStyle="rgba(255,255,255,.35)";c.lineWidth=3*m.U;c.setLineDash([14*m.U,10*m.U]);
      c.strokeRect(x+6*m.U,y+6*m.U,m.w-12*m.U,m.imgH-12*m.U);c.setLineDash([]);
      c.fillStyle="rgba(255,255,255,.72)";
      c.font=font(700,26*m.U);c.textAlign="center";c.textBaseline="middle";
      c.fillText((clip.props.src||"no image")+" — drop the file in",0,y+m.imgH/2);
    }
    c.restore();
    if(clip.props.frame){
      c.strokeStyle="rgba(255,255,255,.16)";c.lineWidth=Math.max(1,3*m.U);
      rr(c,x,y,m.w,m.h,r);c.stroke();
    }
    if(m.capH){
      c.font=font(700,m.capF);
      c.textAlign="center";c.textBaseline="middle";
      c.fillStyle=accentOf(clip,env);
      c.fillText(String(clip.props.label),0,y+m.imgH+m.capH/2);
    }
  }
};

/* ---------- caption (a spoken line burned in) ---------- */
const CaptionEl={
  measure(c,clip,env){
    const U=env.U,size=(env.seq.capStyle==="small"?44:56)*U;
    c.font=font(800,size);
    const lines=wrap(c,env.seq.capStyle==="upper"?String(clip.props.text||"").toUpperCase()
      :clip.props.text,env.W*0.84);
    let w=0;for(const l of lines)w=Math.max(w,c.measureText(l).width);
    const lh=size*1.18;
    return {w:w+size*0.9,h:lines.length*lh+size*0.7,lines,size,lh};
  },
  paint(c,clip,env,m){
    c.fillStyle="rgba(8,9,12,.72)";
    rr(c,-m.w/2,-m.h/2,m.w,m.h,m.size*0.32);c.fill();
    c.font=font(800,m.size);c.textAlign="center";c.textBaseline="middle";
    shadow(c,m.size*0.3,0,.6);
    let y=-m.h/2+m.size*0.35+m.lh/2;
    for(const l of m.lines){
      c.fillStyle="#FFFFFF";c.fillText(l,0,y);y+=m.lh;
    }
    noShadow(c);
  }
};

export const ELEMENTS={text:TextEl,stamp:StampEl,list:ListEl,lower:LowerEl,
  image:ImageEl,caption:CaptionEl};
