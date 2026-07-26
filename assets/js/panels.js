/* panels.js — Design combobox, element visibility chips and saved presets. */
import {$, CHEER, HIDEABLE, R, S, TWITCH_NAMES, clamp, d} from './data.js';
import {scheduleDraw} from './state.js';
import {wrap} from './text.js';
import {invalidateLayout} from './layout.js';
import {snack} from './export.js';
import {SL, applyDesign, autogrow, fillSlider, setHl, setViewChip, ta, updateFabLabel} from './ui.js';
import {drawCheer} from './card-social.js';

/* ---------- design combobox ---------- */
const DESIGN_GROUPS=[
  ["News",     "#8A93A6",[["quote","Quote card"]]],
  ["X",        "#1D9BF0",[["x-post","Post"],["x-reply","Reply"]]],
  ["Reddit",   "#FF4500",[["reddit-post","Post"],["reddit-comment","Comment"]]],
  ["YouTube",  "#FF0033",[["yt-comment","Comment"]]],
  ["Facebook", "#1877F2",[["fb-post","Post"],["fb-comment","Comment"]]],
  ["Instagram","#E1306C",[["ig-post","Post"],["ig-comment","Comment"]]],
  ["Twitch",   "#9147FF",[["twitch-comment","Chat message"]]]
];
function designLabel(id){
  for(const [g,col,items] of DESIGN_GROUPS)
    for(const [v,lab] of items) if(v===id) return {text:(g==="News"?lab:g+" — "+lab),col};
  return {text:id,col:"#8A93A6"};
}
function buildDesignPop(){
  const pop=$("#designPop");pop.innerHTML="";
  for(const [g,col,items] of DESIGN_GROUPS){
    const h=document.createElement("div");h.className="combo-grp";h.textContent=g;pop.appendChild(h);
    for(const [v,lab] of items){
      const b=document.createElement("button");
      b.className="combo-opt";b.type="button";b.dataset.v=v;
      b.setAttribute("role","option");
      b.setAttribute("aria-selected",String(v===S.design));
      const dot=document.createElement("span");dot.className="cd";dot.style.background=col;
      const t=document.createElement("span");t.textContent=lab;
      b.append(dot,t);pop.appendChild(b);
    }
  }
}
export function syncDesignBtn(){
  const {text,col}=designLabel(S.design);
  $("#designVal").textContent=text;
  $("#designDot").style.background=col;
}
export function closeDesignPop(){
  const pop=$("#designPop");
  if(pop.dataset.open!=="true")return;
  pop.dataset.open="false";
  $("#designBtn").setAttribute("aria-expanded","false");
}
/* One placement routine for every popup list, so the cheer picker and the design
   picker behave identically. Fixed to the viewport and bounded by the top of the
   mobile nav bar, flipping upward only when that genuinely gives more room. */
const POP_GAP=4, POP_EDGE=6;
export function placePop(btnSel,popSel){
  const btn=$(btnSel),pop=$(popSel),bar=$(".mbar");
  /* Move the list to <body> before measuring. position:fixed is relative to the
     nearest ancestor that establishes a containing block, and .page carries a
     filling transform animation — which silently offset the list by the panel's
     header height. Living at body level makes placement unconditional. */
  if(pop.parentElement!==document.body)document.body.appendChild(pop);
  const r=btn.getBoundingClientRect();
  const vh=window.innerHeight;
  const floor=(bar&&bar.offsetHeight>0)?bar.getBoundingClientRect().top:vh;
  const below=floor-r.bottom-POP_GAP-POP_EDGE;
  const above=r.top-POP_GAP-POP_EDGE;
  const up=below<Math.min(200,above);
  const room=Math.max(120,Math.floor(up?above:below));
  /* measure natural height first so a short list gets a snug box */
  pop.style.maxHeight="none";
  pop.style.width=Math.round(r.width)+"px";
  pop.style.left=Math.round(r.left)+"px";
  pop.style.top="0px";pop.style.bottom="auto";pop.style.visibility="hidden";
  pop.dataset.open="true";
  const h=Math.min(pop.scrollHeight,room);
  pop.style.maxHeight=h+"px";
  /* Anchor to the button, then clamp inside the visible band. Without the clamp
     a button scrolled out of the panel would fling the list off-screen. */
  let top=up?(r.top-POP_GAP-h):(r.bottom+POP_GAP);
  top=clamp(top,POP_EDGE,Math.max(POP_EDGE,floor-POP_EDGE-h));
  pop.style.bottom="auto";
  pop.style.top=Math.round(top)+"px";
  pop.dataset.dir=up?"up":"down";
  pop.style.visibility="";
  btn.setAttribute("aria-expanded","true");
}
function placeDesignPop(){placePop("#designBtn","#designPop");}
$("#designBtn").addEventListener("click",e=>{
  e.stopPropagation();
  if($("#designPop").dataset.open==="true"){closeDesignPop();return;}
  buildDesignPop();
  placeDesignPop();
});
/* the button moves when the sheet is dragged or the viewport changes */
window.addEventListener("resize",()=>{if($("#designPop").dataset.open==="true")placeDesignPop();});
$("#grip").addEventListener("pointerdown",closeDesignPop);
$("#designPop").addEventListener("click",e=>{
  const b=e.target.closest(".combo-opt");if(!b)return;
  S.design=b.dataset.v;closeDesignPop();syncDesignBtn();applyDesign();
});
document.addEventListener("click",e=>{
  if(!e.target.closest("#designCombo"))closeDesignPop();
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")closeDesignPop();
});

/* ---------- element visibility ---------- */
const TICK='<svg class="tick" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';
export function buildShowChips(){
  const brand=d().brand;if(!brand)return;
  const box=$("#showGrid");box.innerHTML="";
  const wrap=document.createElement("div");wrap.className="chips";
  HIDEABLE.forEach(([key,label,test])=>{
    if(!test(brand))return;
    const b=document.createElement("button");
    b.type="button";b.dataset.k=key;
    b.setAttribute("aria-pressed",String(!S.hidden[key]));
    b.innerHTML=TICK+"<span></span>";
    b.querySelector("span").textContent=label;
    wrap.appendChild(b);
  });
  box.appendChild(wrap);
}
$("#showGrid").addEventListener("click",e=>{
  const b=e.target.closest("button[data-k]");if(!b)return;
  const k=b.dataset.k;
  if(S.hidden[k])delete S.hidden[k];else S.hidden[k]=true;
  b.setAttribute("aria-pressed",String(!S.hidden[k]));
  invalidateLayout();scheduleDraw();
});
$("#showAll").addEventListener("click",()=>{
  S.hidden={};S.hideCounts=false;$("#hideCounts").checked=false;
  buildShowChips();invalidateLayout();scheduleDraw();
});
$("#hideCounts").addEventListener("change",e=>{
  S.hideCounts=e.target.checked;invalidateLayout();scheduleDraw();
});

/* ---------- presets ----------
   Everything in S is stored except the decoded images, which cannot be
   serialised — those stay as they are when a preset is applied. */
const PRESET_KEY="qs-presets";
const PRESET_SKIP={avatar:1,media:1,ranges:1,text:1};
export function loadPresets(){try{return JSON.parse(localStorage.getItem(PRESET_KEY)||"[]");}catch(_){return [];}}
function storePresets(l){try{localStorage.setItem(PRESET_KEY,JSON.stringify(l));}catch(_){snack("Could not save — storage is full.");}}
function snapshot(){
  const o={};
  for(const k in S){
    if(PRESET_SKIP[k])continue;
    const v=S[k];
    if(v&&typeof v==="object")o[k]=JSON.parse(JSON.stringify(v));
    else o[k]=v;
  }
  return o;
}
let activePreset=null;
function applyPreset(p){
  const o=p.data||{};
  for(const k in o){
    if(PRESET_SKIP[k])continue;
    if(!(k in S))continue;
    const v=o[k];
    S[k]=(v&&typeof v==="object")?JSON.parse(JSON.stringify(v)):v;
  }
  activePreset=p.name;
  syncAllControls();
  invalidateLayout();scheduleDraw();
  snack("Applied “"+p.name+"”");
}
export function renderPresets(){
  const box=$("#presetList"),list=loadPresets();
  box.innerHTML="";
  if(!list.length){
    const e=document.createElement("div");e.className="empty";
    e.textContent="No presets yet — set a card up, then Save current.";
    box.appendChild(e);return;
  }
  list.forEach((p,i)=>{
    const row=document.createElement("div");row.className="pr";
    row.dataset.on=String(p.name===activePreset);
    const nm=document.createElement("button");
    nm.className="nm";nm.type="button";nm.textContent=p.name;
    nm.title="Apply this preset";
    nm.addEventListener("click",()=>{applyPreset(p);renderPresets();});
    const up=document.createElement("button");
    up.className="act";up.type="button";up.textContent="Update";up.title="Overwrite with current settings";
    up.addEventListener("click",()=>{
      const l=loadPresets();l[i]={name:p.name,data:snapshot()};storePresets(l);
      activePreset=p.name;renderPresets();snack("Updated “"+p.name+"”");
    });
    const del=document.createElement("button");
    del.className="act del";del.type="button";del.textContent="✕";del.title="Delete";
    del.addEventListener("click",()=>{
      const l=loadPresets();l.splice(i,1);storePresets(l);
      if(activePreset===p.name)activePreset=null;
      renderPresets();
    });
    row.append(nm,up,del);box.appendChild(row);
  });
}
$("#presetSave").addEventListener("click",()=>{
  const name=(prompt("Name this preset:","")||"").trim();
  if(!name)return;
  const l=loadPresets();
  const at=l.findIndex(p=>p.name.toLowerCase()===name.toLowerCase());
  const entry={name,data:snapshot()};
  if(at>=0)l[at]=entry;else l.push(entry);
  storePresets(l);activePreset=name;renderPresets();
  snack("Saved “"+name+"”");
});

/* Push every value in S back into its control. Called after applying a preset. */
function syncAllControls(){
  /* segmented + select groups */
  ["theme","face","hlStyle","crop","res","bg","fps","fadeEase","scaleEase","format","mode","imgFmt","badge","avShape"]
    .forEach(g=>{
      const host=$("#"+g);if(!host)return;
      if(host.tagName==="SELECT")host.value=S[g];
      else host.querySelectorAll("button[data-v]").forEach(x=>
        x.setAttribute("aria-pressed",String(x.dataset.v===String(S[g]))));
    });
  /* sliders + their numeric boxes */
  SL.forEach(id=>{
    const el=$("#"+id),box=$("#"+id+"Num");
    if(!el)return;
    el.value=S[id];if(box)box.value=S[id];
    fillSlider(el);
  });
  /* switches */
  [["header","header"],["marks","marks"],["guides","guides"],["anim","anim"],
   ["hlAnim","hlAnim"],["follow","follow"],["likeOn","likeOn"]].forEach(([id,k])=>{
    const el=$("#"+id);if(el)el.checked=!!S[k];
  });
  $("#hideCounts").checked=!!S.hideCounts;
  /* text fields */
  [["text","text"],["outlet","outlet"],["url","url"],["name","name"],["handle","handle"],
   ["sub","sub"],["time","time"],["audio","audio"],["mediaSrc","mediaSrc"],
   ["exportName","exportName"],["hlHex","hlColor"]].forEach(([id,k])=>{
    const el=$("#"+id);if(el&&S[k]!==undefined)el.value=S[k];
  });
  R.lastText=S.text;autogrow(ta);
  /* dependent visibility */
  $("#jpegQ").classList.toggle("hide",S.imgFmt!=="jpeg");
  $("#customRow").classList.toggle("hide",S.scaleEase!=="custom");
  $("#hlAnimRow").classList.toggle("hide",!S.hlAnim);
  $("#typeBox").style.display=S.mode==="type"?"":"none";
  $("#tapBox").style.display=S.mode==="tap"?"":"none";
  R.wordSig=null;
  setHl(S.hlColor,["#FFA8C5","#FFE566","#9BF6A5","#8BD3FF","#FF7A45"]
    .some(x=>x.toLowerCase()===String(S.hlColor).toLowerCase()));
  setViewChip();updateFabLabel();syncDesignBtn();
  applyDesign();
}

/* ---------- Twitch: name colour + cheer badge picker ---------- */
/* Each swatch/option is a tiny canvas drawn by the same code that renders the
   badge onto the card, so the picker cannot drift from the output. */
function cheerTile(tier,px){
  const cv=document.createElement("canvas");
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=px*dpr;cv.height=px*dpr;
  cv.style.width=px+"px";cv.style.height=px+"px";
  const c=cv.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);
  if(tier==="off"){
    c.strokeStyle="#4A5060";c.lineWidth=1.4;
    c.beginPath();c.moveTo(px*0.25,px*0.75);c.lineTo(px*0.75,px*0.25);c.stroke();
  }else drawCheer(c,tier,0,0,px);
  return cv;
}
function syncCheerBtn(){
  const row=CHEER.find(t=>t[0]===S.cheer);
  $("#cheerVal").textContent=row?row[1]:"Off";
  const sw=$("#cheerSw");sw.innerHTML="";
  sw.appendChild(cheerTile(S.cheer||"off",16));
}
function buildCheerPop(){
  const pop=$("#cheerPop");pop.innerHTML="";
  const mk=(tier,label)=>{
    const b=document.createElement("button");
    b.className="cheer-opt";b.type="button";b.dataset.v=tier;
    b.setAttribute("role","option");
    b.setAttribute("aria-selected",String(tier===(S.cheer||"off")));
    const t=document.createElement("span");t.textContent=label;
    b.append(cheerTile(tier,20),t);pop.appendChild(b);
  };
  mk("off","Off");
  CHEER.forEach(([tier,label])=>mk(tier,label));
}
function placeCheerPop(){placePop("#cheerBtn","#cheerPop");}
function closeCheerPop(){
  const pop=$("#cheerPop");
  if(pop.dataset.open!=="true")return;
  pop.dataset.open="false";$("#cheerBtn").setAttribute("aria-expanded","false");
}
$("#cheerBtn").addEventListener("click",e=>{
  e.stopPropagation();
  if($("#cheerPop").dataset.open==="true"){closeCheerPop();return;}
  buildCheerPop();placeCheerPop();
  const sel=$("#cheerPop").querySelector('[aria-selected="true"]');
  if(sel)sel.scrollIntoView({block:"nearest"});
});
$("#cheerPop").addEventListener("click",e=>{
  const b=e.target.closest(".cheer-opt");if(!b)return;
  S.cheer=b.dataset.v;closeCheerPop();syncCheerBtn();
  invalidateLayout();scheduleDraw();
});
document.addEventListener("click",e=>{if(!e.target.closest("#cheerPick"))closeCheerPop();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCheerPop();});
window.addEventListener("resize",()=>{if($("#cheerPop").dataset.open==="true")placeCheerPop();});
$("#grip").addEventListener("pointerdown",closeCheerPop);

export function buildNameColors(){
  const box=$("#nameColor");if(box.childElementCount)return;
  TWITCH_NAMES.forEach(col=>{
    const b=document.createElement("button");
    b.type="button";b.dataset.v=col;b.style.background=col;
    box.appendChild(b);
  });
  const pick=document.createElement("span");
  pick.className="pick";
  pick.innerHTML='<input type="color" id="namePick" aria-label="Custom name colour">';
  box.appendChild(pick);
  $("#namePick").value=S.nameColor;
  $("#namePick").addEventListener("input",e=>setNameColor(e.target.value,false));
}
function setNameColor(col,fromPreset){
  S.nameColor=col;
  $("#nameColor").querySelectorAll("button[data-v]").forEach(b=>
    b.setAttribute("aria-pressed",String(b.dataset.v.toLowerCase()===col.toLowerCase())));
  const np=$("#namePick");if(np)np.value=col;
  invalidateLayout();scheduleDraw();
}
$("#nameColor").addEventListener("click",e=>{
  const b=e.target.closest("button[data-v]");if(!b)return;
  setNameColor(b.dataset.v,true);
});
["subBadge","modBadge"].forEach(id=>$("#"+id).addEventListener("change",e=>{
  S[id]=e.target.checked;invalidateLayout();scheduleDraw();
}));
export function syncTwitch(){
  buildNameColors();syncCheerBtn();
  setNameColor(S.nameColor,true);
  $("#subBadge").checked=!!S.subBadge;$("#modBadge").checked=!!S.modBadge;
}
