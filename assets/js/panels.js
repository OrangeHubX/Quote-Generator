/* panels.js — Design combobox, element visibility chips and saved presets. */
import {$, CHEER, EYE_OWNED, HIDEABLE, R, S, TWITCH_NAMES, clamp, d} from './data.js';
import {scheduleDraw} from './state.js';
import {wrap} from './text.js';
import {cardThumbURL, invalidateLayout} from './layout.js';
import {snack} from './export.js';
import {SL, applyDesign, applyRelevance, autogrow, fillSlider, setHl, setViewChip, syncEyes, syncGuides, syncHints, syncOutSummary, ta, updateFabLabel} from './ui.js';
import {drawCheer} from './card-social.js';
import {allBez, applyCurve, builtinCount, drawCurveThumb, easeFnFor, loadBez, matchBez, saveBez, syncBezFields} from './graph.js';

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
const POP_GAP=4, POP_EDGE=6, POP_MIN_W=232;
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
  /* A list needs room for its own contents, not just the width of the button that
     opens it — the look picker's button is 132px, which squeezed its rows until
     the row's own centre landed on a hover action. */
  const w=Math.min(Math.max(r.width,POP_MIN_W),window.innerWidth-POP_EDGE*2);
  pop.style.width=Math.round(w)+"px";
  pop.style.left=Math.round(clamp(r.left,POP_EDGE,Math.max(POP_EDGE,window.innerWidth-POP_EDGE-w)))+"px";
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

/* ---------- generic popup binding ----------
   The design and cheer pickers predate this and keep their own handlers; every
   list added since shares one implementation. */
function bindPop(hostSel,btnSel,popSel,build,pick){
  const close=()=>{
    const pop=$(popSel);
    if(pop.dataset.open!=="true")return;
    pop.dataset.open="false";$(btnSel).setAttribute("aria-expanded","false");
  };
  const place=()=>placePop(btnSel,popSel);
  $(btnSel).addEventListener("click",e=>{
    e.stopPropagation();
    if($(popSel).dataset.open==="true"){close();return;}
    build();place();
    const sel=$(popSel).querySelector('[aria-selected="true"]');
    if(sel)sel.scrollIntoView({block:"nearest"});
  });
  $(popSel).addEventListener("click",e=>{
    const b=e.target.closest(".combo-opt");if(!b)return;
    if(pick(b,e)!==false)close();
  });
  document.addEventListener("click",e=>{if(!e.target.closest(hostSel))close();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  window.addEventListener("resize",()=>{if($(popSel).dataset.open==="true")place();});
  $("#grip").addEventListener("pointerdown",close);
  return {close,rebuild:()=>{if($(popSel).dataset.open==="true"){build();place();}}};
}

/* ---------- motion picker ----------
   One list for the whole movement: the built-in shapes first, then every curve.
   Picking a curve implies the custom ease, so the user never has to know that
   "Custom bezier" is a mode — it was three levels deep behind Curves > Scale >
   Custom bezier > Curve, which is no place for the first thing you choose. */
const EASE_MODES=[["back","Overshoot"],["spring","Spring"],["smooth","Smooth"],["none","No scale"]];
/* The nearest cubic bezier to each built-in shape, so "make this editable" hands
   you the curve you were already looking at rather than resetting it. */
const MODE_CURVE={back:[.34,1.56,.64,1],spring:[.5,1.8,.5,1],smooth:[.22,.61,.36,1]};
function easeLabel(){
  const row=EASE_MODES.find(m=>m[0]===S.scaleEase);
  if(row)return row[1];
  const at=matchBez();
  return at>=0?allBez()[at][0]:"Custom curve";
}
export function syncEaseBtn(){
  const v=$("#motionVal");
  if(v)v.textContent=easeLabel();
  const th=$("#motionThumb");
  if(th)drawCurveThumb(th,easeFnFor(S.scaleEase));
  $("#overLab").textContent=S.scaleEase==="spring"?"Bounciness":"Overshoot";
}
export function syncBezBtn(force){syncEaseBtn();syncBezFields(force);}
function buildMotionPop(){
  const pop=$("#motionPop");pop.innerHTML="";
  const head=t=>{const h=document.createElement("div");h.className="combo-grp";h.textContent=t;pop.appendChild(h);};
  const opt=(sel,label,fn,extra)=>{
    const b=document.createElement("button");
    b.className="combo-opt";b.type="button";
    b.setAttribute("role","option");b.setAttribute("aria-selected",String(sel));
    const th=document.createElement("canvas");th.className="combo-th";th.width=42;th.height=24;
    const t=document.createElement("span");t.textContent=label;
    b.append(th,t);
    if(extra)extra(b);
    pop.appendChild(b);
    drawCurveThumb(th,fn);
    return b;
  };
  head("Shapes");
  for(const [v,label] of EASE_MODES){
    const b=opt(S.scaleEase===v,label,easeFnFor(v));
    b.dataset.mode=v;
  }
  const all=allBez(),nb=builtinCount(),at=S.scaleEase==="custom"?matchBez():-1;
  all.forEach((row,i)=>{
    if(i===0)head("Editable curves");
    if(i===nb)head("Saved");
    const b=opt(i===at,row[0],cubicThumb(row[1]));
    b.dataset.curve=String(i);
    if(i>=nb){
      b.dataset.user=String(i-nb);
      const rm=document.createElement("button");
      rm.className="rm";rm.type="button";rm.textContent="\u2715";rm.title="Delete this curve";
      b.appendChild(rm);
    }
  });
}
export function initEasePickers(){
  bindPop("#motionCombo","#motionBtn","#motionPop",buildMotionPop,(b,e)=>{
    if(e.target.closest(".rm")){
      /* deleting a saved curve keeps the list open — you are usually tidying up */
      const l=loadBez();l.splice(+b.dataset.user,1);saveBez(l);
      buildMotionPop();placePop("#motionBtn","#motionPop");syncEaseBtn();
      return false;
    }
    if(b.dataset.mode!==undefined)S.scaleEase=b.dataset.mode;
    else applyCurve(allBez()[+b.dataset.curve][1]);
    syncEaseBtn();applyRelevance();
    invalidateLayout();scheduleDraw();
  });
  syncEaseBtn();
}
$("#makeCustom").addEventListener("click",()=>{
  const c=MODE_CURVE[S.scaleEase];
  if(c)S.bezier=c.slice();
  S.scaleEase="custom";
  syncEaseBtn();applyRelevance();syncBezFields(true);
  invalidateLayout();scheduleDraw();
  snack("Drag either handle on the graph to shape it.");
});
$("#bezSave").addEventListener("click",()=>{
  if(S.scaleEase!=="custom"){snack("Shape a curve first — pick a curve or drag the graph.");return;}
  const name=(prompt("Name this curve:","My curve")||"").trim();
  if(!name)return;
  const list=loadBez();
  const at=list.findIndex(c=>c[0].toLowerCase()===name.toLowerCase());
  if(at>=0)list[at]=[name,S.bezier.slice()];else list.push([name,S.bezier.slice()]);
  saveBez(list);syncEaseBtn();
  snack((at>=0?"Updated":"Saved")+" curve \u201C"+name+"\u201D");
});
/* a standalone solver for a thumbnail's own control points, independent of S */
function cubicThumb(v){
  const [x1,y1,x2,y2]=v;
  const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx;
  const cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
  const fx=t=>((ax*t+bx)*t+cx)*t,fy=t=>((ay*t+by)*t+cy)*t,dfx=t=>(3*ax*t+2*bx)*t+cx;
  return x=>{let t=x;for(let i=0;i<6;i++){const e=fx(t)-x;if(Math.abs(e)<1e-3)break;const dv=dfx(t);if(Math.abs(dv)<1e-6)break;t-=e/dv;}return fy(clamp(t,0,1));};
}

/* ---------- element visibility ---------- */
const TICK='<svg class="tick" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';
export function buildShowChips(){
  const brand=d().brand;if(!brand)return;
  const id=S.design;
  const box=$("#showGrid");box.innerHTML="";
  const wrap=document.createElement("div");wrap.className="chips";
  HIDEABLE.forEach(([key,label,test])=>{
    if(EYE_OWNED[key])return;          /* already has an eye on its own row */
    if(!test(brand,id))return;
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
  S.hidden={};S.hideCounts=false;
  buildShowChips();syncEyes();syncCounts();applyRelevance();
  invalidateLayout();scheduleDraw();
});
/* Blanking the numbers keeps the icons but empties every count — and with nothing
   left to type into, the Engagement section itself goes (see RELEVANT). The switch
   stays outside that section, or it would collapse along with it. */
export function syncCounts(){
  const el=$("#hideCounts");if(el)el.checked=!!S.hideCounts;
}
$("#hideCounts").addEventListener("change",e=>{
  S.hideCounts=e.target.checked;
  applyRelevance();invalidateLayout();scheduleDraw();
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
/* A preset carries a look, not content, so its thumbnail is the card as it
   stood when saved — rendered once at save time and stored with it, because
   re-rendering every row on every repaint would cost far more than the ~3KB. */
const THUMB_PX=96;
function presetThumb(){return cardThumbURL(THUMB_PX);}
/* The preset list became a picker in the header: the look-switcher belongs beside
   the card-type switcher, since the two together are "what am I making". Save,
   update and delete all live inside the list. */
export function renderPresets(){
  const v=$("#presetVal");if(!v)return;
  v.textContent=activePreset||"Look";
  v.classList.toggle("dim",!activePreset);
}
function buildPresetPop(){
  const pop=$("#presetPop");pop.innerHTML="";
  const list=loadPresets();
  const head=t=>{const h=document.createElement("div");h.className="combo-grp";h.textContent=t;pop.appendChild(h);};
  if(!list.length){
    const e=document.createElement("div");e.className="combo-empty";
    e.textContent="No looks saved yet.";pop.appendChild(e);
  }else{
    head("Saved looks");
    list.forEach((pr,i)=>{
      const b=document.createElement("button");
      b.className="combo-opt";b.type="button";b.dataset.at=String(i);
      b.setAttribute("role","option");
      b.setAttribute("aria-selected",String(pr.name===activePreset));
      if(pr.thumb){
        const im=document.createElement("span");
        im.className="th";im.style.setProperty("--th","url("+pr.thumb+")");
        b.appendChild(im);
      }
      const t=document.createElement("span");t.className="lb";t.textContent=pr.name;
      b.appendChild(t);
      const up=document.createElement("button");
      up.className="rm up";up.type="button";up.textContent="Update";
      up.title="Overwrite this look with the current card";
      const rm=document.createElement("button");
      rm.className="rm";rm.type="button";rm.textContent="\u2715";rm.title="Delete this look";
      b.append(up,rm);
      pop.appendChild(b);
    });
  }
  const foot=document.createElement("button");
  foot.className="combo-opt add";foot.type="button";foot.id="presetSave";
  foot.textContent="Save the current card as a look\u2026";
  pop.appendChild(foot);
}
export function initPresetPicker(){
  bindPop("#presetCombo","#presetBtn","#presetPop",buildPresetPop,(b,e)=>{
    if(b.id==="presetSave"){
      const name=(prompt("Name this look:","")||"").trim();
      if(!name)return false;
      const l=loadPresets();
      const at=l.findIndex(x=>x.name.toLowerCase()===name.toLowerCase());
      const entry={name,data:snapshot(),thumb:presetThumb()};
      if(at>=0)l[at]=entry;else l.push(entry);
      storePresets(l);activePreset=name;renderPresets();
      snack("Saved \u201C"+name+"\u201D");
      return true;
    }
    const at=+b.dataset.at,list=loadPresets(),pr=list[at];
    if(!pr)return false;
    if(e.target.closest(".up")){
      list[at]={name:pr.name,data:snapshot(),thumb:presetThumb()};
      storePresets(list);activePreset=pr.name;renderPresets();
      buildPresetPop();placePop("#presetBtn","#presetPop");
      snack("Updated \u201C"+pr.name+"\u201D");
      return false;
    }
    if(e.target.closest(".rm")){
      list.splice(at,1);storePresets(list);
      if(activePreset===pr.name)activePreset=null;
      renderPresets();buildPresetPop();placePop("#presetBtn","#presetPop");
      return false;
    }
    applyPreset(pr);renderPresets();
  });
  renderPresets();
}

/* Push every value in S back into its control. Called after applying a preset
   and after an undo, so it has to cover everything — a control left out would
   silently show a stale value. */
export function syncAllControls(){
  /* segmented groups */
  ["theme","face","hlStyle","crop","res","bg","fps","fadeEase","format","mode","imgFmt","badge","avShape"]
    .forEach(g=>{
      const host=$("#"+g);if(!host)return;
      host.querySelectorAll("button[data-v]").forEach(x=>
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
  ["header","marks","anim","hlAnim","likeOn","twReply","subBadge","modBadge"]
    .forEach(id=>{const el=$("#"+id);if(el)el.checked=!!S[id];});
  syncCounts();
  /* text fields */
  [["text","text"],["outlet","outlet"],["url","url"],["name","name"],["handle","handle"],
   ["sub","sub"],["time","time"],["audio","audio"],["mediaSrc","mediaSrc"],
   ["exportName","exportName"],["hlHex","hlColor"]].forEach(([id,k])=>{
    const el=$("#"+id);if(el&&S[k]!==undefined)el.value=S[k];
  });
  R.lastText=S.text;autogrow(ta);
  R.wordSig=null;
  setHl(S.hlColor,["#FFA8C5","#FFE566","#9BF6A5","#8BD3FF","#FF7A45"]
    .some(x=>x.toLowerCase()===String(S.hlColor).toLowerCase()));
  syncBezBtn(true);syncGuides();syncHints();
  setViewChip();updateFabLabel();syncDesignBtn();
  applyDesign();     /* runs applyRelevance(), which owns all conditional rows */
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
