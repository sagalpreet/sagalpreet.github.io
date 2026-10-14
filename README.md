# sagalpreet.github.io

Personal website, blog, utilities and travel map for Sagalpreet Singh.

Static files, no framework. GitHub Pages serves the repository as-is, so nothing
is compiled on deploy; the scripts in `tools/` are run by hand, and only after
adding a post or a trip, or editing the CV. Everything the home page, blog and
travel map need is vendored into the repo — three of the utilities are the
exception and pull their libraries from a CDN.

```
├── index.html              home — bio, news, projects, publications
├── blog.html               blog shell (index + post reader), self-contained CSS
├── blog.js                 the blog engine, and the POSTS / RECOMMENDED_READS lists
├── travel.html             travel shell (map + memoir reader), self-contained CSS
├── travel.js               the travel engine
├── feed.xml                RSS 2.0 — generated
├── .nojekyll               serve the tree as-is, no Jekyll pass
├── posts/
│   └── <slug>/index.md     one folder per post, assets alongside
├── trips/
│   ├── index.json          trips, places and merged pins — generated
│   └── <slug>/index.md     one folder per trip, photos alongside
├── places/
│   └── <slug>/index.md     standing places: haunts and recommendations
├── projects/               the utilities, one folder each, plus their index
├── assets/
│   ├── css/                site.css · app.css   (utilities only)
│   ├── fonts/              self-hosted, subset, with licences
│   ├── vendor/             marked · highlight.js · KaTeX · Bootstrap · jQuery
│   │                       · Popper · Font Awesome
│   ├── world.svg           country outlines for the map — generated
│   └── *.pdf               CV, résumé, posters and slides
├── css/ · fonts/           Academicons, used by the home page and blog
├── images/                 photo, logos, publication thumbnails, icon sources
├── cv/                     LaTeX source for the CV and résumé, plus a
│                           vendored moderncv — see below
├── tools/
│   ├── build_blog.py       regenerates feed.xml
│   ├── build_cv.sh         compiles cv/ into assets/*.pdf
│   ├── build_travel.py     regenerates trips/index.json
│   └── build_worldmap.py   regenerates assets/world.svg (run once)
└── d3/ · nextprot/ · javascript/ · javascripts/
                            older standalone pages, not linked from the site
```

---

## Adding a blog post

**1. Create the folder.** The directory name becomes the URL slug.

```
posts/my-new-post/
  index.md
  figure.png
```

**2. Write `index.md`** with front matter at the very top:

```markdown
---
title: My Post Title
date: 2026-06-25
description: One or two sentences for the index, the tab title and the feed.
tags: rl, theory
readtime: 5 min read
---

## Introduction

Body text. **Bold**, *italic*, [links](https://example.com), the usual.
```

`description` and `readtime` are optional for the feed — `tools/build_blog.py`
derives them from the post if you leave them out. Add `draft: true` to keep a
post out of the feed while you work on it.

**3. Reference assets relative to `index.md`.** The engine rewrites them:

| You write                     | Resolves to                          |
|:------------------------------|:-------------------------------------|
| `![img](figure.png)`          | `/posts/my-new-post/figure.png`      |
| `[pdf](paper.pdf)`            | `/posts/my-new-post/paper.pdf`       |
| `![img](https://…/photo.jpg)` | unchanged                            |

Alt text becomes the figure caption, so write it as one.

**4. Add the post to the `POSTS` array in `blog.js`.** This is the step that is
easy to miss. The blog index renders from that array, not from the Markdown
files — the post will render at its URL without it, but nothing will link to it.

```js
{
  slug: 'my-new-post',
  title: 'My Post Title',
  date: '2026-06-25',
  description: '…',
  tags: ['rl', 'theory'],
  readtime: '5 min read'
}
```

Keep it in step with the front matter; the two are maintained by hand.

**5. Regenerate the feed:**

```bash
python3 tools/build_blog.py
```

Standard library only. It reads every post's front matter, sorts newest first and
writes `feed.xml`. Re-running it with nothing changed produces no diff.

**6. Preview locally.** A server is required — the engine fetches the Markdown
over `fetch()`, which will not read `file://`.

```bash
python3 -m http.server 8765
# http://localhost:8765/blog.html?post=my-new-post
```

**7. `git push`.** That's the deploy.

### What Markdown gets you

Standard Markdown and GFM tables, fenced code blocks with syntax highlighting,
LaTeX via `$…$` and `$$…$$`, images as captioned figures, and external links that
open in a new tab.

`marked`, `highlight.js` and KaTeX are vendored under `assets/vendor/` and loaded
on every blog page, whether or not a given post needs them.

### Recommended reads

The second list on the blog index is the `RECOMMENDED_READS` array in `blog.js`,
next to `POSTS`. Edit it by hand; no build step.

### Tags

Tags are shown on the blog index only — as a filter cloud at the top and on each
entry — not on the post pages themselves. They live in three places that have to
agree: the post's front matter (which feeds `feed.xml` as `<category>`), the
`POSTS` entry, and, for external pieces, `RECOMMENDED_READS`. Keep them short;
the entry row has to fit them on a phone.

---

## Adding a trip or a place

The travel map is `travel.html`. It reads `trips/index.json`, which the builder
writes from the Markdown — unlike the blog there is no array to keep in step.

There are two kinds of entry:

| | Lives in | Is | Drawn as |
|:--|:--|:--|:--|
| **Trip** | `trips/<slug>/` | somewhere you went on a particular occasion | filled dots, joined in order by a dashed route |
| **Haunt** | `places/<slug>/` | somewhere you keep going back to, no single visit | a hollow ring |
| **Recommendation** | `places/<slug>/` | a specific spot you liked and would send someone to: a restaurant, a cafe, a viewpoint | a warm amber diamond |

All three are places you have **been**. A recommendation is a positive review of
somewhere you went, not a list of places you hope to visit, so it is normal for
one to sit inside a city you have already written a trip about.

Trips and haunts are usually towns or cities. A recommendation is finer grained
than that: pin the restaurant, not the neighbourhood. Those pins will sit almost
on top of the city pin at full zoom and separate as you zoom in, which is what
the zoom is for.

### A trip

```
trips/ladakh-by-road/
  index.md
  hunder.jpg
```

```markdown
---
title: Ladakh by Road
date: 2025-06-10
summary: One line for the trip card.
cover: hunder.jpg
places:
  - Leh, India | 34.1526, 77.5771
  - Nubra Valley, India | 34.6868, 77.5619
photos:
  - hunder.jpg | Sand dunes at Hunder
---

The memoir, in Markdown, exactly like a blog post.
```

A place is `Name | latitude, longitude`; the order you list them is the order
the route line joins them. A photo is `file | caption`.

### A place

```markdown
---
name: Nani's house, Phagwara
kind: haunt              # haunt | recommendation
at: 31.2200, 75.7700
---

Whatever you want to say about the place in general.
```

For both, `summary` falls back to the first paragraph, `cover` to the first
photo, and `draft: true` keeps the entry off the map.

### Then regenerate

```bash
python3 tools/build_travel.py
```

It warns about coordinates it cannot read, coordinates off the globe, unknown
`kind` values, and photos named in the front matter that are not in the folder.
Re-running it with nothing changed produces no diff.

### One pin per location

The same place can appear in any number of trips, and a haunt or a
recommendation can sit at the same coordinates as a trip stop. Rather than
stacking markers — where the lower one is unclickable and effectively invisible
— the builder **merges everything within about 100 m into a single pin** and
records what is attached to it. Click a pin carrying more than one entry and the
page offers a chooser.

A merged pin takes its *shape* from what it is (trip beats haunt beats
recommendation) and its *colour* from whether anything there is recommended, so
somewhere you went on a trip and also vouch for still reads as recommended.

### The map

`assets/world.svg` is generated by `tools/build_worldmap.py` from Natural
Earth's public-domain 110m boundaries, and committed. There is no tile server
and no third-party request; it is plain country outlines coloured by the page's
own tokens. You should not need to run that builder again.

Pins are placed with an equirectangular projection that **must match** the one
the SVG was drawn with:

```
x = (lon + 180) * (1000 / 360)
y = (90  - lat) * (500  / 180)
```

It lives in both `tools/build_worldmap.py` and `travel.js`. Change one and the
pins drift off the coastlines.

The map pans and zooms by rewriting the SVG `viewBox` — no library, no tiles.
Pins are drawn at unit size and counter-scaled by the inverse of the zoom, so
they stay the same size on screen however far in you go; borders and route lines
use `vector-effect: non-scaling-stroke` for the same reason. Each pin's visible
dot is about 6px with a much larger transparent disc behind it taking the
clicks, so the markers can stay small without becoming hard to tap.

Controls: drag to pan, the `+` / `−` / reset buttons, double-click to zoom in
(shift-double-click out), ⌘/Ctrl + scroll, and pinch on touch. A plain scroll
wheel is deliberately left alone so the page can still be scrolled past the map.
On touch the map only captures gestures once zoomed in; at the default view a
finger scrolls the page as usual. Pins are keyboard reachable, and opening one
sets `travel.html?trip=<slug>` or `?place=<slug>` so the link can be shared.

There is no marker clustering yet. With zoom and pan in place it may not be
needed; if the pins do get crowded, the next step would be to merge pins closer
than ~20 screen pixels into a counted badge that splits as you zoom in.

---

## Updating the CV and résumé

`assets/Sagalpreet-CV.pdf` and `assets/Sagalpreet-Resume.pdf` are built from
LaTeX in `cv/`, not edited as PDFs. GitHub Pages does not run LaTeX, so the
built PDFs are committed alongside their source. Edit the `.tex`, then:

```sh
./tools/build_cv.sh            # both
./tools/build_cv.sh resume     # just one
```

Two things are load-bearing, and both are handled by the script:

- `cv/` vendors **moderncv v1.2.0** (2012). TeX Live ships v2.3.1, which is a
  different class and silently changes the layout, so the script puts `cv/`
  ahead on `TEXINPUTS`.
- pdfTeX stamps the build time into the PDF, which would make every rebuild a
  diff even with no edits. The script pins `SOURCE_DATE_EPOCH` to the `.tex`
  file's own mtime, so an unchanged source rebuilds byte-identically.

Aux files land in `cv/.build/`, which is gitignored. The résumé is deliberately
held to **one page**; check `pdfinfo` after editing it.

Inside `\cvitem`, the hint column accepts `\\` but the content column does not —
it is interpolated inside braces, so `\\` reads as the tabular row break and the
build fails. Use `\newline` there.

---

## Adding a utility

Create `projects/<name>/index.html` and add an entry to the `PROJECTS` array near
the bottom of `projects/index.html`:

```js
{ path: 'my_tool', mark: '🔧', name: 'My Tool', kind: 'Web tool',
  desc: 'One line, shown on the card.' }
```

`kind` groups the card on the index — reuse an existing one or add it to `ORDER`
and `PLURAL` alongside the array.

Start from any existing project page: they all share the same head block, header
bar and footer, and build their UI out of `assets/css/app.css` (`.hero`,
`.features`, `.steps`, `.panel`, `.workbench`, `.dropzone`, `.seg`).

---

## Design system

`assets/css/site.css` holds the tokens the utilities are built from — colours,
type scale, spacing, radii, shadows, motion. `app.css` adds the patterns for the
tool interfaces themselves.

**Never hardcode a colour.** Use a token.

| File        | What it covers                                     |
|:------------|:---------------------------------------------------|
| `site.css`  | tokens, reset, base type, components, bar, footer   |
| `app.css`   | patterns for `/projects` pages and tool interfaces  |

There is no dark mode — it was removed so the utilities match the rest of the
site, and the toggle is hidden.

The home page, the blog and the travel map do **not** use these stylesheets.
`index.html`, `blog.html` and `travel.html` each carry their own `<style>` block
with their own variables (`--color-link`, `--color-border`, …), which is why a
change to `site.css` will not reach them. `blog.html` and `travel.html` carry the
same bar and footer rules under different class names — `.blog-nav`/`.blog-foot`
and `.page-nav`/`.page-foot` — so a change to one wants the same change in the
other.

Fonts are self-hosted and subset to Latin, and shared by all three: **Roboto**
for interface text, **Inter** for headings and blog prose, **JetBrains Mono** for
code and tags. Declared once in `assets/fonts/fonts.css`.

Icons are inline SVG on the utilities; the home page and blog use Font Awesome
and Academicons, both vendored.

### Third-party requests

Not many, but not zero:

- Google Analytics, on the home page, the blog and the utilities index
- a ClustrMaps visit-tracker image on the home page
- `pdf.js` + `pdf-lib` (PDF Text Editor), `cropperjs` (Image Tools), `cropperjs` +
  `jsPDF` (Passport Photos) — from cdnjs and unpkg
- radio streams in the Pomodoro timer, and the calendar `.ics` for Nanakshahi
  Calendar, served from githack

---

## Note on `/projects`

The utilities live in this repository now. If the separate
[`sagalpreet/projects`](https://github.com/sagalpreet/projects) repository still
has GitHub Pages enabled, **it takes precedence** at `sagalpreet.github.io/projects`
and will shadow this folder. Turn Pages off there for the version in this repo to
go live.

---

## Acknowledgements

- [Sebastin Santy](http://sebastinsanty.com/) for the original
  [template](https://github.com/SebastinSanty/minimal-research-theme).
- [Lakshay A Agrawal](https://github.com/LakshyAAAgrawal) for updates to it.
- [Inter](https://rsms.me/inter/), [Roboto](https://fonts.google.com/specimen/Roboto)
  and [JetBrains Mono](https://www.jetbrains.com/lp/mono/); vendored licences are
  in `assets/fonts/`.
- [Natural Earth](https://www.naturalearthdata.com/) for the country boundaries
  behind `assets/world.svg`, public domain, via
  [world-atlas](https://github.com/topojson/world-atlas).
