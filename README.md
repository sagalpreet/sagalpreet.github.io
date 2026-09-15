# sagalpreet.github.io

Personal website, blog and utilities for Sagalpreet Singh.

Static files, no build tooling, no framework, no CDN. GitHub Pages serves the
repository as-is; the only script you ever need to run is the blog indexer below.

```
├── index.html              home
├── blog.html               blog shell (index + post reader)
├── feed.xml                RSS 2.0 — generated
├── posts/
│   ├── index.json          post list — generated
│   ├── reads.json          recommended reads — hand-maintained
│   └── <slug>/index.md     one folder per post, assets alongside
├── projects/               the utilities, one folder each
├── assets/
│   ├── css/                site.css · prose.css · app.css · hljs.css
│   ├── js/                 site.js · blog.js
│   ├── fonts/              self-hosted, subset
│   └── vendor/             showdown · highlight.js · KaTeX
└── tools/build_blog.py     regenerates posts/index.json and feed.xml
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
tags: reinforcement-learning, theory
---

## Introduction

Body text. **Bold**, *italic*, [links](https://example.com), footnotes, the usual.
```

`description` and `readtime` are optional — the indexer derives them from the post
if you leave them out. Add `draft: true` to keep a post out of the index and feed
while you work on it (the URL still renders if you know it).

**3. Reference assets relative to `index.md`.** The engine rewrites them:

| You write                     | Resolves to                          |
|:------------------------------|:-------------------------------------|
| `![img](figure.png)`          | `/posts/my-new-post/figure.png`      |
| `[pdf](paper.pdf)`            | `/posts/my-new-post/paper.pdf`       |
| `![img](https://…/photo.jpg)` | unchanged                            |

Alt text becomes the figure caption, so write it as one.

**4. Regenerate the index and feed:**

```bash
python3 tools/build_blog.py
```

Standard library only. It reads every post's front matter, sorts newest first, and
writes `posts/index.json` and `feed.xml`. Forget this step and the post renders at
its URL but never appears on the index.

**5. Preview locally.** A server is required — `fetch()` won't read `file://`.

```bash
python3 -m http.server 8765
# http://localhost:8765/blog.html?post=my-new-post
```

**6. `git push`.** That's the deploy.

### What Markdown gets you

Standard Markdown and GFM tables, fenced code blocks with syntax highlighting,
LaTeX via `$…$` and `$$…$$`, images as captioned figures, task lists, and external
links that open in a new tab. Headings become anchors, and a post with three or
more `##` sections grows a table-of-contents rail on wide screens.

Nothing heavy loads unless a post needs it: the Markdown parser is fetched on
demand, the syntax highlighter only when a post contains a code block, and KaTeX
only when it contains math.

### Recommended reads

The second list on the blog index is `posts/reads.json` — edit it by hand, no
build step.

---

## Adding a utility

Create `projects/<name>/index.html` and add an entry to the `PROJECTS` array at
the bottom of `projects/index.html` (path, emoji mark, name, kind, one-line
description). `kind` groups the card on the index — reuse an existing one or add
it to `ORDER` and `PLURAL`.

Start from any existing project page: they all share the same head block, header
bar and footer, and build their UI out of `assets/css/app.css`
(`.hero`, `.features`, `.steps`, `.panel`, `.workbench`, `.dropzone`, `.seg`).

---

## Design system

`assets/css/site.css` holds the tokens everything else is built from — colours,
type scale, spacing, radii, shadows, motion — defined for light and dark. Dark
mode follows the operating system until a visitor picks a side with the toggle,
which is then remembered in `localStorage`.

**Never hardcode a colour.** Use a token and both themes come for free.

| File          | What it covers                                        |
|:--------------|:------------------------------------------------------|
| `site.css`    | tokens, reset, base type, components, header, footer   |
| `prose.css`   | the blog reading layer                                 |
| `app.css`     | patterns for `/projects` pages and tool interfaces     |
| `hljs.css`    | syntax highlighting, built from the same tokens        |

Fonts are self-hosted and subset to Latin: Inter (variable, 300–700) for the
interface, Source Serif 4 for blog prose, JetBrains Mono for code. Icons are
inline SVG. There are no third-party requests apart from Google Analytics and,
on three of the utilities, the libraries they genuinely need (cropperjs, pdf.js,
pdf-lib, jsPDF).

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
- [Inter](https://rsms.me/inter/), [Source Serif 4](https://github.com/adobe-fonts/source-serif)
  and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (OFL); vendored licences
  are in `assets/fonts/`.
