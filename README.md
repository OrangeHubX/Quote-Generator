# Quote Slate

A single-page tool for building 9:16 quote and social-post graphics for YouTube
Shorts, with motion and frame-accurate export for Premiere Pro.

Open `index.html` — there is no build step. Scripts are plain (non-module)
`<script>` tags on purpose, so the app also runs when the file is opened
straight off disk rather than served.

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
  ui.js                 DOM wiring: fields, sliders, tabs, presets
```

Load order matters: `data.js` first, `ui.js` last.

## Export

| Format | Alpha | Use |
|---|---|---|
| Frames (PNG zip) | yes | Delivery. Import frame `_0000` with **Image Sequence** ticked. |
| PNG / JPEG still | PNG only | Thumbnails, stills |
| GIF | 1-bit | Quick overlays, previews |
| WebM | no | Preview only — Premiere may need a plugin |
