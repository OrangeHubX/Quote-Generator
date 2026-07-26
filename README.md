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
  layout.js             layout dispatch + cache, easing, timing, whole-frame paint
  graph.js              motion graph: value + velocity plots, bezier handles
  timeline.js           frame ruler, playhead, scrubbing, playback
  curve.js              the preview draw loop
  history.js            undo / redo over the whole editable state
  export.js             zip writer, GIF encoder, single-card export paths
  batch.js              queue several cards, export as one zip of folders
  ui.js                 DOM wiring: fields, sliders, segmented groups, tabs
  panels.js             comboboxes, show/hide chips, saved presets and curves
  sheet.js              draggable editor sheet (mobile)
  boot.js               entry point — the only script index.html loads
```

`boot.js` is the entry; everything else is reached through imports. A few
modules import from each other (`ui` ↔ `curve`, `ui` ↔ `panels`, `panels` ↔
`graph`); those cycles resolve because the cross-references are function calls,
never module-init reads. Anything that must run at startup goes in `boot.js`,
not at a module's top level — that is what caused a `BEZ_BUILTIN` temporal-
dead-zone error during the conversion. Where a cycle would otherwise be needed
just to notify, the callee registers a hook instead: `graph.js` calls
`setEaseHook()` rather than importing the ease control from `panels.js`.

`window.QS` exposes `S`, `R` and a few functions for console debugging.

## Notes

**Mobile keyboard.** Every mobile height derives from `--vh`, which tracks the
*visual* viewport. Never use static `vh` for layout heights — that is what let
the keyboard push fields out of view. While a field is focused, `data-kb="1"` on
`<html>` collapses the canvas to a short live strip so the field stays visible.

**Hiding elements.** `S.hidden` is a map of element keys that are not drawn;
`V_ON(key)` tests it and the layout closes the gap, so hiding the avatar or the
action row gives the space back rather than leaving a hole. `S.hideCounts`
blanks every engagement number while keeping the icons — and since that leaves
nothing to type into, `RELEVANT` collapses the whole Engagement section with it.
The switch that does the blanking has to live *outside* that section, or it would
disappear along with the thing it controls.

Visibility lives on the row it governs. `EYE_ROW` in `data.js` maps a hideable
key to the control row that owns it, and `EYE_OWNED` lists every key that has one
so the chip list can skip it; engagement fields get an eye each as the grid is
built. Only parts with no control of their own — the `…` menu, the action row,
Bookmark, Follow — remain as chips. Before this, a separate list of thirteen
chips could disagree with the fields beside it: a filled-in Name next to a card
that draws no name. A hidden row stays visible and stays editable, dimmed with a
slashed eye, so a field can be filled in before it is shown and the state is
never ambiguous.

**Set-once controls are folded, not deleted.** Roughly two thirds of the controls
are per-*channel* — theme, typeface, curves, resolution, background, frame rate,
naming pattern — decided once and then left alone, while about a dozen change on
every card. Weighting them equally is what made the panel feel busy. The curve
authoring tools sit behind *Shape the curve* and the output settings behind an
*Output* summary that states its own answer (`1080p · alpha · 30fps · PNG`), so
opening either is a choice rather than a toll. Nothing was removed.

**Presets** live in `localStorage` and store all of `S` except the decoded
images and the quote text itself, so a preset is a reusable *look*. They are a
picker in the header beside the card-type picker, because "what am I making" and
"in which look" are one decision. Each carries a thumbnail rendered at save time;
`cardThumbURL()` crops to the card rather than the whole 9:16 frame, because at
38px a card inside a full frame is a two-pixel sliver.

**Popups need their own width.** `placePop()` takes the wider of the button and
`POP_MIN_W`, then clamps `left` so the box stays on screen. Sizing a list to its
button left the look picker's rows so narrow that the row's own centre landed on
a hover action. For the same reason those hover actions carry
`pointer-events:none` while transparent — `opacity:0` alone still swallows the
click meant for the row.

**One text surface, not two modes.** The quote field and the word chips are both
always present: select a phrase and hit Highlight, or tap a chip for a word.
Treating them as alternatives left the phone with no text field at all, since
forcing tap mode there hid the box the textarea lived in.

**Timing is frame counts at the selected frame rate.** `S.dur`, `S.hold`,
`S.hlOffset` and `S.hlDur` are frames, so 15f is 15 frames at 24, 30 or 60fps
and the real-world duration is what changes. This used to divide by a hardcoded
`30`, which made the `f` unit a lie everywhere except at 30fps. `frameSec(i)` in
`layout.js` is the one frame→seconds mapping, shared by the timeline scrubber and
every exporter, so the frame under the playhead is the frame that gets written.

**Motion graph.** One canvas holds the eased 0..1 progress over its own velocity,
sharing a frame-numbered time axis. Both handles are plotted in the *same*
coordinate space as the curve they control — previously the curve was auto-ranged
while the handles used a fixed `-0.4..1.9` scale, so a handle never sat on its
own curve. The fitted range has to include the control points as well as the
curve: `y=1.56` produces a peak of only ~1.05, so fitting to the curve alone puts
the thing you are meant to drag off-screen. The range is frozen for the duration
of a drag, or re-fitting slides the graph out from under the pointer.

Handle values are surfaced as **Influence** and **Speed** per side, which is
After Effects' Keyframe Velocity model and the vocabulary an editor already has.
Both are editable and map back onto the control points exactly.

**Undo/redo** snapshots `S` after activity settles rather than instrumenting each
of the hundred-odd mutation sites — nothing can be forgotten, and coalescing
falls out for free, so a slider drag is one step. Restoring calls
`syncAllControls()`, which is therefore the one routine that must cover every
control; a field left out silently shows a stale value. It also has to overwrite
a *focused* field, which is why `syncBezFields()` takes a `force` flag: the
don't-move-the-caret guard is right while typing and wrong on undo.

**Batch export.** `batch.js` holds a queue of snapshots, each carrying its own
output settings — format, resolution, frame rate and framing come from the card,
not from whatever the panel shows at export time. Animated cards become one
folder each inside the zip so it can be unpacked straight into a project folder;
stills sit at the root. Frames repeat their folder name rather than restarting at
a bare `0000`, so a clip stays identifiable once it is on a timeline. Folder names
come from a token pattern (`{n}`, `{name}`, `{design}`, `{frames}`, `{fps}`,
`{size}`, `{date}`), separators are stripped so a pattern cannot nest folders,
and duplicate names get a numeric suffix — two cards silently overwriting each
other inside a zip is the worst kind of bug to find later. A `_manifest.txt` at
the root lists every folder with its settings and an import hint.

**Two "card" framings, deliberately named apart.** `S.view` is the preview zoom
(*Zoom to card*, `F`) and changes nothing about the output; `S.crop` is the
exported pixel size (*Crop to card*). They used to be *Fit card* and *Card only*,
which is one word apart for two very different consequences.

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
| Batch zip | per card | Several cards at once, one folder each |

A batch zip unpacks like this:

```
shorts-ep12.zip
  _manifest.txt
  01_quote_odds-of-this-happening/
    01_quote_odds-of-this-happening_0000.png
    01_quote_odds-of-this-happening_0001.png
  02_x-post_gta6-delay/
    02_x-post_gta6-delay_0000.png
  03_twitch-comment_no-way.png        ← stills need no folder
```

## Keyboard

| Key | Action |
|---|---|
| `1`–`4` | Jump to a tab |
| `F` | Zoom the preview to the card |
| `Space` | Play / pause |
| `←` `→` | Step one frame (`Shift` for ten) |
| `Home` `End` | First / last frame |
| `⌘H` / `Ctrl+H` | Highlight the selection |
| `⌘Z` / `Ctrl+Z` | Undo (`Shift` to redo) |
| `⌘⏎` / `Ctrl+⏎` | Export |

On the motion graph: click a handle then use the arrows to nudge it, `Shift` to
lock an axis while dragging, `Alt` to mirror the other handle, double-click to
straighten that side.
