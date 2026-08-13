<!-- Generated from assets/js/studio/spec.js — regenerate with:
     node -e "import('./assets/js/studio/spec.js').then(m=>require('fs').writeFileSync('SHOTLIST.md',m.SPEC))"
     so the Copy format spec button and this file can never disagree. -->

# Palm Static — shotlist output format

Write the answer exactly as you do now: Hooks, Script, Visual beats, Packaging,
Fact check, Count. Then add ONE more section at the very end, a fenced
`shotlist` block. Everything above it is for me to read; the block is what I
paste into the studio, so it has to stand on its own.

## The block

```shotlist
TITLE   <the video's working title>
FPS     30
SIZE    2160x3840
ACCENT  #FF5C3A
MEDIA   gameplay=<clip name>, vo=<voiceover file>, <key>=<image file>, ...

SAY   0:00-0:03 | <first spoken line, exactly as written in the script>
...
TEXT  0:03-0:08 | <on-screen words> | slot=upper | anim=rise | blur=on
```

## Rules

- One element per line. A line that starts with `|` continues the line above.
- Times are `m:ss`, `m:ss.ff`, plain seconds, or `90f` for frames.
  Ranges use `-`; `0:03+2` means "start at 3s, run 2s".
- Options are `key=value`, separated by `|`, in any order. Bare text with no
  `=` is the element's own words.
- `#` starts a comment.

## Directives

| Key | Meaning |
|---|---|
| `TITLE` | names the export file |
| `FPS` | 30 unless I say otherwise |
| `SIZE` | `2160x3840` (4K vertical) unless I say otherwise |
| `ACCENT` | one hex colour used by every element that has no colour of its own |
| `CAPTIONS` | `on` burns the SAY lines in as on-screen captions. Default off |
| `MEDIA` | short lowercase keys mapped to the files I will drop in |

## Element types

| Type | Use it for | Its own text is |
|---|---|---|
| `SAY` | one line of the read | the spoken words |
| `TEXT` | a headline, a chyron, on-screen words | the words |
| `STAMP` | one impact word that slams on ("REPORTEDLY") | the word |
| `LIST` | names appearing one at a time | use `items=a; b; c` |
| `LOWER` | a lower third: sources, dates, credits | the line |
| `IMAGE` | a photo, logo or screenshot | use `src=` and `label=` |
| `CARD` | a quote card or a social post | use `design=` and the text |

## Options

- `slot=` center · upper · top · lower · bottom · left · right · top-left ·
  top-right · bottom-left · bottom-right · full
- `x=` `y=` nudge in % of the frame from the slot. `scale=` % overall.
  `size=` % of the element's own type size. `rot=` degrees.
- `anim=` rise · fall · pop · slam · fade · wipe · slide-l · slide-r · none
- `out=` fade · drop · pop-out · wipe-out · slide-l · slide-r · none
- `blur=on|off` blur the gameplay while this is up. `dim=on|off` darken it.
- `color=#RRGGBB` override the accent for this element.
- `src=` a MEDIA key. `label=` a caption under an image. `sub=` a second
  lower-third line. `items=` semicolon-separated. `step=` seconds between
  list items. `hl=` a word inside a TEXT line to paint in the accent colour.
- `design=` for CARD: quote · x-post · x-reply · reddit-post · reddit-comment ·
  yt-comment · ig-post · ig-comment · fb-post · twitch-comment. Add
  `name=` `handle=` `outlet=` as the card needs.

## How to time it

- SAY lines carry the real read. Time them from the word count at the pace the
  Count section assumes — roughly 3 words a second at fast anchor pace — and
  make the last SAY line end at the total in that section.
- **SAY lines must be continuous.** The next line starts when the last one ends.
  Never leave more than about half a second between them: a gap is dead air in
  the finished video, and it is invisible until the voiceover is laid against it.
- Every row of the Visual beats table gets at least one element line, using the
  same times as the table.
- Anything with words to read (TEXT, LIST, CARD, a captioned IMAGE) gets
  `blur=on`. A LOWER third that runs the whole video gets `blur=off dim=off`,
  or the gameplay is blurred for thirty seconds.
- Overlapping elements are fine and stack automatically.

## The rule that matters most: show it *as* I say it

A visual exists so the viewer can see what I am talking about **while I am
talking about it**. It is not an illustration of a thought I have already
finished.

So for anything that has a subject — a person, a company, a screenshot, a post,
a place — work out the SAY line that names it, and:

- **Start the element about 0.3s before that line starts.** The picture should
  already be there when the word lands, not arrive chasing it.
- **Keep it up until that thought is finished** — usually the end of that SAY
  line, often a beat past it. Two to four seconds is normal. Under a second is
  never enough to read a name and look at a face.
- If several things are named in one line, either overlap them or use a LIST.

Concretely, if the read is:

```
SAY 0:00-0:02.3 | Rockstar just followed six people on Instagram.
```

then the Instagram screenshot belongs at `0:00-0:02.6`, not somewhere later:

```
IMAGE 0:00-0:02.6 | src=ig | label=@rockstargames | slot=center | blur=on
```

**A LIST has to be timed the same way.** Set `step` so each item lands as its
name is spoken, and make the clip long enough for the whole build —
`items x step` must fit inside the clip's length, or the last names never
appear on screen at all. If the six names are read across 3.6 seconds, that is
`step=0.6` and a clip at least 3.6s long.

The studio checks all of this on import and lists anything that looks late,
too short, or cut off, so getting it right here saves me the fixing.

## Worked example

```shotlist
TITLE   Rockstar Just Followed 6 People
FPS     30
SIZE    2160x3840
ACCENT  #FF5C3A
MEDIA   gameplay=gta-chase.mp4, vo=ep41-vo.wav, haaland=haaland.jpg, dyer=kent-paul.jpg

SAY   0:00-0:02.5 | Rockstar Games doesn't follow people.
SAY   0:02.5-0:04 | This week, it followed six.
SAY   0:04-0:09 | The account that goes MONTHS without posting just followed six streamers.
SAY   0:09-0:14 | Most of them already have GTA history, so this REPORTEDLY isn't random.
SAY   0:14-0:16 | And it's not just streamers.
SAY   0:16-0:21 | Erling Haaland got a follow, and so did Danny Dyer, the voice of Kent Paul.
SAY   0:21-0:25 | Rockstar hasn't said a damn thing.
SAY   0:25-0:29 | Because apparently, silence IS the announcement.

# each visual starts a beat before the words that name it, and holds through them
LOWER 0:00-0:29 | GTA BOOM · Notebookcheck | slot=bottom | blur=off | dim=off
TEXT  0:00-0:03 | Rockstar's Instagram | slot=upper | anim=fade | blur=on
LIST  0:03-0:09 | slot=center | step=0.6 | blur=on
      | items=Jynxzi; MoistCr1TiKaL; Valkyrae; Fuslie; TimTheTatman; xQc
TEXT  0:08-0:09.5 | days before the GTA 6 Netflix reveal | slot=lower | hl=Netflix | blur=on
STAMP 0:09-0:13 | REPORTEDLY | slot=center | anim=slam
TEXT  0:13-0:16 | NOT JUST STREAMERS | slot=upper | anim=wipe | blur=on
IMAGE 0:15.7-0:19 | src=haaland | label=Erling Haaland | slot=right | blur=on
IMAGE 0:18.7-0:21 | src=dyer | label=Danny Dyer — Kent Paul | slot=left | blur=on
TEXT  0:25-0:29 | silence IS the announcement | slot=center | hl=silence | anim=rise | blur=on
```
