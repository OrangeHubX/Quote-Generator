# Quote Slate

A single-page tool for building 9:16 quote and social-post graphics for YouTube
Shorts, with motion and frame-accurate export for Premiere Pro.

Deployed on GitHub Pages. There is no build step, but the code is ES modules,
so it **must be served over http** — browsers block modules on `file://`. For
local work run `npx http-server` in this folder; opening `index.html` directly
shows a notice explaining exactly that rather than a blank page.

## Layout

```
index.html              markup only
assets/css/app.css      all styling (dark tool chrome)
assets/js/
  data.js               frame size, typefaces, card themes, outlets, palettes
  state.js              editable state, viewport sizing, redraw scheduler
  text.js               highlight ranges, wrapping, shared text block
  card-quote.js         the news quote card
  card-social.js        icon table, avatars, one renderer per platform
  layout.js             layout dispatch + cache, easing, whole-frame paint
  curve.js              motion graph, bezier handles, preview loop
  export.js             zip writer, GIF encoder, export paths
  ui.js                 DOM wiring: fields, sliders, segmented groups, tabs
  panels.js             design combobox, show/hide chips, saved presets
  sheet.js              draggable editor sheet (mobile)
  boot.js               entry point — the only script index.html loads
```

`boot.js` is the entry; everything else is reached through imports. A few
modules import from each other (`ui` ↔ `curve`, `ui` ↔ `panels`); those cycles
resolve because the cross-references are function calls, never module-init
reads. Anything that must run at startup goes in `boot.js`, not at a module's
top level — that is what caused a `BEZ_BUILTIN` temporal-dead-zone error during
the conversion.

`window.QS` exposes `S`, `R` and a few functions for console debugging.

## Notes

**Mobile keyboard.** Every mobile height derives from `--vh`, which tracks the
*visual* viewport. Never use static `vh` for layout heights — that is what let
the keyboard push fields out of view. While a field is focused, `data-kb="1"` on
`<html>` collapses the canvas to a short live strip so the field stays visible.

**Hiding elements.** `S.hidden` is a map of element keys that are not drawn;
`V_ON(key)` tests it and the layout closes the gap, so hiding the avatar or the
action row gives the space back rather than leaving a hole. `S.hideCounts`
blanks every engagement number while keeping the icons.

**Presets** live in `localStorage` and store all of `S` except the decoded
images and the quote text itself, so a preset is a reusable *look*.

**Relevance.** `RELEVANT` in `data.js` maps a control id to a test against the
active design; anything that fails is hidden, so a card type only ever shows
what it can actually use. `applyRelevance()` re-runs on design, animation and
export-format changes.

**Draggable editor (mobile).** `--canvasH` is the single knob — the editor takes
whatever height is left. Dragging the grip snaps between three stops: editor
full (canvas hidden), split, and parked at the bottom with only the grip in
reach. Tapping the grip cycles them.

What persists is the *snap state*, never a pixel height. Mobile browser chrome
changes `--vh` constantly, and re-clamping a stored pixel value against a fresh
maximum made the sheet drift on its own — sometimes into the parked state. For
the same reason the resize handler ignores height-only changes, and the parked
state must never set `pointer-events:none` or the editor could be stranded.

**Keyboard and the viewport.** `interactive-widget=resizes-content` in the
viewport meta makes the keyboard shrink the *layout* viewport, so `height:100%`
is exactly the visible area and no gap can open below the nav bar. The body also
takes the nav bar colour, so a browser that ignores the flag shows a blending
strip rather than a black band.

**Images.** `drawFitted()` covers the box first, then applies zoom and pan. Zoom
starts at 100% = exact cover, so the pan clamps to the resulting slack and an
empty edge is impossible. Avatars previously stretched non-square images because
they were drawn straight into a square box.

**Mutable state across modules.** Imported bindings are read-only, so runtime
flags that several modules write (`playing`, `editing`, `lastText`, …) live as
properties on the exported `R` object in `data.js`.

## Export

| Format | Alpha | Use |
|---|---|---|
| Frames (PNG zip) | yes | Delivery. Import frame `_0000` with **Image Sequence** ticked. |
| PNG / JPEG still | PNG only | Thumbnails, stills |
| GIF | 1-bit | Quick overlays, previews |
| WebM | no | Preview only — Premiere may need a plugin |
