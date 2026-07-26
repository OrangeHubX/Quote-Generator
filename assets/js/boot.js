/* boot.js — Startup. Runs last, once every module above has defined its parts. */
import {$, S} from './data.js';
import {syncVH} from './state.js';
import {draw, refreshBezSelect} from './curve.js';
import {applyDesign, autogrow, markFilled, setHl, ta, updateFabLabel} from './ui.js';
import {buildShowChips, renderPresets, syncDesignBtn} from './panels.js';
import {applySheet, initSheet} from './sheet.js';
import {R, V_ON} from './data.js';
import {invalidateLayout} from './layout.js';
import {scheduleDraw} from './state.js';
import {allBez} from './curve.js';
import {loadPresets} from './panels.js';

/* the app booted, so drop the "serve over http" notice */
const bm=document.getElementById("bootmsg");if(bm)bm.remove();

setHl(S.hlColor,true);
markFilled(ta);autogrow(ta);
$("#overLab").textContent="Overshoot";
updateFabLabel();
syncDesignBtn();
refreshBezSelect();
buildShowChips();
renderPresets();
applyDesign();
syncVH();
initSheet();
draw();
/* Debug handle. Modules keep their own scope, so expose the pieces worth
   poking at from the console (and what the test suite drives). */
window.QS={S,R,V_ON,draw,scheduleDraw,invalidateLayout,applyDesign,allBez,loadPresets,applySheet};

/* fonts and scrollbars can settle a frame late; re-fit once */
setTimeout(draw,150);
