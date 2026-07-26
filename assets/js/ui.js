/* ui.js — All DOM wiring: text fields, sliders, segmented groups, tabs, presets, design switching. */
/* ---------- tap to highlight ---------- */
let wordSig=null;
function syncWords(){
  if(S.mode!=="tap")return;
  const box=$("#words");
  if(wordSig!==S.text){
    const re=/\S+/g,frag=document.createDocumentFragment();let m;
    while((m=re.exec(S.text))){
      const b=document.createElement("button");
      b.className="w";b.textContent=m[0];
      b.dataset.s=m.index;b.dataset.e=m.index+m[0].length;
      frag.appendChild(b);
    }
    box.innerHTML="";box.appendChild(frag);wordSig=S.text;
  }
  for(const b of box.children) b.classList.toggle("on",covered(S.ranges,+b.dataset.s,+b.dataset.e));
}
function toggleToken(s,e,force){
  const on=covered(S.ranges,s,e),want=force===undefined?!on:force;
  if(want===on)return false;
  S.ranges=want?bridge(S.ranges.concat([[s,e]])):trimEdges(subtract(S.ranges,s,e));
  invalidateLayout();return true;
}
(function(){
  const box=$("#words");let down=false,mode2,sx=0,sy=0,armed=false;
  box.addEventListener("pointerdown",e=>{
    const w=e.target.closest(".w");if(!w)return;
    down=true;armed=false;sx=e.clientX;sy=e.clientY;
    mode2=!covered(S.ranges,+w.dataset.s,+w.dataset.e);
    if(toggleToken(+w.dataset.s,+w.dataset.e,mode2))scheduleDraw();
  });
  box.addEventListener("pointermove",e=>{
    if(!down)return;
    if(!armed){
      if(Math.abs(e.clientX-sx)<10&&Math.abs(e.clientY-sy)<10)return;
      if(Math.abs(e.clientY-sy)>Math.abs(e.clientX-sx)){down=false;return;}
      armed=true;try{box.setPointerCapture(e.pointerId);}catch(_){}
    }
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const w=el&&el.closest?el.closest(".w"):null;
    if(w&&box.contains(w)&&toggleToken(+w.dataset.s,+w.dataset.e,mode2))scheduleDraw();
  });
  const up=e=>{down=false;armed=false;try{box.releasePointerCapture(e.pointerId);}catch(_){}};
  box.addEventListener("pointerup",up);box.addEventListener("pointercancel",up);
})();

/* ---------- outlet autocomplete ---------- */
const acEl=$("#ac"),outletEl=$("#outlet"),urlEl=$("#url");
let acItems=[],acIdx=-1;
function today(){
  const dd=new Date(),M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return dd.getDate()+" "+M[dd.getMonth()]+" "+dd.getFullYear();
}
function acClose(){acEl.dataset.open="false";outletEl.setAttribute("aria-expanded","false");acIdx=-1;acItems=[];}
function acOpen(q){
  const s=q.trim().toLowerCase();
  if(!s){acClose();return;}
  const starts=[],has=[];
  for(const o of OUTLETS){
    const n=o[0].toLowerCase();
    if(n.startsWith(s))starts.push(o);
    else if(n.includes(s)||o[1].includes(s))has.push(o);
  }
  acItems=starts.concat(has).slice(0,8);
  if(!acItems.length||(acItems.length===1&&acItems[0][0].toLowerCase()===s)){acClose();return;}
  acEl.innerHTML="";
  acItems.forEach((o,i)=>{
    const li=document.createElement("li");
    li.setAttribute("role","option");li.setAttribute("aria-selected",String(i===acIdx));
    const b=document.createElement("b");b.textContent=o[0];
    const sm=document.createElement("small");sm.textContent=o[1];
    li.append(b,sm);
    li.addEventListener("mousedown",ev=>{ev.preventDefault();acPick(i);});
    acEl.appendChild(li);
  });
  acEl.dataset.open="true";outletEl.setAttribute("aria-expanded","true");
}
function acMove(dir){
  if(acEl.dataset.open!=="true")return;
  acIdx=(acIdx+dir+acItems.length)%acItems.length;
  [...acEl.children].forEach((li,i)=>{
    li.setAttribute("aria-selected",String(i===acIdx));
    if(i===acIdx)li.scrollIntoView({block:"nearest"});
  });
}
function acPick(i){
  const o=acItems[i];if(!o)return;
  S.outlet=o[0];outletEl.value=o[0];markFilled(outletEl);
  if(urlAuto||!urlEl.value.trim()){
    S.url=o[1]+" · "+today();urlEl.value=S.url;markFilled(urlEl);urlAuto=true;
  }
  acClose();invalidateLayout();scheduleDraw();
}
outletEl.addEventListener("input",e=>{S.outlet=e.target.value;markFilled(outletEl);acIdx=-1;acOpen(e.target.value);invalidateLayout();scheduleDraw();});
outletEl.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"){e.preventDefault();if(acEl.dataset.open!=="true")acOpen(outletEl.value);acMove(1);}
  else if(e.key==="ArrowUp"){e.preventDefault();acMove(-1);}
  else if(e.key==="Enter"){if(acEl.dataset.open==="true"){e.preventDefault();acPick(acIdx<0?0:acIdx);}}
  else if(e.key==="Escape"){acClose();}
  else if(e.key==="Tab"){acClose();}
});
outletEl.addEventListener("blur",()=>setTimeout(acClose,120));
urlEl.addEventListener("input",e=>{S.url=e.target.value;urlAuto=false;markFilled(urlEl);invalidateLayout();scheduleDraw();});

/* ---------- text fields ---------- */
const ta=$("#text");ta.value=S.text;
function markFilled(el){el.classList.toggle("filled",!!el.value);}
function autogrow(el){el.style.height="auto";el.style.height=Math.min(el.scrollHeight,210)+"px";}
let lastSel=[0,0];
const capSel=()=>{if(document.activeElement===ta)lastSel=[ta.selectionStart,ta.selectionEnd];};
["keyup","mouseup","touchend","select"].forEach(ev=>ta.addEventListener(ev,capSel));
document.addEventListener("selectionchange",capSel);
ta.addEventListener("input",()=>{
  const rs=remap(lastText,ta.value,S.ranges);
  S.text=ta.value;lastText=ta.value;setRanges(rs);markFilled(ta);autogrow(ta);invalidateLayout();scheduleDraw();
});
function toggleHL(){
  let [s,e]=[ta.selectionStart,ta.selectionEnd];
  if(s===e)[s,e]=lastSel;
  if(s===e){snack("Select some words first.");return;}
  S.ranges=covered(S.ranges,s,e)?trimEdges(subtract(S.ranges,s,e)):bridge(S.ranges.concat([[s,e]]));
  invalidateLayout();scheduleDraw();
}
$("#hlBtn").addEventListener("click",toggleHL);
$("#clearBtn").addEventListener("click",()=>{S.ranges=[];invalidateLayout();scheduleDraw();});
$("#clearBtn2").addEventListener("click",()=>{S.ranges=[];invalidateLayout();scheduleDraw();});
document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="h"){e.preventDefault();toggleHL();}
  if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();$("#dl").click();}
});
/* the strip is short, so fit the card into it unless the user pinned a view
   (setEditing in state.js handles the strip itself) */
document.addEventListener("focusin",e=>{
  if(!isPhone()||viewPinned)return;
  if(e.target.matches&&e.target.matches(KB_SEL)&&S.view!=="card"){S.view="card";setViewChip();scheduleDraw();}
});

/* ---------- social text inputs ---------- */
function bindText(id,key,fmt){
  const el=$("#"+id);if(!el)return;
  el.addEventListener("input",e=>{S[key]=e.target.value;markFilled(el);invalidateLayout();scheduleDraw();});
}
["name","handle","sub","time","audio","mediaSrc"].forEach(id=>bindText(id,id));
["follow","likeOn"].forEach(id=>$("#"+id).addEventListener("change",e=>{S[id]=e.target.checked;invalidateLayout();scheduleDraw();}));

/* metrics grid built dynamically per design */
function buildMetrics(){
  const brand=d().brand;if(!brand)return;
  const grid=$("#metricGrid");grid.innerHTML="";
  (METRICS[brand]||[]).forEach(([key,label,ph])=>{
    const row=document.createElement("div");row.className="row";
    const inp=document.createElement("input");
    inp.type="text";inp.className="txt";inp.spellcheck=false;inp.placeholder=ph||"";
    inp.id="metric_"+key;inp.value=S[key]||"";
    const lb=document.createElement("label");lb.setAttribute("for",inp.id);lb.textContent=label;
    inp.addEventListener("input",e=>{S[key]=e.target.value;invalidateLayout();scheduleDraw();});
    row.append(lb,inp);grid.appendChild(row);
  });
}

/* image uploads */
function bindImage(fileId,dropId,thumbId,nameId,clearId,key){
  const file=$("#"+fileId),thumb=$("#"+thumbId),nm=$("#"+nameId),clr=$("#"+clearId);
  file.addEventListener("change",e=>{
    const f=e.target.files&&e.target.files[0];if(!f)return;
    const img=new Image();const u=URL.createObjectURL(f);
    img.onload=()=>{S[key]=img;thumb.style.backgroundImage="url("+u+")";thumb.innerHTML="";nm.textContent=f.name;clr.classList.remove("hide");invalidateLayout();scheduleDraw();};
    img.src=u;
  });
  clr.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();S[key]=null;file.value="";thumb.style.backgroundImage="";
    thumb.innerHTML=key==="avatar"?'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>':'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M4 18l5-4 4 3 3-2 4 3"/></svg>';
    nm.textContent=key==="avatar"?"Optional — a coloured initial is used otherwise":"Shown inside the post";clr.classList.add("hide");invalidateLayout();scheduleDraw();});
}
bindImage("avatarFile","avatarDrop","avatarThumb","avatarName","avatarClear","avatar");
bindImage("mediaFile","mediaDrop","mediaThumb","mediaName","mediaClear","media");

/* ---------- highlight colour ---------- */
const hexEl=$("#hlHex"),pickEl=$("#hlPick");
function setHl(col,fromPreset){
  S.hlColor=col;
  document.documentElement.style.setProperty("--hl",col);
  hexEl.value=col.toUpperCase();markFilled(hexEl);
  pickEl.value=col;
  $("#pickwrap").dataset.active=!fromPreset;
  /* the custom picker sits in the same row and carries no data-v */
  $("#hlColor").querySelectorAll("button[data-v]").forEach(b=>
    b.setAttribute("aria-pressed",String(!!fromPreset&&b.dataset.v.toLowerCase()===col.toLowerCase())));
  scheduleDraw();
}
pickEl.addEventListener("input",e=>setHl(e.target.value,false));
hexEl.addEventListener("input",e=>{
  let v=e.target.value.trim();if(v[0]!=="#")v="#"+v;
  if(/^#[0-9a-f]{6}$/i.test(v))setHl(v,false);
});

/* ---------- sliders (fill tracks handle) ---------- */
/* ---------- sliders: drag, type an exact value, or double-click to reset ---------- */
const SL=["width","size","ypos","sFrom","over","drift","hold","dur","hlOffset","hlDur","jq"];
const LAYOUT_SLIDERS={width:1,size:1,ypos:1};
const SL_DEFAULT={};
function fillSlider(el){
  const mn=+el.min,mx=+el.max,frac=(el.value-mn)/(mx-mn||1);
  /* the 13px thumb is inset by half its width at each end */
  el.style.setProperty("--fill","calc("+frac+" * (100% - 13px) + 6.5px)");
}
function applySlider(id,v,fromBox){
  const el=$("#"+id),box=$("#"+id+"Num");
  v=clamp(Math.round(v),+el.min,+el.max);
  S[id]=v;el.value=v;
  if(!fromBox||document.activeElement!==box)box.value=v;
  fillSlider(el);
  if(LAYOUT_SLIDERS[id])invalidateLayout();
  scheduleDraw();
}
SL.forEach(id=>{
  const el=$("#"+id),box=$("#"+id+"Num");if(!el||!box)return;
  SL_DEFAULT[id]=S[id];
  el.addEventListener("input",()=>applySlider(id,+el.value,false));
  el.addEventListener("dblclick",()=>applySlider(id,SL_DEFAULT[id],false));
  box.addEventListener("input",()=>{const v=parseFloat(box.value);if(!isNaN(v))applySlider(id,v,true);});
  box.addEventListener("blur",()=>{box.value=S[id];});
  box.addEventListener("keydown",e=>{
    if(e.key==="Enter"){box.blur();return;}
    const step=e.shiftKey?10:1;
    if(e.key==="ArrowUp"){e.preventDefault();applySlider(id,S[id]+step,true);box.value=S[id];}
    if(e.key==="ArrowDown"){e.preventDefault();applySlider(id,S[id]-step,true);box.value=S[id];}
  });
  box.value=S[id];fillSlider(el);
});

/* ---------- toggles ---------- */
["header","marks","guides","anim"].forEach(id=>$("#"+id).addEventListener("change",e=>{S[id]=e.target.checked;invalidateLayout();scheduleDraw();}));
$("#hlAnim").addEventListener("change",e=>{S.hlAnim=e.target.checked;$("#hlAnimRow").classList.toggle("hide",!S.hlAnim);scheduleDraw();});

/* ---------- segmented groups ---------- */
const FMT={still:["Download","A single settled frame."],
  seq:["Download sequence","Numbered PNGs in a zip. Keeps alpha, lossless. Use for Premiere delivery."],
  webm:["Download WebM","Video with no alpha channel. Premiere may not read it."],
  gif:["Download GIF","Looping GIF with 1-bit transparency. Good for quick overlays."]};
function updateFabLabel(){
  const base=FMT[S.format][0];
  $("#fabLabel").textContent=S.format==="still"?"Download "+S.imgFmt.toUpperCase():base;
  $("#fmtNote").textContent=FMT[S.format][1];
  $("#stillFmtCard").classList.toggle("hide",S.format!=="still");
}
["theme","face","hlStyle","crop","res","bg","fps","fadeEase","scaleEase","format","mode","imgFmt","badge","avShape"].forEach(g=>{
  const host=$("#"+g);
  /* groups with many options are <select>; the rest are segmented buttons */
  const isSel=host.tagName==="SELECT";
  host.addEventListener(isSel?"change":"click",e=>{
    if(isSel)S[g]=host.value;
    else{
      const b=e.target.closest("button");if(!b)return;
      [...host.querySelectorAll("button")].forEach(x=>x.setAttribute("aria-pressed",x===b));
      S[g]=b.dataset.v;
    }
    if(g==="format"){updateFabLabel();}
    if(g==="imgFmt"){$("#jpegQ").classList.toggle("hide",S.imgFmt!=="jpeg");updateFabLabel();}
    if(g==="scaleEase"){$("#customRow").classList.toggle("hide",S.scaleEase!=="custom");$("#overLab").textContent=(S.scaleEase==="spring")?"Bounciness":"Overshoot";drawCurve();}
    if(g==="fadeEase")drawCurve();
    if(g==="mode"){
      $("#typeBox").style.display=S.mode==="type"?"":"none";
      $("#tapBox").style.display=S.mode==="tap"?"":"none";
      wordSig=null;
    }
    if(g==="theme"||g==="face"||g==="badge"||g==="avShape")invalidateLayout();
    scheduleDraw();
  });
});
$("#hlColor").addEventListener("click",e=>{
  const b=e.target.closest("button[data-v]");if(!b)return;
  setHl(b.dataset.v,true);
});
$("#exportName").addEventListener("input",e=>{S.exportName=e.target.value;markFilled(e.target);});

/* ---------- bezier presets ---------- */
refreshBezSelect();
$("#bezPreset").addEventListener("change",e=>{const b=allBez()[+e.target.value];if(b){S.bezier=b[1].slice();drawCurve();scheduleDraw();}});
$("#bezSave").addEventListener("click",()=>{
  const name=prompt("Name this curve (like a Premiere preset):","My curve");
  if(!name)return;
  const list=loadBez();list.push([name,S.bezier.slice()]);saveBez(list);
  refreshBezSelect();$("#bezPreset").value=String(allBez().length-1);
  snack("Saved curve “"+name+"”");
});

/* ---------- tabs (desktop rail + mobile thumb bar stay in sync) ---------- */
function goTab(name){
  document.querySelectorAll(".tabs button,.mbar .mt").forEach(x=>
    x.setAttribute("aria-selected",String(x.dataset.p===name)));
  document.querySelectorAll(".page").forEach(p=>p.dataset.on=(p.dataset.page===name));
  $(".pages").scrollTop=0;
  scheduleDraw();
}
[".tabs",".mbar"].forEach(sel=>{
  document.querySelector(sel).addEventListener("click",e=>{
    const b=e.target.closest("button[data-p]");if(!b)return;goTab(b.dataset.p);
  });
});
$("#dlMobile").addEventListener("click",()=>$("#dl").click());
/* jump straight to a tab with 1-4 when not typing */
document.addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const t=e.target.tagName;
  if(t==="INPUT"||t==="TEXTAREA"||t==="SELECT")return;
  const map={"1":"content","2":"style","3":"motion","4":"export"};
  if(map[e.key]){e.preventDefault();goTab(map[e.key]);}
});

/* ---------- design switch ---------- */
function applyDesign(){
  const P=d();
  const social=P.social;
  $("#sourceCard").classList.toggle("hide",social);
  $("#showCard").classList.toggle("hide",!social);
  $("#socialCard").classList.toggle("hide",!social);
  $("#metricsCard").classList.toggle("hide",!social);
  $("#faceWrap").classList.toggle("hide",social);
  $("#headerRow").classList.toggle("hide",social);
  $("#marksRow").classList.toggle("hide",social);
  $("#themeLab").textContent=social?"Appearance":"Theme";
  /* theme options: social only light/dark */
  const themeBtns=[...$("#theme").children];
  themeBtns[1].classList.toggle("hide",social); /* Paper hidden for social */
  if(social&&S.theme==="paper"){S.theme="light";themeBtns.forEach(x=>x.setAttribute("aria-pressed",x.dataset.v==="light"));}
  $("#bodyHead").textContent=social?"Post text":"Quote";
  $("#textLabel").textContent=social?"What does the post say?":"Paste the quote";
  $("#subtitle").textContent=social?(P.brand.toUpperCase()+" — 9:16 for Shorts"):"9:16 source cards for Shorts";
  if(social){
    const brand=P.brand;
    $("#socialHead").textContent="Account";
    /* subreddit field for reddit; for X reply it becomes "replying to" */
    const showSub=(brand==="reddit")||(S.design==="x-reply");
    $("#sub").parentElement.classList.toggle("hide",!showSub);
    const subLbl=$("#subRow").querySelector('label[for="sub"]');
    if(subLbl)subLbl.textContent=(S.design==="x-reply")?"Replying to @":"Subreddit";
    /* handle unused for facebook */
    $("#handle").parentElement.classList.toggle("hide",brand==="fb");
    $("#handleLabel").textContent=(brand==="reddit")?"u/username":(brand==="yt")?"@channel":(brand==="ig")?"username":"@handle";
    /* badge only where platforms show one */
    $("#badgeRow").classList.toggle("hide",brand==="yt"||brand==="reddit");
    $("#avShapeRow").classList.toggle("hide",brand!=="x");
    $("#followRow").classList.toggle("hide",!(S.design==="fb-post"||S.design==="ig-post"));
    $("#audioRow").classList.toggle("hide",S.design!=="ig-post");
    const showMedia=(S.design==="x-post"||S.design==="x-reply"||S.design==="reddit-post"||
                     S.design==="fb-post"||S.design==="ig-post");
    $("#mediaDrop").classList.toggle("hide",!showMedia);
    $("#mediaSrcRow").classList.toggle("hide",brand!=="x");
    buildMetrics();buildShowChips();
    /* sync identity inputs + controls */
    ["name","handle","sub","time","audio","mediaSrc"].forEach(id=>{const el=$("#"+id);if(el){el.value=S[id]||"";markFilled(el);}});
    [...$("#badge").children].forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===S.badge));
    [...$("#avShape").children].forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===S.avShape));
    $("#follow").checked=S.follow;$("#likeOn").checked=S.likeOn;
  }
  invalidateLayout();updateFabLabel();scheduleDraw();
}

/* ---------- view / play ---------- */
function setViewChip(){
  const b=$("#view");
  b.setAttribute("aria-pressed",S.view==="card");
  b.querySelector("span").textContent=S.view==="card"?"Fit frame":"Fit card";
}
$("#view").addEventListener("click",()=>{S.view=S.view==="frame"?"card":"frame";viewPinned=true;setViewChip();scheduleDraw();});
cv.addEventListener("click",()=>$("#view").click());
$("#play").addEventListener("click",()=>{
  playing=!playing;
  const b=$("#play");
  b.querySelector("span").textContent=playing?"Stop":"Play";
  b.querySelector("svg").innerHTML=playing?'<rect x="6" y="6" width="12" height="12" rx="2"></rect>':'<path d="M7 4l13 8-13 8z"></path>';
  b.setAttribute("aria-pressed",playing);
  if(playing)playT0=performance.now();
  draw();
});

