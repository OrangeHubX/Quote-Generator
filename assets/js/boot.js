/* boot.js — Startup. Runs last, once every module above has defined its parts. */
setHl(S.hlColor,true);
markFilled(ta);autogrow(ta);
$("#overLab").textContent="Overshoot";
updateFabLabel();
syncDesignBtn();
buildShowChips();
renderPresets();
applyDesign();
syncVH();
draw();
/* fonts and scrollbars can settle a frame late; re-fit once */
setTimeout(draw,150);
