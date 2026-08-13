/* card.js — The quote / social card as a timeline element.

   The card renderers already exist and are the reason this repo is called a
   quote generator, so a CARD clip borrows them wholesale rather than growing a
   second, drifting copy. They read one module-level `S`, so rendering a clip
   means lending `S` to it and handing it straight back — anything that throws
   in between must still restore, or the card editor on the other page would
   come back wearing this clip's text.

   Cards are rendered to their own canvas and cached: the bitmap only changes
   when the card's own fields do, so a 900-frame export pays for each card once
   rather than 900 times. */

import {S} from '../data.js';
import {fitLayout, invalidateLayout, paint} from '../layout.js';
import {get} from './media.js';

const CARD_KEYS=["design","text","ranges","outlet","url","theme","face","hlColor","hlStyle",
  "header","marks","width","size","ypos","name","handle","badge","sub","time","likes",
  "retweets","replies","views","avShape","likeOn","audio","mediaSrc","nameColor","cheer",
  "subBadge","modBadge","twReply","hidden","hideCounts","avatar","media"];

const DEFAULTS={design:"quote",text:"",theme:"dark",face:"sans",outlet:"",name:"",handle:"",
  badge:"none",time:"2h",sub:"",likes:"",replies:"",retweets:"",views:"",hlWord:""};

function withCardState(card,fn){
  const saved={};
  for(const k of CARD_KEYS)saved[k]=S[k];
  try{
    S.design=card.design||"quote";
    S.text=card.text||"";
    S.theme=card.theme||"dark";
    S.face=card.face||"sans";
    S.outlet=card.outlet||"";S.url=card.url||"";
    S.header=card.outlet?true:false;S.marks=!!card.marks;
    /* Wider than the card editor's own default: a card here is scaled to fit a
       slot afterwards, so laying it out narrow only buys an ellipsis through
       the display name and handle. */
    S.width=card.width||92;S.size=card.size||42;S.ypos=0;
    S.hlStyle=card.hlStyle||"marker";S.hlColor=card.hlColor||"#FFA8C5";
    S.name=card.name||"";S.handle=card.handle||"";
    S.badge=card.badge||"none";S.sub=card.sub||"";S.time=card.time||"";
    S.likes=card.likes||"";S.replies=card.replies||"";
    S.retweets=card.retweets||"";S.views=card.views||"";
    S.hideCounts=!card.likes&&!card.replies&&!card.retweets&&!card.views;
    S.hidden={};
    S.avShape=card.avShape||"circle";S.likeOn=false;
    S.audio=card.audio||"";S.mediaSrc=card.mediaSrc||"";
    S.nameColor=card.nameColor||"#00C7AC";S.cheer=card.cheer||"off";
    S.subBadge=!!card.subBadge;S.modBadge=!!card.modBadge;S.twReply=!!card.twReply;
    const av=get(card.avatar,"image"),md=get(card.media,"image");
    S.avatar=av?av.el:null;S.media=md?md.el:null;
    S.ranges=rangesFor(S.text,card.hlWord);
    invalidateLayout();
    return fn();
  }finally{
    for(const k of CARD_KEYS)S[k]=saved[k];
    invalidateLayout();
  }
}
function rangesFor(text,word){
  if(!word)return [];
  const i=String(text).toLowerCase().indexOf(String(word).toLowerCase());
  return i<0?[]:[[i,i+word.length]];
}

/* Cache one bitmap per card, keyed by everything that changes its pixels. */
const cache=new Map();
function sigOf(card,px){
  return JSON.stringify(card)+"|"+Math.round(px);
}
export function cardBitmap(card,pxWidth){
  const c={...DEFAULTS,...(card||{})};
  const sig=sigOf(c,pxWidth);
  const hit=cache.get(sig);
  if(hit)return hit;
  const out=withCardState(c,()=>{
    const probe=document.createElement("canvas").getContext("2d");
    const L=fitLayout(probe);
    const m=Math.round(L.fs*1.35);
    const cw=L.cardW+m*2,ch=L.cardH+m*2;
    const k=Math.max(0.05,pxWidth/cw);
    const cv=document.createElement("canvas");
    cv.width=Math.max(1,Math.round(cw*k));
    cv.height=Math.max(1,Math.round(ch*k));
    const saveBg=S.bg;S.bg="transparent";
    try{
      paint(cv.getContext("2d"),k,L,{tx:-L.x+m,ty:-L.y+m,anim:{alpha:1,scale:1,dy:0,hp:1}});
    }finally{S.bg=saveBg;}
    return {canvas:cv,w:cv.width,h:cv.height};
  });
  if(cache.size>60)cache.clear();
  cache.set(sig,out);
  return out;
}
export function clearCardCache(){cache.clear();}

export const CardEl={
  measure(c,clip,env){
    /* `scale` is the wrapper's job — applying it here too would square it. */
    const w=env.W*0.86*(clip.props.size||100)/100;
    const bm=cardBitmap(clip.props.card,Math.min(2400,Math.max(120,w)));
    return {w,h:w*(bm.h/bm.w),bm};
  },
  paint(c,clip,env,m){
    c.drawImage(m.bm.canvas,-m.w/2,-m.h/2,m.w,m.h);
  }
};
