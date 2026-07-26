/* text.js — Highlight range maths, word wrapping and the shared highlight-aware text block. */
import {$, S, SANS} from './data.js';
import {rr} from './state.js';

/* ---------- ranges ---------- */
export function normalize(rs){const a=rs.filter(r=>r[1]>r[0]).sort((x,y)=>x[0]-y[0]),o=[];
  for(const r of a){const l=o[o.length-1];if(l&&r[0]<=l[1])l[1]=Math.max(l[1],r[1]);else o.push([r[0],r[1]]);}return o;}
export function subtract(rs,s,e){const o=[];for(const [a,b] of rs){
  if(b<=s||a>=e){o.push([a,b]);continue;}if(a<s)o.push([a,s]);if(b>e)o.push([e,b]);}return o;}
export function covered(rs,s,e){return rs.some(([a,b])=>a<=s&&b>=e);}
export function trimEdges(rs){
  const t=S.text,o=[];
  for(let [a,b] of rs){
    while(a<b&&/\s/.test(t[a]))a++;
    while(b>a&&/\s/.test(t[b-1]))b--;
    if(b>a)o.push([a,b]);
  }
  return o;
}
export function bridge(rs){
  rs=normalize(trimEdges(rs));const o=[];
  for(const r of rs){
    const l=o[o.length-1],gap=l?S.text.slice(l[1],r[0]):"x";
    if(l&&gap.length&&!gap.trim()&&!/\n/.test(gap))l[1]=r[1];else o.push([r[0],r[1]]);
  }
  return o;
}
export function setRanges(rs){S.ranges=trimEdges(normalize(rs));}
export function remap(o,n,rs){
  if(o===n)return rs;
  let p=0;const m=Math.min(o.length,n.length);
  while(p<m&&o[p]===n[p])p++;
  let s=0;while(s<m-p&&o[o.length-1-s]===n[n.length-1-s])s++;
  const oe=o.length-s,dd=n.length-o.length,out=[];
  for(const [a,b] of rs){
    if(b<=p)out.push([a,b]);
    else if(a>=oe)out.push([a+dd,b+dd]);
    else{const sub=o.slice(a,b),i=n.indexOf(sub);if(sub.trim()&&i>=0)out.push([i,i+sub.length]);}
  }
  return normalize(out.map(r=>[Math.max(0,r[0]),Math.min(n.length,r[1])]));
}
/* ---------- wrap ---------- */
export function wrap(c,text,maxW,indent){
  const lines=[];if(maxW<=0)return lines;let para=0;
  /* the first line can be shortened to sit beside an inline label (IG caption) */
  const lim=()=>(indent&&lines.length===0)?Math.max(10,maxW-indent):maxW;
  text.split("\n").forEach(pt=>{
    const ps=para;para+=pt.length+1;
    if(!pt.trim()){lines.push([ps,ps]);return;}
    const re=/\S+/g,tk=[];let m;
    while((m=re.exec(pt)))tk.push([ps+m.index,ps+m.index+m[0].length]);
    let ls=0,le=null;
    const chop=(a,b)=>{let i=a;while(i<b){let j=i+1;
      while(j<b&&c.measureText(text.slice(i,j+1)).width<=lim())j++;
      if(j>=b)return i;lines.push([i,j]);i=j;}return i;};
    const start=t=>{
      if(c.measureText(text.slice(t[0],t[1])).width>lim()){
        const rest=chop(t[0],t[1]);if(rest>=t[1]){le=null;return;}ls=rest;le=t[1];
      }else{ls=t[0];le=t[1];}
    };
    for(const t of tk){
      if(le===null){start(t);continue;}
      if(c.measureText(text.slice(ls,t[1])).width<=lim())le=t[1];
      else{lines.push([ls,le]);start(t);}
    }
    if(le!==null)lines.push([ls,le]);
  });
  return lines;
}
function segments(text,ls,le,rs){
  const cuts=new Set([ls,le]);
  for(const [a,b] of rs){if(a>ls&&a<le)cuts.add(a);if(b>ls&&b<le)cuts.add(b);}
  const p=[...cuts].sort((x,y)=>x-y),o=[];
  for(let i=0;i<p.length-1;i++)o.push({s:p[i],e:p[i+1],hl:rs.some(([x,y])=>x<=p[i]&&y>=p[i+1])});
  return o;
}
function trackedW(c,s,sp){let w=0;for(const ch of s)w+=c.measureText(ch).width+sp;return Math.max(0,w-sp);}
export function drawTracked(c,s,x,y,sp){let cx=x;for(const ch of s){c.fillText(ch,cx,y);cx+=c.measureText(ch).width+sp;}}
export function fitLabel(c,str,maxW,fs,tr,weight){
  let f=fs,s=str,g=0;
  const w=()=>{c.font=(weight||"")+f+"px "+SANS;return tr?trackedW(c,s,f*tr):c.measureText(s).width;};
  while(w()>maxW&&f>Math.max(9,fs*0.55)&&g++<80)f-=1;
  if(w()>maxW){while(s.length>2&&w()>maxW)s=s.slice(0,-1);s=s.replace(/\s+$/,"")+"…";}
  return {str:s,fs:f,tr:tr||0};
}
export function ellip(c,str,maxW){
  if(!str)return "";
  if(c.measureText(str).width<=maxW)return str;
  let s=str;while(s.length>1&&c.measureText(s+"…").width>maxW)s=s.slice(0,-1);
  return s+"…";
}
export function fmtCount(v){
  const s=String(v).trim();
  if(!s)return "";
  if(/[a-zA-Z,]/.test(s))return s;              /* already formatted like 2.4K */
  const n=+s;if(isNaN(n))return s;
  if(n>=1e6)return (n/1e6).toFixed(n%1e6?1:0).replace(/\.0$/,"")+"M";
  if(n>=1e3)return (n/1e3).toFixed(n%1e3?1:0).replace(/\.0$/,"")+"K";
  return String(n);
}

/* ---------- shared rich-text block (highlight aware + slide-in) ---------- */
export function measureBlock(c,text,rs,maxW,fs,face,lh,weight,indent){
  c.font=(weight||"")+fs+"px "+face;
  const lines=text.trim()?wrap(c,text,maxW,indent):[];
  const h=lines.length?lines.length*lh-(lh-fs*1.05):0;
  return {lines,h};
}
export function paintBlock(c,o){
  /* o:{text,rs,lines,x,y,fs,lh,face,ink,hlColor,hlStyle,hp,weight} */
  const {text,rs,lines,x,y,fs,lh,face,ink,hlColor,hlStyle}=o;
  const hp=o.hp==null?1:o.hp;
  c.font=(o.weight||"")+fs+"px "+face;c.textBaseline="alphabetic";
  const indent=o.indent||0;
  let cy=y;
  lines.forEach(([ls,le],li)=>{
    const x=o.x+((indent&&li===0)?indent:0);
    const base=cy+fs*0.82,segs=segments(text,ls,le,rs);
    const pre=i=>c.measureText(text.slice(ls,i)).width;
    /* ink text first (all of it — the marker wipe repaints dark on top as it reveals) */
    c.fillStyle=ink;
    segs.forEach(sg=>{ c.fillText(text.slice(sg.s,sg.e),x+pre(sg.s),base); });
    /* highlights (wipe reveal) */
    segs.forEach(sg=>{
      if(!sg.hl)return;
      if(!text.slice(sg.s,sg.e).trim())return;
      const x0=x+pre(sg.s),x1=x+pre(sg.e),full=x1-x0;
      if(hp<=0)return;                              /* nothing revealed yet */
      if(hlStyle==="marker"){
        const rw=(full+fs*0.18)*hp;                  /* reveal grows from 0 */
        c.save();
        c.beginPath();c.rect(x0-fs*0.09,base-fs,rw,fs*1.4);c.clip();
        c.fillStyle=hlColor;rr(c,x0-fs*0.09,base-fs*0.80,full+fs*0.18,fs*1.03,fs*0.13);c.fill();
        c.fillStyle="#12141A";c.fillText(text.slice(sg.s,sg.e),x0,base);
        c.restore();
      }else{
        c.fillStyle=hlColor;
        rr(c,x0,base+fs*0.13,full*hp,fs*0.19,fs*0.06);c.fill();
      }
    });
    cy+=lh;
  });
}

