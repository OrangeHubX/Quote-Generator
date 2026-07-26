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

**Keyboard and the viewport.** The shell is sized from `--vh`, which tracks the
*visual* viewport, so it covers exactly the visible area whether or not the
browser honours `interactive-widget=resizes-content`. `html`/`body` also carry
the nav bar colour, so even a rounding-sized sliver behind the shell is
invisible rather than a black band.

Only fields that actually raise a keyboard may set `data-kb`. A checkbox, radio
or range also takes focus when tapped, and treating those as "editing" collapsed
the canvas on every toggle — which expanded the editor and, while the strip
height was `!important`, made the drag grip look dead. `isTextField()` in
`state.js` is the single gate; keep the strip rule free of `!important` so the
drag can never be silently overridden.

**Popup placement (design list, cheer badges).** Both popups are
`position:fixed` and placed by the shared `placePop()` in `panels.js` against the
live viewport, using the top of the mobile nav bar as its floor. Each flips
upward when there is more room there and caps its height so it always scrolls
internally. Absolute positioning let them clip outside the editor with no way to
reach them.

Two ancestor properties silently break this, so `placePop()` moves the popup to
`document.body` before measuring:

- **A transform anywhere above it.** `position:fixed` resolves against the
  nearest ancestor that establishes a containing block, and a *filling*
  animation counts — `.page[data-on=true]` animates `transform`, which offset the
  cheer list by the panel header's height and pushed it off screen. Reparenting
  to body level makes placement unconditional.
- **`opacity` below 1.** That both tints the popup and traps its `z-index` in a
  new stacking context, which is why the parked state dims only `.pages`, never
  `.insp-top`.

**Twitch chat card.** `twitch-comment` renders badges, the coloured username and
the message as one flowing line by reusing the first-line indent from the
Instagram caption. Cheer badges are drawn, not fetched: `CHEER` in `data.js`
lists the 18 tiers, and `drawCheer()` paints a tile plus a glyph whose point
count climbs with the tier — coloured tile with a dark glyph below 200k, indigo
tile with a coloured glyph above it. The picker renders each option with the
same function, so the list can never drift from the output. **Reply to someone**
switches between a plain chat line and a reply — the "Replying to" row and the
field that feeds it appear together or not at all. Twitch has no like or view
counts, so `hasCounts()` hides the Numbers switch for it.

**Highlight hint in the text field.** `#textMirror` sits behind the textarea and
mirrors its content with the ranges wrapped in `<mark>`. It is deliberately
neutral — a faint underline, not the card's highlight colour — so the field shows
*what* is highlighted without competing with the canvas. It must stay in exact
metric sync with the textarea (same font, padding and wrapping) or the marks
drift off the words.

**Highlight mode.** Mobile forces **Tap words** and hides the selector:
dragging a text selection inside a sheet that also pans is fragile, and tapping
chips is faster. Desktop keeps both.

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
