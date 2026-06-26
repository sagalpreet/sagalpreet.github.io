# sagalpreet.github.io

Personal website & blog for Sagalpreet Singh.

## Adding a New Blog Post

### 1. Create the post directory

```
posts/
  my-new-post/          ← slug (used in the URL)
    index.md            ← your Markdown content
    figure.png          ← any images / assets
    diagram.svg
```

The directory name becomes the URL slug:
`https://sagalpreet.github.io/blog.html?post=my-new-post`

### 2. Write `index.md`

Add an optional front-matter block at the very top, then write standard Markdown:

```markdown
---
title: My Post Title
date: 2026-06-25
description: Short summary for browser tab and SEO.
tags: reinforcement-learning, theory
readtime: 5 min read
---

## Introduction

Your content here. **Bold**, *italic*, [links](https://example.com), etc.

### Math (LaTeX via KaTeX)

Inline: $E = mc^2$

Display:

$$
\nabla_\theta \mathcal{L} = -\mathbb{E}\left[\frac{\nabla_\theta p_\theta(x)}{p_\theta(x)}\right]
$$

### Code blocks (syntax highlighted)

\```python
def hello():
    print("Hello, world!")
\```

### Images

![Caption text](figure.png)
```

### 3. Asset path rules

Since `index.md` is fetched and rendered from `blog.html` (at the site root), the engine **automatically rewrites relative paths**. Just reference files relative to your `index.md`:

| You write                    | Resolved to                        |
|:-----------------------------|:-----------------------------------|
| `![img](figure.png)`         | `/posts/my-new-post/figure.png`    |
| `[pdf](paper.pdf)`           | `/posts/my-new-post/paper.pdf`     |
| `![img](sub/chart.svg)`      | `/posts/my-new-post/sub/chart.svg` |
| `![img](https://…/photo.jpg)`| unchanged (absolute URLs are safe) |

### 4. Link from the main page (optional)

Add a link anywhere in `index.html`:

```html
<a class="tag" href="blog.html?post=my-new-post">Blog Post</a>
```

### 5. Test locally

```bash
python3 -m http.server 8765
```

Then open: `http://localhost:8765/blog.html?post=my-new-post`

> **Note:** You must use a local HTTP server. Opening `blog.html` directly
> as a `file://` URL will fail because `fetch()` is blocked by CORS on
> the file:// protocol.

### 6. Deploy

Just `git push` — GitHub Pages serves everything as static files. No build step needed.

---

## Supported Markdown Features

- Standard Markdown (headings, lists, bold, italic, blockquotes, horizontal rules)
- GitHub-Flavored Markdown tables
- Fenced code blocks with syntax highlighting (200+ languages via Highlight.js)
- LaTeX math via KaTeX — inline `$...$` and display `$$...$$`
- Images with automatic `<figcaption>` from alt text
- External links open in new tab automatically

## Tech Stack

All vanilla — zero build step, zero Node.js dependency.

| Library      | CDN                      | Purpose              |
|:-------------|:-------------------------|:---------------------|
| marked.js    | jsdelivr (v12)           | Markdown → HTML      |
| KaTeX        | jsdelivr (v0.16)         | LaTeX math rendering |
| Highlight.js | cdnflare (v11)           | Syntax highlighting  |
| Bootstrap    | stackpath (v4.4)         | Base layout (matches main site) |
| Font Awesome | fontawesome kit          | Icons                |

---

## Acknowledgements

- [Sebastin Santy](http://sebastinsanty.com/) for [template](https://github.com/SebastinSanty/minimal-research-theme).
- [Lakshay A Agrawal](https://github.com/LakshyAAAgrawal) for making updates to the template.
