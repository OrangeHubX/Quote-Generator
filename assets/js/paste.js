/* paste.js — The "paste an image" dialog shared by the avatar and media slots.

   Three routes in, because no single one works everywhere:

     paste event   the ⌘V / Ctrl+V path. The zone is contenteditable rather than a
                   plain div because a browser only fires `paste` at an editable
                   target — and on a phone, where there is no Ctrl+V, an editable
                   element is also the only thing that offers the OS Paste menu on
                   long press.
     drop          dragging a file in from Finder or Explorer.
     clipboard API navigator.clipboard.read(), which is the reliable route on a
                   phone but prompts for permission and is not universal, so it is
                   a button rather than something that happens on open.

   A copied *link* is refused on purpose: drawing a remote image taints the canvas,
   and a tainted canvas throws on toBlob() and getImageData() — so PNG, JPEG and
   GIF export would all break at the moment of export rather than here. */
import {$} from './data.js';
import {snack} from './export.js';

/* Filled in by ui.js as it binds each image row, so this module never needs to
   know how an image is decoded or which state key it lands in. */
const SINKS={};
export function registerSink(key,fn){SINKS[key]=fn;}

let target=null,lastFocus=null;

function zone(){return $("#pasteZone");}

/* The instruction has to match the device: there is no Ctrl+V on a phone, where
   the route is a long press on an editable element (or the button below). */
const TOUCH=()=>window.matchMedia&&window.matchMedia("(hover:none)").matches;
const MAC=()=>/Mac|iPhone|iPad|iPod/.test((navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||navigator.userAgent);
function pasteKey(){return MAC()?"\u2318V":"Ctrl+V";}
function zoneHint(){
  return TOUCH()?"Long-press here and choose Paste, or drop an image in"
                :"Press "+pasteKey()+", or drop an image here";
}

export function openPaste(key){
  if(!SINKS[key])return;
  target=key;
  lastFocus=document.activeElement;
  const m=$("#pasteModal");
  m.hidden=false;
  const z=zone();
  z.innerHTML="";
  z.dataset.ph=zoneHint();
  /* Chrome only shows the paste-permission prompt for a page with focus, and the
     zone has to hold the caret for ⌘V to land here at all. */
  setTimeout(()=>{try{z.focus();}catch(_){}},0);
}
export function closePaste(){
  const m=$("#pasteModal");
  if(m.hidden)return;
  m.hidden=true;
  zone().innerHTML="";
  target=null;
  /* Deferred: closing from a backdrop pointerdown means the browser is still
     going to move focus after this handler returns, which would undo a
     synchronous restore and leave focus on <body>. */
  const back=lastFocus;
  lastFocus=null;
  if(back&&back.focus)setTimeout(()=>{try{back.focus();}catch(_){}},0);
}
function isOpen(){return !$("#pasteModal").hidden;}

/* One way out for every route, so the dialog closes on exactly the same terms
   however the image arrived. */
function take(file){
  if(!file){snack("No image found on the clipboard.");return false;}
  if(!/^image\//.test(file.type)){snack("That is not an image.");return false;}
  const fn=SINKS[target];
  if(!fn){closePaste();return false;}
  fn(file);
  closePaste();
  snack("Image pasted.");
  return true;
}
/* A data: URL is same-origin, so it is safe to draw and keeps export working. */
function fromDataUrl(txt){
  const m=/(data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+)/i.exec(txt||"");
  if(!m)return null;
  try{
    const [head,b64]=m[1].split(",");
    const type=(/data:([^;]+)/.exec(head)||[])[1]||"image/png";
    const bin=atob(b64),u8=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    return new File([u8],"pasted.png",{type});
  }catch(_){return null;}
}
function firstImage(list){
  if(!list)return null;
  for(const it of list){
    if(it.kind==="file"&&/^image\//.test(it.type)){
      const f=it.getAsFile();
      if(f)return f;
    }
  }
  return null;
}

export function initPaste(){
  const m=$("#pasteModal"),z=zone();

  ["avatar","media"].forEach(key=>{
    const b=$("#"+key+"Paste");
    if(!b)return;
    b.addEventListener("click",e=>{
      /* the row itself opens the file picker, so this must not bubble */
      e.preventDefault();e.stopPropagation();
      openPaste(key);
    });
  });

  z.addEventListener("paste",e=>{
    const dt=e.clipboardData;if(!dt)return;
    e.preventDefault();
    const f=firstImage(dt.items)||(dt.files&&dt.files[0]);
    if(f&&/^image\//.test(f.type)){take(f);return;}
    const emb=fromDataUrl(dt.getData("text/html"))||fromDataUrl(dt.getData("text/plain"));
    if(emb){take(emb);return;}
    const txt=(dt.getData("text/plain")||"").trim();
    if(/^https?:\/\//i.test(txt))
      snack("That is a link, not an image. Save it and drop the file in — a linked image would block PNG and GIF export.");
    else snack("No image on the clipboard. Copy the image itself, not the text around it.");
    z.innerHTML="";
  });

  ["dragenter","dragover"].forEach(ev=>z.addEventListener(ev,e=>{
    e.preventDefault();z.dataset.over="true";
  }));
  ["dragleave","dragend"].forEach(ev=>z.addEventListener(ev,()=>{delete z.dataset.over;}));
  z.addEventListener("drop",e=>{
    e.preventDefault();delete z.dataset.over;
    const dt=e.dataTransfer;
    take(firstImage(dt&&dt.items)||(dt&&dt.files&&dt.files[0]));
  });

  $("#pasteRead").addEventListener("click",async()=>{
    if(!navigator.clipboard||!navigator.clipboard.read){
      snack("This browser will not hand over the clipboard — paste into the box instead.");
      z.focus();return;
    }
    try{
      const items=await navigator.clipboard.read();
      for(const it of items){
        const type=it.types.find(t=>/^image\//.test(t));
        if(!type)continue;
        const blob=await it.getType(type);
        take(new File([blob],"pasted."+(type.split("/")[1]||"png"),{type}));
        return;
      }
      snack("No image on the clipboard.");
    }catch(err){
      /* denied, dismissed, or unsupported — the manual route still works */
      snack("Could not read the clipboard. Paste into the box instead.");
      z.focus();
    }
  });

  $("#pasteCancel").addEventListener("click",closePaste);
  /* the backdrop, but not the card sitting on it */
  m.addEventListener("pointerdown",e=>{if(e.target===m)closePaste();});
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&isOpen()){e.stopPropagation();closePaste();}
  });
}
