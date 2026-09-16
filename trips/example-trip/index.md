---
title: Example Trip
date: 2026-01-15
summary: A placeholder so the map has something on it — replace or delete this folder.
cover: example-1.png
places:
  - Kapurthala, India | 31.3800, 75.3800
  - Leh, India | 34.1526, 77.5771
  - Pangong Tso, India | 33.7500, 78.9000
photos:
  - example-1.png | Alt text becomes the caption under the photo
  - example-2.png | A second photo, to show how the gallery wraps
---

**This is an example, not a real trip.** It exists so the map renders with
something on it. Delete the whole `trips/example-trip/` folder once you have
written a real one, then re-run `python3 tools/build_travel.py`.

Everything below the front matter is the memoir, and it is ordinary Markdown —
the same engine the blog uses. **Bold**, *italic*, [links](https://example.com),
lists, quotes and headings all work, and links to other sites open in a new tab.

## Sections work too

A trip can cover several places, and this one covers three. They share a single
memoir: the three pins are drawn joined on the map, and clicking any of them
opens this page.

> Block quotes are useful for something a guide said, or a sign you passed.

Photos live in this folder next to `index.md` and are listed in the front
matter, so they appear in the gallery in the order you list them. You can also
drop one into the prose with ordinary Markdown, and the path is rewritten for
you:

![This caption comes from the image's alt text](example-2.png)

To add a trip of your own: make a folder under `trips/`, write an `index.md`
with the front matter above, put the photos beside it, and run the builder.
