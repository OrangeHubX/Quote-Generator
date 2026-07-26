/* boot.js — Startup. Runs last, once every module above has defined its parts.

   Anything that touches another module's top-level bindings belongs here rather
   than at a module's own top level: several modules form call-only import cycles,
   and reading across one during evaluation hits a temporal dead zone. */
import {$, R, S, V_ON} from './data.js';
import {invalidateLayout} from './layout.js';
import {scheduleDraw, syncVH} from './state.js';
import {draw} from './curve.js';
import {initGraph, setEaseHook} from './graph.js';
import {clampFrame, initTimeline} from './timeline.js';
import {initHistory, redo, undo} from './history.js';
import {applyDesign, applyModeForDevice, autogrow, markFilled, setHl, syncMirror, ta, updateFabLabel} from './ui.js';
import {buildShowChips, initEasePickers, loadPresets, renderPresets, syncAllControls, syncBezBtn, syncDesignBtn, syncEaseBtn} from './panels.js';
import {allBez} from './graph.js';
import {applySheet, initSheet} from './sheet.js';
import {exportBatch, initBatch, queueLength} from './batch.js';

/* the app booted, so drop the "serve over http" notice */
const bm=document.getElementById("bootmsg");if(bm)bm.remove();

setHl(S.hlColor,true);
markFilled(ta);autogrow(ta);syncMirror();
updateFabLabel();
syncDesignBtn();
initEasePickers();
/* picking a saved curve implies Custom ease; keep the ease button honest */
setEaseHook(()=>{syncEaseBtn();applyDesign();});
initGraph();
initTimeline();
buildShowChips();
renderPresets();
initBatch();
applyDesign();
applyModeForDevice();
syncVH();
initSheet();
clampFrame();
draw();
/* Undo replays whole snapshots, so it needs the one routine that pushes all of S
   back into the controls. Registered last, so the pristine load is step zero. */
initHistory(syncAllControls);

/* Debug handle. Modules keep their own scope, so expose the pieces worth poking
   at from the console (and what the test suite drives). */
window.QS={S,R,V_ON,draw,scheduleDraw,invalidateLayout,applyDesign,allBez,loadPresets,
  applySheet,syncBezBtn,undo,redo,exportBatch,queueLength};

/* the mode switch depends on the breakpoint, so revisit it on resize */
let wasPhone=window.matchMedia("(max-width:900px)").matches;
window.addEventListener("resize",()=>{
  const now=window.matchMedia("(max-width:900px)").matches;
  if(now!==wasPhone){wasPhone=now;applyModeForDevice();draw();}
});

/* fonts and scrollbars can settle a frame late; re-fit once */
setTimeout(draw,150);
