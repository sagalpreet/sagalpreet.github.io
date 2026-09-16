# sagalpreet.github.io

Personal website, blog and utilities for Sagalpreet Singh.

Static files, no build tooling, no framework. GitHub Pages serves the repository
as-is; the only script you ever need to run is the feed builder below. Everything
the home page and blog need is vendored into the repo — three of the utilities
are the exception and pull their libraries from a CDN.

```
├── index.html              home — bio, news, projects, publications
├── blog.html               blog shell (index + post reader), self-contained CSS
├── blog.js                 the blog engine, and the POSTS / RECOMMENDED_READS lists
├── feed.xml                RSS 2.0 — generated
├── .nojekyll               serve the tree as-is, no Jekyll pass
├── posts/
│   └── <slug>/index.md     one folder per post, assets alongside
├── projects/               the utilities, one folder each, plus their index
├── assets/
│   ├── css/                site.css · app.css   (utilities only)
│   ├── fonts/              self-hosted, subset, with licences
│   ├── vendor/             marked · highlight.js · KaTeX · Bootstrap · jQuery
│   │                       · Popper · Font Awesome
│   └── *.pdf               CV, résumé, posters and slides
├── css/ · fonts/           Academicons, used by the home page and blog
├── images/                 photo, logos, publication thumbnails, icon sources
├── tools/build_blog.py     regenerates feed.xml
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

The home page and the blog do **not** use these stylesheets. `index.html` and
`blog.html` each carry their own `<style>` block with their own variables
(`--color-link`, `--color-border`, …), which is why a change to `site.css` will
not reach them.

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
