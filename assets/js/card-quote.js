/* card-quote.js — The news quote card: layout and paint. */
import {FACES, FW, S, SANS, THEMES} from './data.js';
import {GRAIN, rr} from './state.js';
import {drawTracked, fitLabel, measureBlock, normalize, paintBlock, wrap} from './text.js';

/* ---------- QUOTE layout ---------- */
function composeText(){
  const raw=S.text;
  if(!(S.marks&&raw.trim()))return {text:raw,off:0};
  return {text:"“"+raw.trim()+"”",off:1-raw.match(/^\s*/)[0].length};
}
export function layoutQuote(c,fs){
  const face=FACES[S.face],cardW=FW*(S.width/100),pad=Math.round(fs*1.25);
  const maxW=Math.max(10,cardW-pad*2),lh=fs*1.42;
  const {text,off}=composeText();
  const rs=normalize(S.ranges.map(r=>[r[0]+off,r[1]+off]).map(r=>[Math.max(0,r[0]),Math.min(text.length,r[1])]));
  const {lines,h:textH}=measureBlock(c,text,rs,maxW,fs,face,lh);
  let header=null,headH=0;
  if(S.header&&S.outlet.trim()){
    header=fitLabel(c,S.outlet.trim().toUpperCase(),maxW,Math.max(12,Math.round(fs*0.42)),0.14,"600 ");
    headH=header.fs*1.1+pad*0.62;
  }
  let foot=null,footH=0;
  if(S.url.trim()){
    const src=S.url.trim();let ffs=Math.max(11,Math.round(fs*0.40)),g=0,fl;
    do{c.font=ffs+"px "+SANS;fl=wrap(c,src,maxW);if(fl.length<=2)break;ffs-=1;}
    while(ffs>Math.max(10,fs*0.26)&&g++<60);
    foot={src,lines:fl,fs:ffs,lh:ffs*1.34};
    footH=(fl.length-1)*foot.lh+ffs*1.1+pad*0.52;
  }
  const cardH=Math.round(pad*2+headH+textH+footH);
  return {kind:"quote",fs,face,cardW,cardH,pad,lh,text,rs,lines,header,headH,foot,footH};
}
export function paintQuote(c,L,A){
  const T=THEMES[S.theme],{x,y,cardW,cardH,pad,fs,lh,text,rs,lines}=L;
  c.save();
  c.shadowColor=T.shadow;c.shadowBlur=fs*0.9;c.shadowOffsetY=fs*0.35;
  c.fillStyle=T.card;rr(c,x,y,cardW,cardH,Math.round(fs*0.34));c.fill();
  c.restore();
  if(T.grain){
    c.save();rr(c,x,y,cardW,cardH,Math.round(fs*0.34));c.clip();
    c.globalAlpha=(A?A.alpha:1)*T.grain;c.globalCompositeOperation="multiply";
    c.fillStyle=c.createPattern(GRAIN,"repeat");c.fillRect(x,y,cardW,cardH);c.restore();
  }
  let cy=y+pad;
  if(L.header){
    c.font="600 "+L.header.fs+"px "+SANS;c.fillStyle=T.meta;
    drawTracked(c,L.header.str,x+pad,cy+L.header.fs*0.85,L.header.fs*L.header.tr);
    c.fillStyle=T.rule;
    c.fillRect(x+pad,Math.round(cy+L.header.fs*1.55),cardW-pad*2,Math.max(1,Math.round(fs*0.035)));
    cy+=L.headH;
  }
  paintBlock(c,{text,rs,lines,x:x+pad,y:cy,fs,lh,face:L.face,ink:T.ink,hlColor:S.hlColor,hlStyle:S.hlStyle,hp:A?A.hp:1});
  cy+=lines.length*lh;
  if(L.foot){
    cy+=pad*0.52-(lines.length?(lh-fs*1.05):0);
    c.font=L.foot.fs+"px "+SANS;c.fillStyle=T.meta;
    L.foot.lines.forEach(([a,b],i)=>c.fillText(L.foot.src.slice(a,b),x+pad,cy+L.foot.fs*0.78+i*L.foot.lh));
  }
}

