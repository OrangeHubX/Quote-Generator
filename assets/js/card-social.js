/* card-social.js — Social cards: icon table, avatars and one renderer per platform. */
import {AVCOL, CHEER, CHEER_INDIGO, FW, S, SANS, V_ON, brandPal, clamp, themeKey} from './data.js';
import {rr} from './state.js';
import {ellip, fmtCount, measureBlock, paintBlock} from './text.js';

/* ---------- SOCIAL: platform-accurate cards ---------- */
function avatarInitial(){const n=(S.name||S.handle||"?").trim();return (n[0]||"?").toUpperCase();}
function avatarColor(){const n=(S.name||S.handle||"x");let h=0;for(const ch of n)h=(h*31+ch.charCodeAt(0))>>>0;return AVCOL[h%AVCOL.length];}

/* Icons defined on a 24x24 grid. f = filled path, s = stroked path (w = stroke width). */
const IPATH={
  /* --- X / Twitter (official 24x24 geometry, filled) --- */
  xReply:{f:"M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.36 2.77 6.06 6.138 5.99l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"},
  xRetweet:{f:"M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"},
  xHeart:{f:"M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"},
  xHeartOn:{f:"M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"},
  xViews:{f:"M8.75 21V3h2.5v18h-2.5zM18 21V8.5h2.5V21H18zM4 21l.004-10h2.5L6.5 21H4zm9.248 0v-7h2.5v7h-2.5z"},
  xBookmark:{f:"M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"},
  xShare:{f:"M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"},
  verified:{f:"M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.68.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.33-2.19c1.4.45 2.91.2 3.92-.81s1.26-2.52.8-3.91c1.31-.67 2.2-1.91 2.2-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"},
  dots:{f:"M4.5 12a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0m9.6 0a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0m9.6 0a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0"},
  /* --- Facebook --- */
  fbThumb:{s:"M6.4 10.2v9.4H3.9a1.1 1.1 0 0 1-1.1-1.1v-7.2a1.1 1.1 0 0 1 1.1-1.1zM6.4 10.2l4.3-7.3a1.7 1.7 0 0 1 3.1 1.3l-.9 4.7h5.3a2.1 2.1 0 0 1 2.05 2.6l-1.3 6a2.1 2.1 0 0 1-2.05 1.65H6.4z",w:1.55},
  fbComment:{s:"M12 3.4c5 0 9.1 3.4 9.1 7.7 0 4.2-4.1 7.6-9.1 7.6-1.05 0-2.05-.15-3-.42L4.6 20.2l1.3-3.3C4 15.5 2.9 13.4 2.9 11.1c0-4.3 4.1-7.7 9.1-7.7z",w:1.55},
  fbShare:{s:"M3.6 19.4c1.4-6.4 5.9-9.2 11.6-9.3M14 5.5l5.4 4.6L14 14.7",w:1.55},
  /* --- Instagram --- */
  igHeart:{s:"M12 20.3C7.1 17.5 3.7 14.3 3.7 10.6 3.7 7.8 5.85 5.6 8.5 5.6c1.55 0 2.85.8 3.5 1.9.65-1.1 1.95-1.9 3.5-1.9 2.65 0 4.8 2.2 4.8 5 0 3.7-3.4 6.9-8.3 9.7z",w:1.75},
  igComment:{s:"M12 3.6c4.65 0 8.4 3.35 8.4 7.5 0 4.15-3.75 7.5-8.4 7.5-1 0-1.95-.15-2.85-.42L5.4 20l1.25-3.25C4.8 15.35 3.6 13.3 3.6 11.1c0-4.15 3.75-7.5 8.4-7.5z",w:1.75},
  igSend:{s:"M21.4 3.6 2.9 9.85l7.35 2.3 2.3 7.35zM10.25 12.15 21.4 3.6",w:1.75},
  igBookmark:{s:"M5.9 3.4h12.2v17.2L12 16.1l-6.1 4.5z",w:1.75},
  igReshare:{s:"M6.6 10V9a2.4 2.4 0 0 1 2.4-2.4h8.6l-2.9-2.9M17.4 14v1a2.4 2.4 0 0 1-2.4 2.4H6.4l2.9 2.9",w:1.75},
  igMenu:{s:"M3.6 8h16.8M3.6 16h16.8",w:1.8},
  igMusic:{f:"M20 3.2 9.4 5.5v9.9a3.2 3.2 0 1 0 1.7 2.85V7.1l7.2-1.55v7.6a3.2 3.2 0 1 0 1.7 2.85z"},
  globe:{s:"M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8M3.7 12h16.6M12 3.6c2.4 2.6 2.4 14.2 0 16.8-2.4-2.6-2.4-14.2 0-16.8",w:1.7},
  /* --- Reddit / YouTube (kept for the other designs) --- */
  rUp:{s:"M12 4.6 4.4 13h4.2v6.4h6.8V13h4.2z",w:1.7},
  rDown:{s:"M12 19.4 4.4 11h4.2V4.6h6.8V11h4.2z",w:1.7},
  ytThumb:{s:"M6.4 10.2v9.4H3.9a1.1 1.1 0 0 1-1.1-1.1v-7.2a1.1 1.1 0 0 1 1.1-1.1zM6.4 10.2l4.3-7.3a1.7 1.7 0 0 1 3.1 1.3l-.9 4.7h5.3a2.1 2.1 0 0 1 2.05 2.6l-1.3 6a2.1 2.1 0 0 1-2.05 1.65H6.4z",w:1.55}
};
function drawIcon(c,name,x,y,size,col,rot){
  const ic=IPATH[name];if(!ic)return;
  c.save();
  if(rot){c.translate(x+size/2,y+size/2);c.rotate(rot*Math.PI/180);c.translate(-size/2,-size/2);}
  else c.translate(x,y);
  const k=size/24;c.scale(k,k);
  if(ic.f){c.fillStyle=col;c.fill(new Path2D(ic.f));}
  if(ic.s){c.strokeStyle=col;c.lineWidth=ic.w||1.7;c.lineCap="round";c.lineJoin="round";c.stroke(new Path2D(ic.s));}
  c.restore();
}
/* Draw an image to cover a box, then apply the user's zoom and pan.
   Zoom starts at 100% = exact cover, so the image can never be smaller than the
   box, and the pan is clamped to the resulting slack — no empty edges. */
export function drawFitted(c,img,x,y,w,h,scale,ox,oy){
  const k=Math.max(w/img.width,h/img.height)*(Math.max(100,scale||100)/100);
  const dw=img.width*k,dh=img.height*k;
  const slackX=Math.max(0,(dw-w)/2),slackY=Math.max(0,(dh-h)/2);
  const px=clamp((ox||0)/100,-1,1)*slackX;
  const py=clamp((oy||0)/100,-1,1)*slackY;
  c.drawImage(img,x+(w-dw)/2+px,y+(h-dh)/2+py,dw,dh);
}
/* rounded-square avatar (X brand accounts) or circle */
function avatarPath(c,x,y,s,shape){
  if(shape==="square")rr(c,x,y,s,s,s*0.22);
  else{c.beginPath();c.arc(x+s/2,y+s/2,s/2,0,7);c.closePath();}
}
function drawAvatar(c,x,y,s,shape){
  c.save();avatarPath(c,x,y,s,shape);c.clip();
  if(S.avatar)drawFitted(c,S.avatar,x,y,s,s,S.avatarScale,S.avatarX,S.avatarY);
  else{
    c.fillStyle=avatarColor();c.fillRect(x,y,s,s);
    c.fillStyle="#fff";c.font="600 "+Math.round(s*0.44)+"px "+SANS;
    c.textAlign="center";c.textBaseline="middle";
    c.fillText(avatarInitial(),x+s/2,y+s/2+s*0.02);
    c.textAlign="left";c.textBaseline="alphabetic";
  }
  c.restore();
}
function gc(id){if(S.hideCounts||S.hidden[id])return "";return fmtCount(S[id]||"");}
/* Name + @handle + · time on one line. Time is always kept; name and handle
   share the remaining room and each ellipsize, the way the real clients do. */
function fitXHead(c,nameFont,name,metaFont,handle,timeStr,avail,badgeW){
  c.font=metaFont;
  const tw=timeStr?c.measureText(timeStr).width:0;
  let h=handle,hw=c.measureText(h).width;
  c.font=nameFont;let n=name,nw=c.measureText(n).width;
  const room=avail-badgeW-tw;
  if(room>0&&nw+hw>room){
    const share=Math.min(0.62,Math.max(0.38,nw/(nw+hw)));
    c.font=nameFont;
    if(nw>room*share){n=ellip(c,n,room*share);nw=c.measureText(n).width;}
    c.font=metaFont;
    if(hw>room-nw){h=ellip(c,h,room-nw);hw=c.measureText(h).width;}
  }
  return {name:n,nameW:nw,meta:h+(timeStr||"")};
}

/* ---- Twitch chat badges ---- */
function polyPath(c,cx,cy,r,n,rot){
  c.beginPath();
  for(let i=0;i<n;i++){
    const a=rot+i*2*Math.PI/n;
    const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
    i?c.lineTo(x,y):c.moveTo(x,y);
  }
  c.closePath();
}
function starPath(c,cx,cy,r,pts,inner,rot){
  c.beginPath();
  for(let i=0;i<pts*2;i++){
    const a=rot+i*Math.PI/pts, rr=(i%2)?r*inner:r;
    const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
    i?c.lineTo(x,y):c.moveTo(x,y);
  }
  c.closePath();
}
/* A cheer badge: rounded tile plus the tier glyph. Under 200k the tile carries
   the colour and the glyph is dark; above it the tile is indigo and the glyph
   carries the colour. */
export function drawCheer(c,tier,x,y,s){
  const row=CHEER.find(t=>t[0]===tier);if(!row)return;
  const col=row[2],cfg=row[3];
  const tile=cfg.inv?CHEER_INDIGO:col;
  const glyph=cfg.inv?col:"#2A2333";
  rr(c,x,y,s,s,s*0.22);c.fillStyle=tile;c.fill();
  const cx=x+s/2,cy=y+s/2,r=s*0.30;
  c.fillStyle=glyph;
  const up=-Math.PI/2;
  if(cfg.shape==="tri")polyPath(c,cx,cy+s*0.03,r*1.08,3,up);
  else if(cfg.shape==="diamond")polyPath(c,cx,cy,r*1.12,4,up);
  else if(cfg.shape==="pent")polyPath(c,cx,cy,r*1.08,5,up);
  else if(cfg.shape==="hex")polyPath(c,cx,cy,r*1.05,6,up);
  else if(cfg.shape==="star6")starPath(c,cx,cy,r*1.15,6,0.52,up);
  else starPath(c,cx,cy,r*1.18,8,0.55,up);
  c.fill();
}
/* subscriber and moderator tiles, drawn rather than fetched */
function drawSubBadge(c,x,y,s){
  rr(c,x,y,s,s,s*0.22);c.fillStyle="#2CB5A0";c.fill();
  c.fillStyle="#FFFFFF";
  const w=s*0.52,h=s*0.30,bx=x+(s-w)/2,by=y+s*0.36;
  c.beginPath();
  c.moveTo(bx,by+h);c.lineTo(bx,by-h*0.5);c.lineTo(bx+w*0.25,by+h*0.2);
  c.lineTo(bx+w*0.5,by-h*0.75);c.lineTo(bx+w*0.75,by+h*0.2);
  c.lineTo(bx+w,by-h*0.5);c.lineTo(bx+w,by+h);
  c.closePath();c.fill();
}
function drawModBadge(c,x,y,s){
  rr(c,x,y,s,s,s*0.22);c.fillStyle="#00AD03";c.fill();
  /* Twitch's moderator sword, pointing up-right */
  c.save();c.translate(x+s/2,y+s/2);c.rotate(-Math.PI/4);
  c.fillStyle="#FFFFFF";
  const L=s*0.62,w=s*0.13;
  c.fillRect(-w/2,-L/2,w,L*0.72);                    /* blade */
  c.beginPath();                                     /* tip */
  c.moveTo(-w/2,-L/2);c.lineTo(0,-L/2-s*0.09);c.lineTo(w/2,-L/2);c.closePath();c.fill();
  c.fillRect(-s*0.20,L*0.16,s*0.40,w*0.82);          /* crossguard */
  c.fillRect(-w*0.42,L*0.16,w*0.84,L*0.34);          /* grip */
  c.restore();
}
/* total width of the badge run, so the first text line can be indented past it */
function badgesWidth(bs,gap){
  let n=0;
  if(V_ON("badges")){
    if(S.cheer&&S.cheer!=="off")n++;
    if(S.subBadge)n++;
    if(S.modBadge)n++;
  }
  return n?n*(bs+gap):0;
}
function drawBadges(c,x,y,bs,gap){
  if(!V_ON("badges"))return 0;
  let bx=x;
  if(S.modBadge){drawModBadge(c,bx,y,bs);bx+=bs+gap;}
  if(S.subBadge){drawSubBadge(c,bx,y,bs);bx+=bs+gap;}
  if(S.cheer&&S.cheer!=="off"){drawCheer(c,S.cheer,bx,y,bs);bx+=bs+gap;}
  return bx-x;
}

const SCFG={
  "x-post":        {brand:"x",     variant:"x",    reply:false},
  "x-reply":       {brand:"x",     variant:"x",    reply:true},
  "reddit-post":   {brand:"reddit",variant:"rpost"},
  "reddit-comment":{brand:"reddit",variant:"rcom"},
  "yt-comment":    {brand:"yt",    variant:"ytcom"},
  "fb-post":       {brand:"fb",    variant:"fbpost"},
  "fb-comment":    {brand:"fb",    variant:"fbcom"},
  "ig-post":       {brand:"ig",    variant:"igpost"},
  "ig-comment":    {brand:"ig",    variant:"igcom"},
  "twitch-comment":{brand:"twitch",variant:"twitch"}
};

export function layoutSocial(c,fs){
  /* a design with no renderer config would throw deep inside paint; fall back to
     the closest thing instead so the canvas keeps working */
  const cfg=SCFG[S.design]||SCFG["x-post"];
  const brand=cfg.brand,V=cfg.variant,pal=brandPal();
  const cardW=Math.round(FW*(S.width/100));
  const noAv=!V_ON("avatar");        /* hidden avatar gives its gutter back */
  const noAct=!V_ON("actions");      /* hidden action row closes the footer */
  const L={kind:"social",fs,cardW,pal,brand,cfg,V,bodyFs:fs,bodyLh:Math.round(fs*1.38)};

  if(V==="x"){
    const pad=Math.round(fs*1.05),av=noAv?0:Math.round(fs*2.7),gap=noAv?0:Math.round(fs*0.62);
    const bodyX=pad+av+gap, bodyW=cardW-bodyX-pad;
    L.pad=pad;L.av=av;L.avShape=S.avShape||"circle";L.bodyX=bodyX;L.bodyW=bodyW;
    L.nameFs=Math.round(fs*0.94);L.metaFs=Math.round(fs*0.94);
    L.headTop=pad;L.headH=Math.round(fs*1.72);
    if(noAv&&!V_ON("name")&&!V_ON("handle")&&!V_ON("time"))L.headH=0;
    L.replyH=cfg.reply?Math.round(fs*1.5):0;
    L.bodyTop=pad+L.headH+L.replyH;
    const mb=measureBlock(c,S.text,S.ranges,bodyW,fs,SANS,L.bodyLh);
    L.lines=mb.lines;L.bodyH=mb.h;
    let cur=L.bodyTop+L.bodyH;
    if(S.media){
      L.mediaTop=cur+Math.round(fs*0.6);
      L.media={x:bodyX,w:bodyW,h:Math.min(bodyW*(S.media.height/S.media.width),fs*12)};
      cur=L.mediaTop+L.media.h;
      if(S.mediaSrc){L.srcFs=Math.round(fs*0.82);L.srcTop=cur+Math.round(fs*0.5);cur=L.srcTop+L.srcFs;}
    }
    L.footTop=cur+Math.round(fs*0.75);L.footH=noAct?0:Math.round(fs*1.25);
    L.cardH=(noAct?cur:L.footTop+L.footH)+pad*0.85;
  }
  else if(V==="fbpost"){
    const pad=Math.round(fs*0.95),av=noAv?0:Math.round(fs*2.85),gap=noAv?0:Math.round(fs*0.55);
    L.pad=pad;L.av=av;L.gap=gap;L.headX=pad+av+gap;
    L.nameFs=Math.round(fs*0.88);L.metaFs=Math.round(fs*0.72);
    L.headTop=pad;L.headH=av;
    L.bodyX=pad;L.bodyW=cardW-pad*2;
    L.bodyTop=pad+(noAv?Math.round(fs*1.9):av)+Math.round(fs*0.7);
    const mb=measureBlock(c,S.text,S.ranges,L.bodyW,fs,SANS,L.bodyLh);
    L.lines=mb.lines;L.bodyH=mb.h;
    let cur=L.bodyTop+L.bodyH;
    if(S.media){                                 /* full-bleed, edge to edge */
      L.mediaTop=cur+Math.round(fs*0.65);
      L.media={x:0,w:cardW,h:Math.min(cardW*(S.media.height/S.media.width),fs*13),bleed:true};
      cur=L.mediaTop+L.media.h;
    }
    L.countsTop=cur+Math.round(fs*1.0);L.countsFs=Math.round(fs*0.76);
    L.ruleTop=L.countsTop+Math.round(fs*0.62);
    L.actTop=L.ruleTop+Math.round(fs*0.35);L.actH=noAct?0:Math.round(fs*1.75);
    L.cardH=(noAct?L.countsTop+Math.round(fs*0.9):L.actTop+L.actH)+Math.round(fs*0.35);
  }
  else if(V==="fbcom"){
    const pad=Math.round(fs*0.9),av=noAv?0:Math.round(fs*2.6),gap=noAv?0:Math.round(fs*0.55);
    L.pad=pad;L.av=av;L.bodyX=pad+av+gap;
    L.nameFs=Math.round(fs*0.84);L.metaFs=Math.round(fs*0.76);
    L.rightW=Math.round(fs*3.4);                 /* reserved on the action row only */
    L.bodyW=cardW-L.bodyX-pad;                   /* text runs the full column */
    L.headTop=pad;L.headH=Math.round(fs*1.3);
    L.bodyTop=pad+L.headH;
    const mb=measureBlock(c,S.text,S.ranges,L.bodyW,fs,SANS,L.bodyLh);
    L.lines=mb.lines;L.bodyH=mb.h;
    L.actTop=L.bodyTop+L.bodyH+Math.round(fs*0.6);L.actH=noAct?0:Math.round(fs*1.35);
    L.cardH=Math.max(noAct?L.bodyTop+L.bodyH:L.actTop+L.actH,pad+av)+pad*0.7;
  }
  else if(V==="igpost"){
    const pad=Math.round(fs*0.95),av=noAv?0:Math.round(fs*2.4),gap=noAv?0:Math.round(fs*0.6);
    L.pad=pad;L.av=av;L.headX=pad+av+gap;
    L.nameFs=Math.round(fs*0.92);L.metaFs=Math.round(fs*0.76);
    L.headTop=pad;L.headH=av;
    L.mediaTop=pad+av+Math.round(fs*0.7);
    const mw=cardW;
    L.media=S.media?{x:0,w:mw,h:Math.min(mw*(S.media.height/S.media.width),fs*16),bleed:true}
                   :{x:0,w:mw,h:Math.round(mw*1.0),bleed:true,placeholder:true};
    L.actTop=L.mediaTop+L.media.h+Math.round(fs*0.75);L.actIS=noAct?0:Math.round(fs*1.5);
    L.capTop=L.actTop+L.actIS+Math.round(noAct?fs*0.2:fs*0.95);
    /* caption: bold username sits inline before the first line of text */
    c.font="600 "+fs+"px "+SANS;
    L.capName=(S.handle||S.name||"username")+" ";
    L.capIndent=c.measureText(L.capName).width;
    const mb=measureBlock(c,S.text,S.ranges,cardW-pad*2,fs,SANS,L.bodyLh,"",L.capIndent);
    L.lines=mb.lines;L.bodyH=mb.h;L.bodyX=pad;L.bodyW=cardW-pad*2;
    L.dateTop=L.capTop+L.bodyH+Math.round(fs*0.55);L.dateFs=Math.round(fs*0.76);
    L.cardH=L.dateTop+L.dateFs+pad;
  }
  else if(V==="igcom"){
    const pad=Math.round(fs*0.9),av=noAv?0:Math.round(fs*2.75),gap=noAv?0:Math.round(fs*0.62);
    L.pad=pad;L.av=av;L.bodyX=pad+av+gap;
    L.nameFs=Math.round(fs*0.84);L.metaFs=Math.round(fs*0.8);
    L.rightW=Math.round(fs*2.0);                 /* heart + count column */
    L.bodyW=cardW-L.bodyX-pad-L.rightW;
    L.headTop=pad;L.headH=Math.round(fs*1.25);
    L.bodyTop=pad+L.headH;
    const mb=measureBlock(c,S.text,S.ranges,L.bodyW,fs,SANS,L.bodyLh);
    L.lines=mb.lines;L.bodyH=mb.h;
    L.actTop=L.bodyTop+L.bodyH+Math.round(fs*0.5);L.actH=noAct?0:Math.round(fs*1.2);
    L.cardH=Math.max(noAct?L.bodyTop+L.bodyH:L.actTop+L.actH,pad+av)+pad*0.7;
  }
  else if(V==="twitch"){
    /* Chat is one flowing line: badges, then the coloured name and colon, then
       the message wrapping underneath. The first-line indent handles that. */
    const pad=Math.round(fs*0.85);
    L.pad=pad;L.bodyX=pad;L.bodyW=cardW-pad*2;
    L.bs=Math.round(fs*0.92);L.bgap=Math.round(fs*0.16);
    L.replyH=(S.sub&&S.sub.trim())?Math.round(fs*1.35):0;
    L.headTop=pad;
    L.bodyTop=pad+L.replyH;
    c.font="700 "+fs+"px "+SANS;
    L.nameTxt=V_ON("handle")?((S.handle||"username")+":"):"";
    L.nameW=L.nameTxt?c.measureText(L.nameTxt+" ").width:0;
    L.timeTxt=(S.time&&V_ON("time"))?S.time+" ":"";
    c.font=Math.round(fs*0.82)+"px "+SANS;
    L.timeW=L.timeTxt?c.measureText(L.timeTxt).width:0;
    L.indent=L.timeW+badgesWidth(L.bs,L.bgap)+L.nameW;
    const mb=measureBlock(c,S.text,S.ranges,L.bodyW,fs,SANS,L.bodyLh,"",L.indent);
    L.lines=mb.lines;L.bodyH=mb.h;
    L.cardH=L.bodyTop+L.bodyH+pad;
  }
  else {  /* reddit + youtube */
    const title=(V==="rpost");
    const pad=Math.round(fs*0.9),av=noAv?0:(title?Math.round(fs*1.75):Math.round(fs*2.0)),gap=noAv?0:Math.round(fs*0.5);
    L.pad=pad;L.av=av;L.bodyX=title?pad:(pad+av+gap);L.headX=pad+av+gap;
    L.nameFs=Math.round(fs*0.86);L.metaFs=Math.round(fs*0.8);
    L.headTop=pad;L.headH=title?av+Math.round(fs*0.55):Math.round(fs*1.25);
    L.bodyTop=pad+L.headH;
    L.bodyW=cardW-L.bodyX-pad;
    L.titleWeight=title?"700 ":"";
    const mb=measureBlock(c,S.text,S.ranges,L.bodyW,fs,SANS,L.bodyLh,L.titleWeight);
    L.lines=mb.lines;L.bodyH=mb.h;
    let cur=L.bodyTop+L.bodyH;
    if(S.media&&title){
      L.mediaTop=cur+Math.round(fs*0.6);
      L.media={x:L.bodyX,w:L.bodyW,h:Math.min(L.bodyW*(S.media.height/S.media.width),fs*12)};
      cur=L.mediaTop+L.media.h;
    }
    if(V!=="rpost")cur=Math.max(cur,pad+av);
    L.footTop=cur+Math.round(fs*0.6);L.footH=noAct?0:(title?Math.round(fs*1.9):Math.round(fs*1.3));
    L.cardH=(noAct?cur:L.footTop+L.footH)+pad*0.7;
  }
  L.cardH=Math.round(L.cardH);
  return L;
}

export function paintSocial(c,L,A){
  const X=L.x,Y=L.y,W=L.cardW,H=L.cardH,fs=L.fs,pal=L.pal,V=L.V;
  const hp=A?A.hp:1;
  const radius=(V==="igpost"||V==="fbpost")?Math.round(fs*0.35):Math.round(fs*0.6);
  c.save();c.shadowColor="rgba(0,0,0,.4)";c.shadowBlur=fs*0.8;c.shadowOffsetY=fs*0.28;
  c.fillStyle=pal.bg;rr(c,X,Y,W,H,radius);c.fill();c.restore();
  if(themeKey()==="light"){c.strokeStyle=pal.rule;c.lineWidth=Math.max(1,fs*0.022);rr(c,X,Y,W,H,radius);c.stroke();}
  /* keep full-bleed media inside the rounded card */
  c.save();rr(c,X,Y,W,H,radius);c.clip();
  if(V==="x")paintX(c,L,hp);
  else if(V==="fbpost")paintFbPost(c,L,hp);
  else if(V==="fbcom")paintFbComment(c,L,hp);
  else if(V==="igpost")paintIgPost(c,L,hp);
  else if(V==="igcom")paintIgComment(c,L,hp);
  else if(V==="twitch")paintTwitch(c,L,hp);
  else paintRedditYt(c,L,hp);
  c.restore();
}
function drawMedia(c,L,X,Y){
  const m=L.media;if(!m)return;
  const mx=X+m.x,my=Y+L.mediaTop,fs=L.fs;
  const radius=m.bleed?0:Math.round(fs*0.42);
  c.save();
  if(radius)rr(c,mx,my,m.w,m.h,radius);else{c.beginPath();c.rect(mx,my,m.w,m.h);}
  c.clip();
  if(m.placeholder||!S.media){
    c.fillStyle=themeKey()==="dark"?"#2A2A2C":"#E4E6EB";c.fillRect(mx,my,m.w,m.h);
    c.fillStyle=themeKey()==="dark"?"#4A4A4E":"#BCC0C4";
    const s=Math.min(m.w,m.h)*0.16;drawIcon(c,"igComment",mx+m.w/2-s/2,my+m.h/2-s/2,s,c.fillStyle);
  }else{
    drawFitted(c,S.media,mx,my,m.w,m.h,S.mediaScale,S.mediaX,S.mediaY);
  }
  c.restore();
  if(!m.bleed){c.strokeStyle=L.pal.rule;c.lineWidth=Math.max(1,fs*0.02);rr(c,mx,my,m.w,m.h,radius);c.stroke();}
}
function body(c,L,X,Y,hp,x,top,weight){
  paintBlock(c,{text:S.text,rs:S.ranges,lines:L.lines,x:X+x,y:Y+top,fs:L.bodyFs,lh:L.bodyLh,
    face:SANS,ink:L.pal.ink,hlColor:S.hlColor,hlStyle:S.hlStyle,hp,weight:weight||""});
}

/* ---- X / Twitter ---- */
function paintX(c,L,hp){
  const X=L.x,Y=L.y,fs=L.fs,pal=L.pal,pad=L.pad,av=L.av;
  if(V_ON("avatar"))drawAvatar(c,X+pad,Y+L.headTop,av,L.avShape);
  const hx=X+L.bodyX;
  const base=Y+L.headTop+L.nameFs*1.02;          /* name sits at the top of the column */
  const hcy=base-L.nameFs*0.32;                  /* trailing glyphs centre on the name line */
  const dotsS=Math.round(fs*1.05);
  const rightEdge=X+L.cardW-pad;
  let resv=0;
  if(V_ON("menu")){drawIcon(c,"dots",rightEdge-dotsS,hcy-dotsS/2,dotsS,pal.sub);resv=dotsS+fs*0.4;}
  const nameFont="700 "+L.nameFs+"px "+SANS,metaFont=L.metaFs+"px "+SANS;
  const showBadge=S.badge!=="off"&&V_ON("badge");
  const badgeW=showBadge?L.nameFs*1.24:0;
  const nameTxt=V_ON("name")?(S.name||"Name"):"";
  const handleTxt=V_ON("handle")?" @"+(S.handle||"handle"):"";
  const timeTxt=(S.time&&V_ON("time"))?(nameTxt||handleTxt?" · ":"")+S.time:"";
  const run=fitXHead(c,nameFont,nameTxt,metaFont,handleTxt,timeTxt,rightEdge-resv-hx,badgeW);
  c.font=nameFont;c.fillStyle=pal.ink;c.fillText(run.name,hx,base);
  let cx=hx+run.nameW;
  if(badgeW){const bs=L.nameFs*1.06;
    drawIcon(c,"verified",cx+fs*0.12,base-bs*0.82,bs,S.badge==="gold"?"#E2B719":pal.badge);cx+=badgeW;}
  c.font=metaFont;c.fillStyle=pal.sub;c.fillText(run.meta,cx,base);
  if(L.cfg.reply){
    const ry=Y+L.bodyTop-L.replyH+fs*1.0;
    c.font=L.metaFs+"px "+SANS;c.fillStyle=pal.sub;
    c.fillText("Replying to ",X+L.bodyX,ry);
    const w=c.measureText("Replying to ").width;
    c.fillStyle=pal.accent;
    c.fillText(ellip(c,"@"+(S.sub||"user"),L.bodyW-w),X+L.bodyX+w,ry);
  }
  body(c,L,X,Y,hp,L.bodyX,L.bodyTop);
  drawMedia(c,L,X,Y);
  if(L.srcTop){c.font=L.srcFs+"px "+SANS;c.fillStyle=pal.sub;
    c.fillText(ellip(c,"From "+S.mediaSrc,L.bodyW),X+L.bodyX,Y+L.srcTop+L.srcFs*0.85);}
  /* action bar: 4 metric groups spread, bookmark + share pinned right.
     Widths are measured so a count can never run into the next icon. */
  const fy=Y+L.footTop+L.footH*0.5;
  const items=[["xReply","replies"],["xRetweet","retweets"],
               [S.likeOn?"xHeartOn":"xHeart","likes",S.likeOn?pal.like:null],["xViews","views"]]
    .filter(it=>V_ON(it[1]))
    .map(it=>[it[0],gc(it[1]),it[2]]);
  const usable=L.cardW-L.bodyX-pad;
  let iS,cfs,gaps,widths,tail=true;
  for(let k=0;k<8;k++){                          /* shrink until the row fits */
    iS=Math.round(fs*(1.0-k*0.06));cfs=Math.round(fs*(0.78-k*0.045));
    c.font=cfs+"px "+SANS;
    widths=items.map(it=>iS+(it[1]?fs*0.2+c.measureText(it[1]).width:0));
    gaps=(usable-widths.reduce((a,b)=>a+b,0)-(iS*2+fs*1.15))/Math.max(1,items.length);
    if(gaps>=fs*0.3)break;
  }
  if(!V_ON("bookmark"))tail=false;
  if(tail&&gaps<fs*0.12){
    /* still cramped: drop bookmark + share rather than overlap the counts */
    tail=false;
  }
  if(!tail){
    gaps=(usable-widths.reduce((a,b)=>a+b,0))/Math.max(1,items.length-0.8);
    gaps=Math.max(gaps,fs*0.1);
  }
  c.font=cfs+"px "+SANS;
  let ix=X+L.bodyX;
  items.forEach((it,i)=>{
    const col=it[2]||pal.sub;
    drawIcon(c,it[0],ix,fy-iS/2,iS,col);
    if(it[1]){c.fillStyle=col;c.textBaseline="middle";
      c.fillText(it[1],ix+iS+fs*0.2,fy+fs*0.02);c.textBaseline="alphabetic";}
    ix+=widths[i]+gaps;
  });
  if(tail){
    const shareX=X+L.cardW-pad-iS;
    drawIcon(c,"xBookmark",shareX-iS-fs*1.15,fy-iS/2,iS,pal.sub);
    drawIcon(c,"xShare",shareX,fy-iS/2,iS,pal.sub);
  }
}

/* ---- Facebook post ---- */
function paintFbPost(c,L,hp){
  const X=L.x,Y=L.y,fs=L.fs,pal=L.pal,pad=L.pad,av=L.av;
  if(V_ON("avatar"))drawAvatar(c,X+pad,Y+L.headTop,av);
  const hx=X+L.headX,top=Y+L.headTop,right=X+L.cardW-pad;
  const dotsS=Math.round(fs*1.05);
  if(V_ON("menu"))drawIcon(c,"dots",right-dotsS,top+av*0.28,dotsS,pal.sub);
  /* line 1: name (+ badge) (+ · Follow) */
  c.font="700 "+L.nameFs+"px "+SANS;
  const badgeW=(S.badge!=="off"&&V_ON("badge"))?L.nameFs*1.2:0;
  const followTxt=S.follow?" · Follow":"";
  c.font="700 "+L.nameFs+"px "+SANS;const fw=followTxt?c.measureText(followTxt).width:0;
  const nm=V_ON("name")?ellip(c,S.name||"Name",right-dotsS-fs*0.5-hx-badgeW-fw):"";
  const b1=top+L.nameFs*1.02;
  c.fillStyle=pal.ink;c.fillText(nm,hx,b1);
  let cx=hx+c.measureText(nm).width;
  if(badgeW){const bs=L.nameFs*1.0;drawIcon(c,"verified",cx+fs*0.1,b1-bs*0.82,bs,pal.badge);cx+=badgeW;}
  if(followTxt){c.fillStyle=pal.accent;c.fillText(followTxt,cx,b1);}
  /* line 2: time · globe */
  const b2=top+av*0.82;
  if(V_ON("time")){
    c.font=L.metaFs+"px "+SANS;c.fillStyle=pal.sub;
    const tstr=(S.time||"2h")+" · ";c.fillText(tstr,hx,b2);
    const gS=Math.round(L.metaFs*1.0);
    drawIcon(c,"globe",hx+c.measureText(tstr).width,b2-gS*0.82,gS,pal.sub);
  }
  body(c,L,X,Y,hp,L.bodyX,L.bodyTop);
  drawMedia(c,L,X,Y);
  /* reaction counts */
  const cy=Y+L.countsTop,tS=Math.round(fs*0.95);
  c.font=L.countsFs+"px "+SANS;c.textBaseline="middle";
  const lc=gc("likes");
  if(lc){
    c.fillStyle=pal.accent;c.beginPath();c.arc(X+pad+tS*0.45,cy,tS*0.45,0,7);c.fill();
    drawIcon(c,"fbThumb",X+pad+tS*0.16,cy-tS*0.29,tS*0.58,"#FFFFFF");
    c.fillStyle=pal.sub;c.fillText(lc,X+pad+tS*1.15,cy);
  }
  const bits=[];
  if(gc("replies"))bits.push(gc("replies")+" comments");
  if(gc("retweets"))bits.push(gc("retweets")+" shares");
  if(bits.length){c.fillStyle=pal.sub;c.textAlign="right";
    c.fillText(bits.join("   "),X+L.cardW-pad,cy);c.textAlign="left";}
  c.textBaseline="alphabetic";
  if(!V_ON("actions"))return;
  /* divider + action row */
  c.fillStyle=pal.rule;c.fillRect(X+pad,Y+L.ruleTop,L.cardW-pad*2,Math.max(1,fs*0.02));
  const iS=Math.round(fs*1.35),ay=Y+L.actTop+L.actH*0.5,third=(L.cardW-pad*2)/3;
  c.font="600 "+Math.round(fs*0.8)+"px "+SANS;
  [["fbThumb","Like"],["fbComment","Comment"],["fbShare","Share"]].forEach((a,i)=>{
    const mid=X+pad+third*i+third/2,lw=c.measureText(a[1]).width,tot=iS+fs*0.28+lw;
    drawIcon(c,a[0],mid-tot/2,ay-iS/2,iS,pal.sub);
    c.fillStyle=pal.sub;c.textBaseline="middle";c.fillText(a[1],mid-tot/2+iS+fs*0.28,ay+fs*0.02);c.textBaseline="alphabetic";
  });
}

/* ---- Facebook comment (plain text, reaction pill, thumbs right) ---- */
function paintFbComment(c,L,hp){
  const X=L.x,Y=L.y,fs=L.fs,pal=L.pal,pad=L.pad,av=L.av;
  if(V_ON("avatar"))drawAvatar(c,X+pad,Y+L.headTop,av);
  const hx=X+L.bodyX,top=Y+L.headTop;
  const b1=top+L.nameFs*1.0;
  c.font="700 "+L.nameFs+"px "+SANS;c.fillStyle=pal.ink;
  const nm=V_ON("name")?ellip(c,S.name||"Name",L.bodyW*0.7):"";
  c.fillText(nm,hx,b1);
  let cx=hx+c.measureText(nm).width;
  if(S.badge!=="off"&&V_ON("badge")){const bs=L.nameFs*0.95;drawIcon(c,"verified",cx+fs*0.1,b1-bs*0.8,bs,pal.badge);cx+=bs+fs*0.12;}
  if(V_ON("time")){c.font=L.metaFs+"px "+SANS;c.fillStyle=pal.sub;
    c.fillText((nm?" · ":"")+(S.time||"5d"),cx,b1);}
  body(c,L,X,Y,hp,L.bodyX,L.bodyTop);
  /* Reply + reaction pill */
  if(!V_ON("actions"))return;
  const ay=Y+L.actTop+L.actH*0.5;
  c.font="600 "+Math.round(fs*0.78)+"px "+SANS;c.fillStyle=pal.sub;
  c.textBaseline="middle";c.fillText("Reply",hx,ay);
  const rw=c.measureText("Reply").width;
  const lc=gc("likes");
  if(lc&&V_ON("likes")){
    const tS=Math.round(fs*1.0),px=hx+rw+fs*1.5;
    c.fillStyle=pal.accent;c.beginPath();c.arc(px+tS*0.5,ay,tS*0.5,0,7);c.fill();
    drawIcon(c,"fbThumb",px+tS*0.18,ay-tS*0.32,tS*0.64,"#FFFFFF");
    c.fillStyle=pal.sub;c.fillText(lc,px+tS*1.3,ay);
  }
  c.textBaseline="alphabetic";
  /* thumb up then thumb down on the right */
  const iS=Math.round(fs*1.15),right=X+L.cardW-pad;
  drawIcon(c,"fbThumb",right-iS,ay-iS/2,iS,pal.sub,180);
  drawIcon(c,"fbThumb",right-iS*2.6,ay-iS/2,iS,pal.sub);
}

/* ---- Instagram post ---- */
function paintIgPost(c,L,hp){
  const X=L.x,Y=L.y,fs=L.fs,pal=L.pal,pad=L.pad,av=L.av;
  if(V_ON("avatar"))drawAvatar(c,X+pad,Y+L.headTop,av);
  const hx=X+L.headX,top=Y+L.headTop,right=X+L.cardW-pad;
  const menuS=Math.round(fs*1.15);
  if(V_ON("menu"))drawIcon(c,"igMenu",right-menuS,top+av*0.5-menuS/2,menuS,pal.ink);
  /* Follow pill */
  let fRight=right-menuS-fs*0.7;
  if(S.follow){
    c.font="700 "+Math.round(fs*0.82)+"px "+SANS;
    const t="Follow",tw=c.measureText(t).width,bw=tw+fs*1.5,bh=Math.round(fs*1.5);
    const bxp=fRight-bw,byp=top+av*0.5-bh/2;
    c.fillStyle=themeKey()==="dark"?"#363636":"#EFEFEF";rr(c,bxp,byp,bw,bh,fs*0.35);c.fill();
    c.fillStyle=pal.ink;c.textAlign="center";c.textBaseline="middle";
    c.fillText(t,bxp+bw/2,byp+bh/2+fs*0.02);c.textAlign="left";c.textBaseline="alphabetic";
    fRight=bxp-fs*0.5;
  }
  c.font="600 "+L.nameFs+"px "+SANS;c.fillStyle=pal.ink;
  const un=V_ON("handle")?ellip(c,S.handle||S.name||"username",fRight-hx):"";
  const b1=top+L.nameFs*0.98;
  c.fillText(un,hx,b1);
  let cx=hx+c.measureText(un).width;
  if(S.badge!=="off"&&V_ON("badge")){const bs=L.nameFs*0.9;drawIcon(c,"verified",cx+fs*0.1,b1-bs*0.8,bs,pal.badge);}
  if(S.audio){
    const mS=Math.round(L.metaFs*0.95),b2=top+av*0.85;
    drawIcon(c,"igMusic",hx,b2-mS*0.85,mS,pal.sub);
    c.font=L.metaFs+"px "+SANS;c.fillStyle=pal.sub;
    c.fillText(ellip(c," "+S.audio,fRight-hx-mS),hx+mS,b2);
  }
  drawMedia(c,L,X,Y);
  /* action row */
  if(V_ON("actions")){
    const iS=L.actIS,ay=Y+L.actTop;
    let ix=X+pad;
    c.font=Math.round(fs*0.84)+"px "+SANS;c.textBaseline="middle";
    const acts=[[S.likeOn?"xHeartOn":"igHeart","","likes",S.likeOn?pal.like:null],
                ["igComment",gc("replies"),"replies"],
                ["igReshare",gc("retweets"),"retweets"],
                ["igSend","","send"]];
    acts.forEach(a=>{
      if(a[2]!=="send"&&!V_ON(a[2]))return;
      drawIcon(c,a[0],ix,ay,iS,a[3]||pal.ink);ix+=iS;
      if(a[1]){c.fillStyle=pal.ink;c.fillText(a[1],ix+fs*0.22,ay+iS/2);ix+=c.measureText(a[1]).width+fs*0.22;}
      ix+=fs*0.85;
    });
    if(V_ON("bookmark"))drawIcon(c,"igBookmark",X+L.cardW-pad-iS,ay,iS,pal.ink);
    c.textBaseline="alphabetic";
  }
  /* caption: bold username inline, text flows around it */
  c.font="600 "+L.bodyFs+"px "+SANS;c.fillStyle=pal.ink;
  c.fillText(L.capName,X+pad,Y+L.capTop+L.bodyFs*0.82);
  paintBlock(c,{text:S.text,rs:S.ranges,lines:L.lines,x:X+L.bodyX,y:Y+L.capTop,
    fs:L.bodyFs,lh:L.bodyLh,face:SANS,ink:pal.ink,hlColor:S.hlColor,hlStyle:S.hlStyle,
    hp,indent:L.capIndent});
  if(V_ON("time")){c.font=L.dateFs+"px "+SANS;c.fillStyle=pal.sub;
    c.fillText(S.time||"July 13",X+pad,Y+L.dateTop+L.dateFs*0.85);}
}

/* ---- Instagram comment ---- */
function paintIgComment(c,L,hp){
  const X=L.x,Y=L.y,fs=L.fs,pal=L.pal,pad=L.pad,av=L.av;
  if(V_ON("avatar"))drawAvatar(c,X+pad,Y+L.headTop,av);
  const hx=X+L.bodyX,top=Y+L.headTop,b1=top+L.nameFs*1.0;
  c.font="600 "+L.nameFs+"px "+SANS;c.fillStyle=pal.ink;
  const un=V_ON("handle")?ellip(c,S.handle||S.name||"username",L.bodyW*0.66):"";
  c.fillText(un,hx,b1);
  let cx=hx+c.measureText(un).width;
  if(S.badge!=="off"&&V_ON("badge")){const bs=L.nameFs*0.9;drawIcon(c,"verified",cx+fs*0.1,b1-bs*0.8,bs,pal.badge);cx+=bs+fs*0.14;}
  if(V_ON("time")){c.font=L.metaFs+"px "+SANS;c.fillStyle=pal.sub;c.fillText("  "+(S.time||"1w"),cx,b1);}
  body(c,L,X,Y,hp,L.bodyX,L.bodyTop);
  if(V_ON("actions")){
    c.font="500 "+Math.round(fs*0.78)+"px "+SANS;c.fillStyle=pal.sub;
    c.textBaseline="middle";c.fillText("Reply",hx,Y+L.actTop+L.actH*0.5);c.textBaseline="alphabetic";
  }
  /* heart + count, right column */
  if(V_ON("likes")){
    const iS=Math.round(fs*1.1),hcx=X+L.cardW-pad-iS/2,hy=top+fs*0.15;
    drawIcon(c,S.likeOn?"xHeartOn":"igHeart",hcx-iS/2,hy,iS,S.likeOn?pal.like:pal.sub);
    const lc=gc("likes");
    if(lc){
      c.font=Math.round(fs*0.72)+"px "+SANS;c.fillStyle=pal.sub;c.textAlign="center";
      c.fillText(lc,hcx,hy+iS+fs*0.68);c.textAlign="left";
    }
  }
}

/* ---- Twitch chat ---- */
function paintTwitch(c,L,hp){
  const X=L.x,Y=L.y,fs=L.fs,pal=L.pal,pad=L.pad;
  /* optional reply context, as Twitch shows above a threaded reply */
  if(L.replyH){
    const ry=Y+pad+fs*0.9,gs=Math.round(fs*0.82);
    c.fillStyle=pal.sub;
    drawIcon(c,"fbComment",X+pad,ry-gs*0.82,gs,pal.sub);
    c.font=Math.round(fs*0.82)+"px "+SANS;
    const lead="Replying to @"+(S.sub||"user").replace(/^@/,"");
    c.fillText(ellip(c,lead,L.bodyW-gs-fs*0.3),X+pad+gs+fs*0.28,ry);
  }
  /* badges + name sit on the first line; the message flows around them */
  const base=Y+L.bodyTop+fs*0.82;
  let bx=X+L.bodyX;
  if(L.timeTxt){
    c.font=Math.round(fs*0.82)+"px "+SANS;c.fillStyle=pal.sub;
    c.fillText(L.timeTxt,bx,base);bx+=L.timeW;
  }
  bx+=drawBadges(c,bx,base-L.bs*0.82,L.bs,L.bgap);
  if(L.nameTxt){
    c.font="700 "+fs+"px "+SANS;c.fillStyle=S.nameColor||pal.accent;
    c.fillText(L.nameTxt,bx,base);
  }
  paintBlock(c,{text:S.text,rs:S.ranges,lines:L.lines,x:X+L.bodyX,y:Y+L.bodyTop,
    fs:L.bodyFs,lh:L.bodyLh,face:SANS,ink:pal.ink,hlColor:S.hlColor,hlStyle:S.hlStyle,
    hp,indent:L.indent});
}

/* ---- Reddit + YouTube ---- */
function paintRedditYt(c,L,hp){
  const X=L.x,Y=L.y,fs=L.fs,pal=L.pal,pad=L.pad,av=L.av,V=L.V;
  const top=Y+L.headTop,right=X+L.cardW-pad;
  if(V==="rpost"){
    c.save();avatarPath(c,X+pad,top,av);c.clip();
    c.fillStyle="#FF4500";c.fillRect(X+pad,top,av,av);
    if(S.avatar)drawFitted(c,S.avatar,X+pad,top,av,av,S.avatarScale,S.avatarX,S.avatarY);
    c.restore();
    const hx=X+L.headX,b=top+av*0.5+L.nameFs*0.34,dotsS=Math.round(fs*1.0);
    if(V_ON("menu"))drawIcon(c,"dots",right-dotsS,top+av*0.5-dotsS/2,dotsS,pal.sub);
    c.font="700 "+L.nameFs+"px "+SANS;
    const sr=ellip(c,"r/"+(S.sub||"subreddit"),(right-dotsS-fs*0.5-hx)*0.7);
    c.fillStyle=pal.ink;c.fillText(sr,hx,b);
    const w=c.measureText(sr).width;
    if(V_ON("time")){c.font=L.metaFs+"px "+SANS;c.fillStyle=pal.sub;
      c.fillText(ellip(c," · "+(S.time||"5h"),right-dotsS-fs*0.5-hx-w),hx+w,b);}
  }else{
    if(V_ON("avatar"))drawAvatar(c,X+pad,top,av);
    const hx=X+L.headX,b=top+L.nameFs*1.0;
    c.font="600 "+L.nameFs+"px "+SANS;c.fillStyle=pal.ink;
    const wantLabel=(V==="rcom")?V_ON("handle"):V_ON("name");
    const label=(V==="rcom")?("u/"+(S.handle||"user")):(S.name||"Name");
    const nm=wantLabel?ellip(c,label,(right-hx)*0.62):"";
    c.fillText(nm,hx,b);const w=c.measureText(nm).width;
    if(V_ON("time")){c.font=L.metaFs+"px "+SANS;c.fillStyle=pal.sub;
      c.fillText(ellip(c,(nm?" · ":"")+(S.time||"5h"),right-hx-w),hx+w,b);}
  }
  body(c,L,X,Y,hp,L.bodyX,L.bodyTop,L.titleWeight);
  drawMedia(c,L,X,Y);
  if(!V_ON("actions"))return;
  const iS=Math.round(fs*1.05),fy=Y+L.footTop+L.footH*0.5;
  if(V==="rpost"){
    const pillH=Math.round(fs*1.65),py=fy-pillH/2;
    const bg=themeKey()==="dark"?"#272729":"#EDEFF1";
    c.font="600 "+Math.round(fs*0.76)+"px "+SANS;
    let px=X+L.bodyX;
    const pill=(w)=>{c.fillStyle=bg;rr(c,px,py,w,pillH,pillH/2);c.fill();};
    const vc=gc("likes")||"Vote",vw=iS*2+c.measureText(vc).width+fs*1.4;
    pill(vw);
    drawIcon(c,"rUp",px+fs*0.4,fy-iS/2,iS,pal.accent);
    c.fillStyle=pal.ink;c.textBaseline="middle";c.fillText(vc,px+fs*0.4+iS+fs*0.25,fy);c.textBaseline="alphabetic";
    drawIcon(c,"rDown",px+vw-iS-fs*0.4,fy-iS/2,iS,pal.sub);
    px+=vw+fs*0.5;
    const cc=gc("replies"),cw=iS+c.measureText(cc).width+fs*1.2;
    pill(cw);drawIcon(c,"fbComment",px+fs*0.45,fy-iS/2,iS,pal.sub);
    c.fillStyle=pal.ink;c.textBaseline="middle";c.fillText(cc,px+fs*0.45+iS+fs*0.28,fy);c.textBaseline="alphabetic";
    px+=cw+fs*0.5;
    const sw=iS+c.measureText("Share").width+fs*1.2;
    pill(sw);drawIcon(c,"fbShare",px+fs*0.45,fy-iS/2,iS,pal.sub);
    c.fillStyle=pal.ink;c.textBaseline="middle";c.fillText("Share",px+fs*0.45+iS+fs*0.28,fy);c.textBaseline="alphabetic";
  }else if(V==="rcom"){
    let ix=X+L.bodyX;
    c.font="600 "+Math.round(fs*0.76)+"px "+SANS;c.textBaseline="middle";
    drawIcon(c,"rUp",ix,fy-iS/2,iS,pal.sub);ix+=iS+fs*0.22;
    c.fillStyle=pal.ink;c.fillText(gc("likes"),ix,fy);ix+=c.measureText(gc("likes")).width+fs*0.22;
    drawIcon(c,"rDown",ix,fy-iS/2,iS,pal.sub);ix+=iS+fs*0.85;
    drawIcon(c,"fbComment",ix,fy-iS/2,iS,pal.sub);ix+=iS+fs*0.28;
    c.fillStyle=pal.sub;c.fillText("Reply",ix,fy);c.textBaseline="alphabetic";
  }else{
    let ix=X+L.bodyX;
    c.font=Math.round(fs*0.76)+"px "+SANS;c.textBaseline="middle";
    drawIcon(c,"ytThumb",ix,fy-iS/2,iS,pal.sub);ix+=iS+fs*0.22;
    c.fillStyle=pal.sub;c.fillText(gc("likes"),ix,fy);ix+=c.measureText(gc("likes")).width+fs*0.8;
    drawIcon(c,"ytThumb",ix,fy-iS/2,iS,pal.sub,180);ix+=iS+fs*0.9;
    c.font="600 "+Math.round(fs*0.76)+"px "+SANS;c.fillStyle=pal.sub;c.fillText("Reply",ix,fy);
    c.textBaseline="alphabetic";
  }
}
