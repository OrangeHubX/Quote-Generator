/* batch.js — Queue several cards and export them as one zip.

   Layout of the zip, for a Premiere workflow: each animated card gets its own
   folder so the whole thing can be unpacked straight into a project folder and
   every sequence imported as a unit. Stills need no folder and sit at the root.

     slate-batch-2026-07-26.zip
       _manifest.txt
       01_quote_odds-of-this-happening/
         01_quote_odds-of-this-happening_0000.png
         01_quote_odds-of-this-happening_0001.png
       02_x-post_gta-6-delayed/
         02_x-post_gta-6-delayed_0000.png

   The frames repeat the folder name rather than restarting at 0000 with a bare
   name, so a clip stays identifiable after it has been dragged onto a timeline
   and detached from its folder. */
import {$, FH, FW, S, designOf} from './data.js';
import {animAt, cardThumbURL, fitLayout, frameSecs, invalidateLayout, paint} from './layout.js';
import {makeCanvas, makeZip, saveBlob, snack, stillExt, stillMime} from './export.js';
import {syncAllControls} from './panels.js';
import {scheduleDraw} from './state.js';

/* Same exclusions as presets: the decoded images cannot be serialised. They are
   kept as live references next to the snapshot so a queue built in this session
   renders with its images; a reload keeps the cards and drops the images. */
const SKIP={avatar:1,media:1};
const KEY="qs-batch";
const THUMB_PX=96;   /* longest side of a row thumbnail */

let queue=[];          /* [{name, data, thumb, avatar, media}] */

function snapshot(){
  const o={};
  for(const k in S){
    if(SKIP[k])continue;
    const v=S[k];
    o[k]=(v&&typeof v==="object")?JSON.parse(JSON.stringify(v)):v;
  }
  return o;
}
function store(){
  try{localStorage.setItem(KEY,JSON.stringify(queue.map(q=>({name:q.name,data:q.data,thumb:q.thumb}))));}
  catch(_){snack("Queue saved without thumbnails — storage is full.");
    try{localStorage.setItem(KEY,JSON.stringify(queue.map(q=>({name:q.name,data:q.data}))));}catch(__){}}
}
export function loadQueue(){
  try{queue=JSON.parse(localStorage.getItem(KEY)||"[]")||[];}catch(_){queue=[];}
  return queue;
}
export function queueLength(){return queue.length;}

function thumb(){return cardThumbURL(THUMB_PX);}
/* Auto label from the card's own words, which is what makes a folder findable.
   The account name only belongs in it for a social card — a quote card has one
   left over from whatever was set last, and it is not part of that card. */
function autoName(data){
  const social=designOf(data.design).social;
  const src=((social&&data.name)?data.name+" ":"")+(data.text||"");
  const slug=src.trim().split(/\s+/).slice(0,5).join("-")
    .replace(/[^a-z0-9\-]/gi,"").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase();
  return slug||"card";
}
export function slug(s){
  return String(s||"").replace(/[^a-z0-9\-_ ]/gi,"").trim().replace(/\s+/g,"-").toLowerCase();
}

/* ---------- naming pattern ----------
   Tokens rather than a fixed scheme, because what makes a folder findable
   differs per project. */
export const TOKENS=[["{n}","Position, zero-padded (01, 02…)"],["{name}","Custom name, or words from the card"],
  ["{design}","Card type (quote, x-post, twitch-comment…)"],["{frames}","Frame count"],
  ["{fps}","Frame rate"],["{size}","Pixel size (1080x1920)"],["{date}","Today, as 2026-07-26"]];
export const DEFAULT_PATTERN="{n}_{design}_{name}";

function today(){
  const t=new Date(),p=n=>String(n).padStart(2,"0");
  return t.getFullYear()+"-"+p(t.getMonth()+1)+"-"+p(t.getDate());
}
export function expand(pattern,ctx){
  const map={"{n}":ctx.n,"{name}":ctx.name,"{design}":ctx.design,"{frames}":ctx.frames,
    "{fps}":ctx.fps,"{size}":ctx.size,"{date}":today()};
  let out=String(pattern||DEFAULT_PATTERN).replace(/\{[a-z]+\}/g,m=>(m in map)?map[m]:m);
  /* a path separator here would silently create nested folders */
  out=out.replace(/[\/\\:*?"<>|]+/g,"-").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^[-.]+|[-.]+$/g,"");
  return out||"card";
}

/* ---------- queue operations ---------- */
export function addCurrent(){
  const data=snapshot();
  queue.push({name:"",data,thumb:thumb(),avatar:S.avatar||null,media:S.media||null});
  store();render();
  snack("Added card "+queue.length+" to the batch");
}
export function removeAt(i){queue.splice(i,1);store();render();}
export function moveAt(i,dir){
  const j=i+dir;
  if(j<0||j>=queue.length)return;
  const t=queue[i];queue[i]=queue[j];queue[j]=t;
  store();render();
}
export function clearQueue(){queue=[];store();render();}
function rename(i,v){queue[i].name=v;store();}

/* Load a queued card into the editor so it can be corrected, and leave it in the
   queue — "Update" writes the edits back. */
function loadAt(i){
  const q=queue[i];
  apply(q);
  syncAllControls();
  invalidateLayout();scheduleDraw();
  snack("Loaded card "+(i+1)+" — edit, then Update");
}
function updateAt(i){
  queue[i]={...queue[i],data:snapshot(),thumb:thumb(),avatar:S.avatar||null,media:S.media||null};
  store();render();snack("Updated card "+(i+1));
}
function apply(q){
  for(const k in q.data){
    if(SKIP[k]||!(k in S))continue;
    const v=q.data[k];
    S[k]=(v&&typeof v==="object")?JSON.parse(JSON.stringify(v)):v;
  }
  /* images are session-only; a queue restored from storage has none, and in that
     case the editor's current images are left alone rather than being cleared */
  if(q.avatar!==undefined&&q.avatar!==null)S.avatar=q.avatar;
  if(q.media!==undefined&&q.media!==null)S.media=q.media;
}

/* ---------- render ---------- */
/* Frame count straight from a snapshot, mirroring layout.js's animFrames() —
   the row has to describe a card that is not currently loaded. */
function framesOf(dz){
  if(dz.format==="still"||!(dz.anim||dz.hlAnim))return 1;
  let n=0;
  if(dz.anim)n=dz.dur;
  if(dz.hlAnim)n=Math.max(n,dz.hlOffset+dz.hlDur);
  return Math.max(1,n)+(dz.hold||0);
}
function itemMeta(q){
  const dz=q.data,k=parseFloat(dz.res||"1");
  return {design:dz.design||"quote",format:dz.format||"still",fps:dz.fps||"30",
    frames:framesOf(dz),
    size:(FW*k)+"x"+(FH*k),           /* {size} token wants real pixels */
    res:k>1?"4K":"1080p",             /* the row wants the short form */
    crop:dz.crop==="card"?"card":"frame"};
}
export function render(){
  const box=$("#batchList");if(!box)return;
  box.innerHTML="";
  $("#batchCount").textContent=queue.length?String(queue.length):"";
  $("#batchGo").disabled=!queue.length;
  $("#batchGo").querySelector("span").textContent=queue.length
    ? "Export batch ("+queue.length+")" : "Export batch";
  if(!queue.length){
    const e=document.createElement("div");e.className="empty";
    e.textContent="Queue is empty — set a card up, then Add current.";
    box.appendChild(e);
    $("#batchPreview").textContent="";
    return;
  }
  queue.forEach((q,i)=>{
    const m=itemMeta(q);
    const row=document.createElement("div");row.className="bq";
    if(q.thumb){
      const th=document.createElement("span");th.className="th";
      th.style.setProperty("--th","url("+q.thumb+")");row.appendChild(th);
    }
    const mid=document.createElement("div");mid.className="mid";
    const nm=document.createElement("input");
    nm.className="num nmf";nm.type="text";nm.spellcheck=false;
    nm.value=q.name;nm.placeholder=autoName(q.data);
    nm.setAttribute("aria-label","Name for card "+(i+1));
    nm.addEventListener("input",()=>{rename(i,nm.value);previewNames();});
    const meta=document.createElement("small");
    meta.textContent=String(i+1).padStart(2,"0")+" · "+m.design+" · "
      +(m.format==="still"?"still":m.frames+"f @"+m.fps)+" · "+m.res
      +(m.crop==="card"?" card":"");
    mid.append(nm,meta);
    const acts=document.createElement("div");acts.className="acts";
    const mk=(txt,title,fn,cls)=>{
      const b=document.createElement("button");
      b.type="button";b.className="act"+(cls?" "+cls:"");b.title=title;
      b.setAttribute("aria-label",title);b.textContent=txt;
      b.addEventListener("click",fn);return b;
    };
    acts.append(
      mk("↑","Move up",()=>moveAt(i,-1)),
      mk("↓","Move down",()=>moveAt(i,1)),
      mk("Load","Load this card into the editor",()=>loadAt(i)),
      mk("Update","Overwrite with the current card",()=>updateAt(i)),
      mk("✕","Remove from the batch",()=>removeAt(i),"del")
    );
    row.append(mid,acts);
    box.appendChild(row);
  });
  previewNames();
}
/* Show what the pattern produces before committing to a long render */
export function previewNames(){
  const el=$("#batchPreview");if(!el)return;
  if(!queue.length){el.textContent="";return;}
  const pat=$("#batchPattern").value||DEFAULT_PATTERN;
  const names=queue.slice(0,2).map((q,i)=>folderFor(q,i,pat));
  el.textContent=names.join("  ·  ")+(queue.length>2?"  ·  …":"");
}
function folderFor(q,i,pat){
  const m=itemMeta(q);
  return expand(pat,{n:String(i+1).padStart(2,"0"),
    name:slug(q.name)||autoName(q.data),design:m.design,
    frames:String(m.frames),fps:String(m.fps),size:m.size});
}

/* ---------- export ---------- */
let busy=false;
export async function exportBatch(){
  if(busy)return;
  if(!queue.length){snack("Add a card to the batch first.");return;}
  busy=true;
  const btn=$("#batchGo");btn.disabled=true;
  const pat=$("#batchPattern").value||DEFAULT_PATTERN;
  /* Hold the editor's own state aside — every card is rendered by loading it
     into S, and the user must get their card back exactly as it was. */
  const mine={data:snapshot(),avatar:S.avatar||null,media:S.media||null};
  const files=[],lines=["Quote Slate batch — "+today(),""];
  const used={};
  let total=0;
  try{
    for(let i=0;i<queue.length;i++){
      const q=queue[i];
      apply(q);
      invalidateLayout();
      /* Two cards can resolve to the same name — trivially so with a pattern that
         leaves out {n} — and one silently overwriting the other inside the zip
         would be the worst kind of bug to find later. */
      let folder=folderFor(q,i,pat),n2=1;
      while(used[folder])folder=folderFor(q,i,pat)+"-"+(++n2);
      used[folder]=1;

      const k=parseFloat(S.res),L=fitLayout(document.createElement("canvas").getContext("2d"));
      const out=makeCanvas(L,k),c=out.getContext("2d");
      const still=S.format==="still"||!(S.anim||S.hlAnim);

      if(still){
        if(S.imgFmt==="jpeg"&&S.bg==="transparent"){c.fillStyle="#FFFFFF";c.fillRect(0,0,out.width,out.height);}
        paint(c,k,L,{tx:out._tx,ty:out._ty,anim:animAt(1e4)});
        const b=await new Promise(r=>out.toBlob(r,stillMime(),S.jq/100));
        files.push({name:folder+stillExt(),data:new Uint8Array(await b.arrayBuffer())});
        lines.push(folder+stillExt()+"  —  "+S.design+", still, "+out.width+"x"+out.height);
        total++;
        snack("Batch "+(i+1)+"/"+queue.length+" — "+folder,true);
      }else{
        const {n,secs,fps}=frameSecs();
        for(let f=0;f<n;f++){
          paint(c,k,L,{tx:out._tx,ty:out._ty,anim:animAt(secs[f])});
          const b=await new Promise(r=>out.toBlob(r,"image/png"));
          files.push({name:folder+"/"+folder+"_"+String(f).padStart(4,"0")+".png",
                      data:new Uint8Array(await b.arrayBuffer())});
          total++;
          if(f%2===0){snack("Batch "+(i+1)+"/"+queue.length+" — "+folder+" frame "+(f+1)+"/"+n,true);
            await new Promise(r=>setTimeout(r,0));}
        }
        lines.push(folder+"/  —  "+S.design+", "+n+" frames @"+fps+"fps, "+out.width+"x"+out.height
          +"  (import "+folder+"_0000.png as an image sequence)");
      }
      const txt=(S.text||"").replace(/\s+/g," ").trim();
      if(txt)lines.push("        “"+(txt.length>72?txt.slice(0,72)+"…":txt)+"”");
      lines.push("");
      await new Promise(r=>setTimeout(r,0));
    }
    lines.push(total+" files across "+queue.length+" cards.");
    files.unshift({name:"_manifest.txt",data:new TextEncoder().encode(lines.join("\n"))});
    const zipName=(slug($("#batchName").value)||"slate-batch-"+today())+".zip";
    saveBlob(makeZip(files),zipName);
    snack(queue.length+" cards, "+total+" files → "+zipName);
  }catch(err){
    snack("Batch export failed: "+(err&&err.message?err.message:err));
  }finally{
    apply(mine);
    invalidateLayout();
    syncAllControls();
    scheduleDraw();
    busy=false;btn.disabled=!queue.length;
  }
}

export function initBatch(){
  loadQueue();
  const pat=$("#batchPattern");
  if(!pat.value)pat.value=DEFAULT_PATTERN;
  pat.addEventListener("input",previewNames);
  $("#batchAdd").addEventListener("click",addCurrent);
  $("#batchClear").addEventListener("click",()=>{
    if(!queueLength())return;
    clearQueue();snack("Batch cleared");
  });
  $("#batchGo").addEventListener("click",exportBatch);
  render();
}
