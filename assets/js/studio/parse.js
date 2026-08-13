/* parse.js — The shotlist parser.

   One paste has to survive the trip from a chat window, so the grammar is
   line-based, order-independent inside a line, and forgiving about the
   characters a chat client rewrites on the way out (en dashes, curly quotes,
   non-breaking spaces). Nothing here throws: an unreadable line becomes a
   warning and the rest of the paste still lands on the timeline.

   ── The block ────────────────────────────────────────────────────────────
   Everything the studio needs sits in one fenced block. Claude keeps writing
   the readable answer above it; only the block is parsed.

     ```shotlist
     TITLE  Rockstar Just Followed 6 People
     FPS    30
     SIZE   2160x3840
     ACCENT #FF5C3A
     MEDIA  gameplay=gta-chase.mp4, vo=ep41.wav, haaland=haaland.jpg

     SAY   0:00-0:03 | Rockstar Games doesn't follow people.
     SAY   0:03-0:05 | This week, it followed six.

     LIST  0:03-0:08 | slot=center | step=0.6 | blur=on
           | items=Jynxzi; MoistCr1TiKaL; Valkyrae; Fuslie; TimTheTatman; xQc
     STAMP 0:09-0:14 | REPORTEDLY | anim=slam
     IMAGE 0:21-0:25 | src=haaland | label=Erling Haaland | slot=right | blur=on
     LOWER 0:00-0:30 | GTA BOOM · Notebookcheck
     ```

   ── Lines ────────────────────────────────────────────────────────────────
   A directive is `KEY value`. An element is `TYPE <time> | field | field …`,
   where a field is either `key=value` or bare text (the element's own text).
   A line starting with `|` continues the line above, so a long field list can
   wrap without breaking. `#` starts a comment.

   ── Time ─────────────────────────────────────────────────────────────────
   `0:03-0:08`, `3-8`, `3.5..8`, `0:03+5` (start plus duration), `90f-240f`.
   Separators may be `-`, `–`, `—`, `..` or `to`; `f` means frames at FPS.

   ── Fallback ─────────────────────────────────────────────────────────────
   Paste an ordinary Claude answer with no block and `parseScript()` reads the
   Script section and the Visual beats table instead: spoken lines get timed
   from their word count, table rows become beat markers, and any quoted text
   inside a row becomes a real on-screen element. It is a starting point, not
   a substitute for the block. */

export const TYPES = {
  say:   {kind:"say",   label:"Voice line"},
  text:  {kind:"vis",   label:"Text"},
  stamp: {kind:"vis",   label:"Stamp"},
  list:  {kind:"vis",   label:"Name list"},
  lower: {kind:"vis",   label:"Lower third"},
  image: {kind:"vis",   label:"Image"},
  card:  {kind:"vis",   label:"Card"},
  bg:    {kind:"bg",    label:"Background"},
  beat:  {kind:"note",  label:"Beat"}
};
/* Words a script writer reaches for that mean the same element. */
const ALIAS = {
  vo:"say", line:"say", speak:"say", narr:"say", script:"say",
  title:"text", headline:"text", chyron:"text", caption:"text", txt:"text",
  slam:"stamp", impact:"stamp", word:"stamp",
  names:"list", roster:"list", bullets:"list", items:"list",
  third:"lower", source:"lower", ticker:"lower", strap:"lower",
  img:"image", logo:"image", photo:"image", pic:"image", graphic:"image",
  quote:"card", post:"card", tweet:"card", slate:"card",
  background:"bg", gameplay:"bg", plate:"bg",
  note:"beat", marker:"beat", visual:"beat"
};

/* Chat clients rewrite punctuation on the way out. Normalise before anything
   tries to match on it, or an en dash silently kills a whole time range. */
function tidy(s){
  return String(s||"")
    .replace(/\r\n?/g,"\n")
    .replace(/[‘’‛]/g,"'")
    .replace(/[“”]/g,'"')
    .replace(/[   ]/g," ")
    .replace(/[‐‑‒–—―]/g,"-");
}

/* ---------- time ---------- */
/* Returns seconds, or null when the token is not a time at all. */
export function parseTime(tok,fps){
  if(tok==null)return null;
  let s=String(tok).trim().toLowerCase().replace(/[,;]$/,"");
  if(!s)return null;
  const fr=s.match(/^(\d+(?:\.\d+)?)f$/);
  if(fr)return (+fr[1])/(fps||30);
  s=s.replace(/(sec|secs|s)$/,"");
  const parts=s.split(":");
  if(parts.length>3)return null;
  let mult=1,total=0,seen=false;
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i].trim();
    if(!/^\d+(\.\d+)?$/.test(p))return null;
    total+=parseFloat(p)*mult;mult*=60;seen=true;
  }
  return seen?total:null;
}
const RANGE_SPLIT=/\s*(?:\.\.|-|\bto\b)\s*/;
/* "0:03-0:08" | "0:03+5" | "0:03" → {t0,t1} in seconds. */
export function parseRange(str,fps,fallbackDur){
  const s=String(str||"").trim();
  if(!s)return null;
  const plus=s.split(/\s*\+\s*/);
  if(plus.length===2){
    const a=parseTime(plus[0],fps),d=parseTime(plus[1],fps);
    if(a==null||d==null)return null;
    return {t0:a,t1:a+Math.max(0.05,d)};
  }
  const bits=s.split(RANGE_SPLIT).filter(x=>x!=="");
  if(bits.length>=2){
    const a=parseTime(bits[0],fps),b=parseTime(bits[1],fps);
    if(a==null||b==null)return null;
    return {t0:Math.min(a,b),t1:Math.max(a,b)};
  }
  const a=parseTime(s,fps);
  if(a==null)return null;
  return {t0:a,t1:a+(fallbackDur||3)};
}

/* ---------- size ---------- */
function parseSize(v){
  const s=String(v||"").trim().toLowerCase().replace(/\s/g,"");
  const named={
    "4k":[2160,3840],"4kvertical":[2160,3840],"2160p":[2160,3840],
    "1080p":[1080,1920],"hd":[1080,1920],"vertical":[2160,3840],
    "4kwide":[3840,2160],"landscape":[3840,2160],"16:9":[3840,2160],"9:16":[2160,3840],
    "square":[2160,2160],"1:1":[2160,2160]
  };
  if(named[s])return {w:named[s][0],h:named[s][1]};
  const m=s.match(/^(\d{2,5})[x*×](\d{2,5})$/);
  if(m)return {w:+m[1],h:+m[2]};
  return null;
}

/* ---------- the block ---------- */
export function extractBlock(text){
  const t=tidy(text);
  const fence=t.match(/```[ \t]*(?:shotlist|timeline|palm)[ \t]*\n([\s\S]*?)```/i);
  if(fence)return {body:fence[1],fenced:true};
  /* An un-fenced paste is still a shotlist if it opens like one. */
  if(/^[ \t]*(SAY|TEXT|STAMP|LIST|LOWER|IMAGE|CARD|BG|TITLE|FPS|SIZE)\b/im.test(t)
     && /\|/.test(t))return {body:t,fenced:false};
  return null;
}

/* Split a field list on `|`, keeping escaped pipes (`\|`) as text — a lower
   third that reads "GTA BOOM | Notebookcheck" would otherwise lose its tail. */
function splitFields(s){
  const out=[];let cur="";
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==="\\"&&s[i+1]==="|"){cur+="|";i++;continue;}
    if(c==="|"){out.push(cur);cur="";continue;}
    cur+=c;
  }
  out.push(cur);
  return out.map(x=>x.trim());
}
/* Fold continuation lines (`| more=fields`) into the line they belong to. */
function foldLines(body){
  const raw=body.split("\n"),out=[];
  for(let line of raw){
    const t=line.replace(/\s+$/,"");
    if(!t.trim())continue;
    if(/^\s*#/.test(t)||/^\s*\/\//.test(t))continue;
    if(/^\s*\|/.test(t)&&out.length){out[out.length-1]+=" "+t.trim();continue;}
    out.push(t.trim());
  }
  return out;
}

const BOOL=v=>!/^(0|off|no|false|none)$/i.test(String(v).trim());

export function parseShotlist(text){
  const block=extractBlock(text);
  if(!block)return null;
  const warn=[];
  const meta={title:"",fps:30,w:2160,h:3840,accent:"",theme:"dark",media:{},captions:false};
  const items=[];
  /* FPS has to be known before any time is read, so take one cheap pass for it. */
  const lines=foldLines(block.body);
  for(const l of lines){
    const m=l.match(/^fps[\s:=]+(\d+(?:\.\d+)?)/i);
    if(m){meta.fps=Math.max(1,Math.min(120,Math.round(+m[1])));break;}
  }

  for(const line of lines){
    const head=line.match(/^([A-Za-z][A-Za-z0-9_-]*)\b[\s:=]*(.*)$/);
    if(!head){warn.push("Skipped: "+line.slice(0,60));continue;}
    const key=head[1].toLowerCase(),rest=head[2].trim();

    /* directives */
    if(key==="title"&&!/^\d|^[0-9:]+[-.]/.test(rest)){meta.title=stripQ(rest);continue;}
    if(key==="fps"||key==="v"||key==="version")continue;
    if(key==="size"||key==="res"||key==="resolution"){
      const sz=parseSize(rest);
      if(sz){meta.w=sz.w;meta.h=sz.h;}else warn.push("Unreadable SIZE: "+rest);
      continue;
    }
    if(key==="accent"||key==="colour"||key==="color"){meta.accent=stripQ(rest);continue;}
    if(key==="theme"){meta.theme=/light/i.test(rest)?"light":"dark";continue;}
    if(key==="captions"||key==="subs"||key==="subtitles"){meta.captions=BOOL(rest);continue;}
    if(key==="media"||key==="assets"||key==="files"){
      for(const pair of rest.split(/\s*[,;]\s*/)){
        const kv=pair.split(/\s*=\s*/);
        if(kv.length===2&&kv[0])meta.media[kv[0].trim().toLowerCase()]=unwrap(kv[1]);
      }
      continue;
    }
    if(key==="audio"||key==="vo"&&!/\d/.test(rest.slice(0,6))){meta.media.vo=stripQ(rest);continue;}
    if(key==="music"){meta.media.music=stripQ(rest);continue;}

    /* elements */
    const type=ALIAS[key]||(TYPES[key]?key:null);
    if(!type){warn.push("Unknown line type “"+head[1]+"”");continue;}
    const fields=splitFields(rest);
    const first=fields.shift()||"";
    /* The time range is the run of tokens before the first bare word. */
    const tm=first.match(/^([0-9:.+\-\s]*(?:f)?[0-9:.+\-\s]*?)(?:\s{2,}|\s(?=\S)|$)/);
    let range=null,inlineText="";
    if(tm&&tm[1].trim()){
      range=parseRange(tm[1].trim(),meta.fps,defaultDur(type));
      inlineText=first.slice(tm[0].length).trim();
    }
    if(!range){
      /* No time at all — still useful: park it and let the editor place it. */
      range=parseRange(first.split(/\s{2,}/)[0],meta.fps,defaultDur(type));
      if(!range){range={t0:null,t1:null};inlineText=first;}
    }
    const opts={};let textParts=[];
    if(inlineText)textParts.push(inlineText);
    for(const f of fields){
      if(!f)continue;
      const kv=f.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*([\s\S]*)$/);
      if(kv)opts[kv[1].toLowerCase()]=stripQ(kv[2].trim());
      else textParts.push(f);
    }
    if(opts.text)textParts.unshift(opts.text);
    const body=stripQ(textParts.join(" — ").trim());
    items.push({type,t0:range.t0,t1:range.t1,text:body,opts});
  }
  if(!items.length)return null;
  return {meta,items,warnings:warn,source:"block"};
}
function defaultDur(type){return type==="say"?2.5:type==="lower"?4:3;}
/* Media values arrive as placeholders more often than not — Claude writes
   `[gta-bed]` or `<vo-file>` when it does not know what the file will be
   called. The brackets are punctuation, not part of the name, and leaving them
   in means the "waiting on" list asks for a file nobody would ever name. */
function unwrap(s){
  let t=stripQ(s);
  while(t.length>1&&((t[0]==="["&&t.endsWith("]"))||(t[0]==="<"&&t.endsWith(">"))
      ||(t[0]==="{"&&t.endsWith("}"))||(t[0]==="("&&t.endsWith(")"))))
    t=t.slice(1,-1).trim();
  return t;
}
function stripQ(s){
  const t=String(s||"").trim();
  if(t.length>1&&((t[0]==='"'&&t.endsWith('"'))||(t[0]==="'"&&t.endsWith("'"))))return t.slice(1,-1).trim();
  return t;
}

/* ---------- fallback: an ordinary Claude answer ----------
   Good enough to start editing from, never good enough to trust: spoken timing
   is estimated from word count, so every line lands close and none land right.
   The block above exists so this path is the exception. */
const WPS=3.05;   /* fast anchor pace — 91 words ≈ 30s */

export function parseScript(text){
  const t=tidy(text);
  const fps=30,items=[],warn=[];
  const meta={title:"",fps,w:2160,h:3840,accent:"",theme:"dark",media:{},captions:false};

  const titleM=t.match(/^\s*(?:#+\s*)?(?:\*\*)?Titles?(?:\*\*)?\s*:?\s*\n+\s*(?:1[.)]\s*)?["“]?([^"”\n]{4,90})/im);
  if(titleM)meta.title=stripQ(titleM[1]);

  /* --- spoken lines --- */
  /* Take everything after the Script heading and cut at the next heading, in
     two steps. A lazy match with an end-of-input alternative is the obvious
     one-liner and it is wrong: JavaScript has no `\Z`, so under /i it matches a
     literal "z" — the read stopped dead inside the name "Jynxzi". */
  const scriptM=t.match(/^#+[ \t]*Script[ \t]*$([\s\S]*)/im);
  let scriptBody=scriptM?scriptM[1]:t;
  const nextHead=scriptBody.search(/^#+[ \t]/m);
  if(nextHead>0)scriptBody=scriptBody.slice(0,nextHead);
  let clock=0,section="";
  for(let raw of scriptBody.split("\n")){
    const line=raw.trim();
    if(!line)continue;
    const sec=line.match(/^\*\*([A-Z][A-Z \-]{1,20})\*\*$/);
    if(sec){section=sec[1].trim().toLowerCase();continue;}
    if(/^\[beat\]$/i.test(line)){clock+=0.45;continue;}
    if(/^[#*|>_-]{1,4}\s*$/.test(line))continue;
    if(/^\|/.test(line)||/^#+\s/.test(line))continue;
    const clean=line.replace(/^[-*]\s+/,"").replace(/\*\*/g,"").trim();
    if(!clean||clean.length<2)continue;
    const words=clean.split(/\s+/).length;
    const dur=Math.max(0.6,words/WPS);
    items.push({type:"say",t0:clock,t1:clock+dur,text:clean,opts:{part:section}});
    clock+=dur+0.12;
  }

  /* --- visual beats table --- */
  const rows=t.match(/^\|[^\n]*\|[^\n]*$/gm)||[];
  for(const row of rows){
    const cells=row.split("|").map(c=>c.trim()).filter((c,i,a)=>!(i===0&&!c)&&!(i===a.length-1&&!c));
    if(cells.length<2)continue;
    if(/^-{2,}$/.test(cells[0].replace(/[: ]/g,"")))continue;
    const range=parseRange(cells[0].replace(/s\b/g,""),fps,2.5);
    if(!range||range.t0==null)continue;
    const beat=cells.slice(1).join(" — ");
    if(!beat)continue;
    items.push({type:"beat",t0:range.t0,t1:range.t1,text:beat,opts:{}});
    /* Quoted text inside a beat is almost always what goes on screen. */
    const quoted=beat.match(/"([^"]{2,60})"/g)||[];
    for(const q of quoted){
      const val=q.slice(1,-1).trim();
      if(!val||/^\d+$/.test(val))continue;
      const stamp=val===val.toUpperCase()&&val.length<=22;
      items.push({type:stamp?"stamp":"text",t0:range.t0,t1:range.t1,text:val,
        opts:{slot:stamp?"center":"upper",blur:"on"}});
    }
  }
  if(!items.length)return null;
  const end=items.reduce((a,i)=>Math.max(a,i.t1||0),0);
  if(!items.some(i=>i.type==="beat")&&end>0)warn.push("No visual beats table found — only the read was imported.");
  warn.push("Imported from prose: spoken timing is estimated from word count. Paste a shotlist block for frame-accurate times.");
  return {meta,items,warnings:warn,source:"script"};
}

/* One entry point: block if there is one, prose otherwise. */
export function parsePaste(text){
  return parseShotlist(text)||parseScript(text);
}
