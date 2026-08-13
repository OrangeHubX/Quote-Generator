# Quote Slate + Studio

Two pages that share one set of renderers.

| Page | What it makes |
|---|---|
| `index.html` — **Quote Slate** | one 9:16 quote or social-post graphic, with motion and frame-accurate export |
| `studio.html` — **Studio** | a whole video: paste a script, get a timeline, export a 4K MP4 |

Deployed on GitHub Pages. There is no build step, but the code is ES modules,
so it **must be served over http** — browsers block modules on `file://`. For
local work run `npx http-server` in this folder; opening `index.html` directly
shows a notice explaining exactly that rather than a blank page.

## Studio, in one paragraph

Paste the `shotlist` block from a Claude script (see `SHOTLIST.md`) and it
becomes a Premiere-shaped sequence: gameplay filling the frame on the BG track,
overlays stacked on V1–V4, the read on the Script track, the voiceover on Voice.
Drag clips to retime them, drag their edges to trim, press `S` to split the
plate where the framing should change, and pick a different in/out animation per
element. The gameplay is always muted and blurs and dims itself under anything
with words on it. Export is a real 4K30 MP4 at YouTube's top recommended rate,
encoded frame by frame rather than recorded, so a slow machine takes longer
instead of dropping frames.

Paste an ordinary Claude answer with no block and it still works, roughly: the
read is timed from word count and the Visual beats table becomes notes on the
Beats track. That path exists to get you started, not to be trusted.

## Layout

```
index.html              markup only — the card editor
studio.html             markup only — the sequence editor
assets/css/app.css      all styling (dark tool chrome)
assets/css/studio.css   the studio shell, on the same tokens
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
  paste.js              the paste-an-image dialog shared by both image slots
  ui.js                 DOM wiring: fields, sliders, segmented groups, tabs
  panels.js             comboboxes, show/hide chips, saved presets and curves
  sheet.js              draggable editor sheet (mobile)
  paint-util.js         rr() and GRAIN — no dependencies, so cards can be drawn
                        on a page that has no card editor
  boot.js               entry point — the only script index.html loads
assets/js/studio/
  parse.js              the shotlist grammar, plus the plain-prose fallback
  spec.js               the format spec Claude is given (SHOTLIST.md comes from it)
  model.js              sequence, tracks, clips, split/duplicate, undo
  media.js              the media pool: images, plates, audio, loose name matching
  anim.js               in/out presets and the plate blur/dim ramp
  elements.js           text, stamp, list, lower third, image, caption
  card.js               a quote/social card as a timeline element
  draw.js               the compositor — one function paints one frame
  timeline.js           tracks, clips, trimming, scrubbing, snapping
  inspector.js          controls for whatever is selected
  output.js             audio mixing, plate parking, MP4 and frame exports
  mp4.js                H.264/AAC encoding and the MP4 muxer
  app.js                entry point — the only script studio.html loads
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

**The stage is three fixed bands.** A tool bar, the artwork, then the frame
ruler — only the middle band resizes. The tools used to float *over* the canvas
and the ruler was pinned to its bottom edge, so switching between card and
full-frame zoom moved both, and the buttons sat on top of the card. The canvas is
now sized from `.cwrap`'s own box (`flex:1; min-height:0; overflow:hidden`), which
means there is no chrome to subtract and no feedback loop: the bands size the
canvas, never the reverse.

**Mobile keyboard.** Every mobile height derives from `--vh`, which tracks the
*visual* viewport. Never use static `vh` for layout heights — that is what let
the keyboard push fields out of view. While a field is focused, `data-kb="1"` on
`<html>` collapses the canvas to a short live strip so the field stays visible.

Dismissing the keyboard with its own close button does **not** blur the field, so
`focusout` never fires. Without a second signal the strip stayed collapsed and the
drag grip looked dead until you tapped an empty area. `syncVH()` watches the
visual viewport for the shrink and then the re-grow, and blurs the field itself.

Two details make or break that check. Measure against the viewport's **own**
pre-keyboard height (`vvFull`), never against `window.innerHeight` — this page asks
for `interactive-widget=resizes-content`, so the keyboard shrinks the layout
viewport too and the gap between the two stays near zero for as long as the
keyboard is up. Comparing them dismissed the keyboard the instant it opened, on
every field. And the shrink has to have actually been observed (`sawKb`) before a
re-grow can mean anything, because `focusin` sets `data-kb` before the viewport has
moved at all.

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

**The playhead owns the preview, so moving it must repaint.** `setFrame()` used
to redraw only the ruler canvas, which left the card showing an old frame until
some unrelated event repainted it. And `play()` set `R.playing` without calling
`draw()` — the rAF loop lives *inside* `draw()`, so nothing started it. Both go
through a `repaint` hook that `boot.js` points at `draw()`. It has to be `draw()`
rather than `scheduleDraw()`: the scheduler deliberately no-ops while playing,
since the loop is what advances the frames.

**Getting to a draggable curve.** A built-in shape has no control points, so the
graph shows no handles — and after the ease and curve pickers merged there was
nothing saying how to get some. The picker's second group is labelled *Editable
curves*, and *Make this curve editable* converts the current shape to its nearest
bezier (`MODE_CURVE`) so you keep the curve you were looking at instead of being
reset.

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

**Getting an image in.** Four routes, all ending at the same decoder: the file
picker, a drag onto the row, and — through the paste dialog — a `paste` event or
`navigator.clipboard.read()`. `ui.js` registers each slot's `accept()` with
`registerSink()`, so `paste.js` never needs to know how an image is decoded or
which state key it lands in.

The dialog's drop zone is `contenteditable`. That is not decoration: a browser
only fires `paste` at an editable target, and on a phone — where there is no
Ctrl+V — an editable element is also the only thing that offers the OS Paste menu
on a long press. The instruction text is chosen per device for the same reason.

A copied **link** is refused deliberately. Drawing a remote image taints the
canvas, and a tainted canvas throws on `toBlob()` and `getImageData()` — so PNG,
JPEG and GIF export would all fail at the moment of export rather than at the
moment of pasting. A `data:` URL is same-origin and is accepted, which covers most
screenshot tools.

Closing the dialog restores focus on a timer, not synchronously: dismissing it by
pressing the backdrop means the browser is still going to move focus after the
handler returns, which would leave focus on `<body>`.

**Images.** `drawFitted()` covers the box first, then applies zoom and pan. Zoom
starts at 100% = exact cover, so the pan clamps to the resulting slack and an
empty edge is impossible. Avatars previously stretched non-square images because
they were drawn straight into a square box.

**Mutable state across modules.** Imported bindings are read-only, so runtime
flags that several modules write (`playing`, `editing`, `lastText`, …) live as
properties on the exported `R` object in `data.js`.

## Studio notes

**One paste, one format, one source of truth.** The grammar lives in
`parse.js`, the instructions Claude is given live in `spec.js`, and
`SHOTLIST.md` is generated from `spec.js` — so the "Copy format spec" button
cannot hand out a format the parser does not read. Chat clients rewrite
punctuation on the way out, so `tidy()` normalises en dashes, curly quotes and
non-breaking spaces before anything tries to match: an en dash silently killing
every time range is the failure you would spend an hour on.

There is no `\Z` in JavaScript. The prose fallback used
`(?=^#+\s|\Z)` to mean "next heading or end of input", and under `/i` that
matched the letter *z* — the read stopped inside the name "Jynxzi". The section
is now taken whole and cut at the next heading in a second step, which is
longer and cannot be read as something it isn't.

**The preview is not the exporter, deliberately.** Playback runs the plate as a
real `<video>` at real speed and draws at whatever size the window allows,
because a preview that insists on being frame-exact at 4K is a preview nobody
can scrub. The exporter parks the same plate one frame at a time at full size
and pushes it through the same `renderFrame()`. Nothing about the picture can
differ between them except resolution, and a slow machine produces a slower
export rather than a dropped frame — which is the whole reason this does not
use `MediaRecorder`.

**Blur is done small.** A 40px blur across a 2160-wide frame costs tens of
milliseconds per frame; the same look comes from a 9px blur on a 480-wide copy
scaled back up, because the upscale does the last of the work. The radius is
authored against a 1080 short edge and converted twice — into frame pixels, then
into the small canvas — so the blur is the same *look* at every export size.
The upscale overdraws by the blur radius, or the softened edge shows the frame's
own border.

**Contrast is a property of the overlay, not a keyframe.** Every visual clip
carries `blur` and `dim` flags; `plateEffect()` takes the strongest request from
whatever is up and ramps it over `blurRamp` frames. So the gameplay softens
because something readable arrived, and hardens when it leaves, without anyone
animating anything. A lower third that runs the whole video is the one case that
must switch both off, which is why the shotlist example says so out loud.

**Splitting the plate is how you reframe it.** One gameplay take usually needs
different framing at different moments. `S` razors the clip at the playhead and
the tail keeps playing the same source from the same point, so a split changes
zoom and pan without changing what is on screen. The tail's entrance animation
is cleared on the way — replaying it would flash.

**Cards are borrowed, not rebuilt.** A CARD clip lends the module-level `S` to
the existing card renderers and hands it straight back in a `finally`, so a
throw cannot leave the card editor on the other page wearing this clip's text.
The result is cached per card, so a 900-frame export pays for each card once.
Getting there needed `rr()` and `GRAIN` moved out of `state.js` into
`paint-util.js`: a renderer that wanted a rounded rectangle was dragging the
viewport, the keyboard handling and the redraw scheduler in behind it.

**The muxer.** WebCodecs returns encoded chunks, not a file, so `mp4.js` writes
the MP4: `moov` in front of `mdat` (faststart), video timescale equal to the
frame rate with every sample exactly one tick long, and samples interleaved in
one-second chunks rather than two giant runs. Integer sample durations cannot
drift, which is the point of rendering deterministically in the first place.
`stco` is 32-bit, so `finalize()` refuses past 4GB rather than writing wrapped
offsets — about twelve minutes at the 4K rate.

**Bitrate follows YouTube's own table.** 45 Mb/s for 2160p30, 16 for 1440p30,
8 for 1080p30, doubled-ish above 34fps. The top of the published range is what
"max recommended" means; going past it does not survive the re-encode, it only
makes the upload slower.

**On a phone the inspector stops being a column.** The desktop shell is a viewer
beside a 330–392px inspector, and that split is exactly what made a phone
unusable: at 412px the inspector left 82px for the editor and the preview came
out 50px wide. Below 900px the inspector becomes a bottom sheet instead, and the
editor gets the full width back.

The sheet never fully leaves — it rests with its tab row showing, which is both
the handle and the thing you were reaching for anyway. Tapping a tab raises it on
that tab; tapping the tab already showing puts it down. Tapping a clip raises it
too, because a press that never moved is a request to edit rather than to retime
— which is why `onTap` fires from `onUp` only when `moved` is false, and why the
preview ignores the first few pixels of travel before it starts repositioning
anything.

Raising the sheet shrinks the stage by exactly the sheet's height and hides the
timeline, which is behind the sheet regardless. One `--sheet-h` drives all three,
so the whole frame stays visible while you adjust it rather than being edited
blind. CSS cannot tell a canvas that its box changed, so `setSheet()` repaints
at the start of the slide and again once it has settled.

**Three input models, one canvas.** A mouse gets hover, edge cursors and
ctrl+wheel zoom. A thumb gets none of those, so it gets gestures:

| Gesture | Does |
|---|---|
| one finger on the ruler | scrub |
| one finger on a clip | move it, or trim from either end |
| one finger on empty lane | drag to pan; a tap that never moved scrubs |
| two fingers | pinch to zoom, drag to pan, and scroll the lanes |

The empty-lane case is the one that differs from the desktop, where an empty
click just scrubs. On a touch screen there is no wheel and no scrollbar, so
dragging the background has to be how you get around — and a press that never
moves is still a scrub, so nothing is lost.

A pinch anchors the time that was under the midpoint when it started, so the
sequence grows around the fingers rather than around the left edge. A second
finger arriving mid-gesture must not leave half an edit behind, so `cancelDrag()`
rewinds an untouched scrub and drops an unfinished clip drag before the pinch
takes over. Trim handles grow to 20px on touch but never take more than a third
of a clip, or a short clip would be all handle and impossible to move.

**Split, duplicate and delete are on screen, not just on the keyboard.** They
were shortcuts only, which put the three things you do to a whole clip out of
reach of the device this tool is most likely to be used on. They now sit
directly under the clip's name in the inspector, where the clip is, rather than
under the fields describing its contents. Split disables itself, with a reason
in its tooltip, when the playhead is outside the clip.

**A popup inside a scrolling ancestor is a clipped popup.** The tool bar got
`overflow-x:auto` so it could never wrap and steal a row from the preview — and
that made it a clipping context, which cut the Add menu off two pixels below its
own button and made every item untappable. `placePop()` moves the menu to
`<body>` before measuring it, the same fix and the same reason as the card
page's own popups.

**Dragging a file in is a desktop gesture.** It was the only prominent route to
loading gameplay, and it does not exist on a phone. The Media tab now carries the
same picker the tool bar uses, next to the list it fills, and the copy follows
the device — `hover:none` rather than screen width, because a small window on a
laptop still has a mouse and a file system to drag from.

The timeline's own metrics follow the viewport rather than being fixed: a 70px
label gutter and 30px lanes are right for a mouse and useless for a thumb. `GUT`
is read by a dozen call sites, so it is refreshed once at the top of every draw
instead of being threaded through all of them. The optional lanes — V3, V4,
Music, Beats — are hidden on a phone while they are empty, because nine lanes at
thumb size is most of the screen and four of them are usually unused. They come
back the moment a clip lands on one.

`--vh` tracking is duplicated here rather than imported: `state.js` owns the card
editor's keyboard handling and pulls its whole UI in behind it, and all the
studio needs is the height.

**Timing is seconds, not frames.** A sequence outlives the frame rate it was
pasted at, so clip times are seconds everywhere and only become frames at the
edges — the ruler and the encoder. Animation *lengths* are the exception and are
counted in frames, so retiming a clip never stretches its entrance.

## Export

### Studio

| Format | Use |
|---|---|
| MP4 · H.264 + AAC | Upload. 4K30 at 45 Mb/s by default; the voiceover is mixed in |
| PNG frames + WAV (zip) | Any browser without a `VideoEncoder`. Import frame `_00000` with **Image Sequence** ticked and drop the WAV at 00:00 |

MP4 export needs WebCodecs — Chrome, Edge or a recent Safari. The panel says so
when the browser cannot do it, and frames remain a complete route to the same
result.

### Quote Slate

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

### Studio

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `←` `→` | Step one frame (`Shift` for ten) |
| `Home` `End` | First / last frame |
| `S` | Split the selected clip — or the plate — at the playhead |
| `⌘D` / `Ctrl+D` | Duplicate the selected clip |
| `Delete` | Remove the selected clip |
| `F` | Fit the whole sequence in the timeline |
| `+` `−` | Zoom the timeline (`⌘`/`Ctrl` + wheel zooms around the pointer) |
| `⌘Z` / `Ctrl+Z` | Undo (`Shift` to redo) |
| `⌘⏎` / `Ctrl+⏎` | Export |

Hold `Shift` while dragging a clip to ignore snapping. Split, duplicate and
delete are also buttons on the selected clip, so none of this is keyboard-only.

On a touch screen: pinch the timeline to zoom, drag an empty lane to pan, tap a
clip to edit it, and tap the tab you are already on to put the sheet back down.

### Quote Slate

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
