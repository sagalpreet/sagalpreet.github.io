#!/usr/bin/env python3
"""
build_blog.py — regenerate posts/index.json and feed.xml from the Markdown posts.

Run this after adding or editing a post:

    python3 tools/build_blog.py

It reads the front matter of every posts/<slug>/index.md, sorts newest first,
and writes:

    posts/index.json   the list the blog index and pager read
    feed.xml           an RSS 2.0 feed

Standard library only — no dependencies, no build toolchain.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "posts"

SITE_URL = "https://sagalpreet.github.io"
SITE_TITLE = "Sagalpreet Singh — Writing"
SITE_DESC = "Research notes, essays and write-ups by Sagalpreet Singh."
AUTHOR = "Sagalpreet Singh"

WORDS_PER_MINUTE = 220
FRONT_MATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.S)


def parse_front_matter(text: str) -> tuple[dict, str]:
    match = FRONT_MATTER.match(text)
    if not match:
        return {}, text
    meta = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip("\"'")
    return meta, text[match.end():]


def reading_time(body: str) -> str:
    prose = re.sub(r"```.*?```", " ", body, flags=re.S)
    words = len(prose.split())
    return f"{max(1, round(words / WORDS_PER_MINUTE))} min read"


def summarise(body: str, limit: int = 200) -> str:
    for para in body.split("\n\n"):
        clean = para.strip()
        if not clean or clean.startswith(("#", "---", "|", "```", ">", "!")):
            continue
        clean = re.sub(r"[*_`]", "", clean)
        clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", clean)
        clean = " ".join(clean.split())
        return clean if len(clean) <= limit else clean[:limit].rsplit(" ", 1)[0] + "…"
    return ""


def collect() -> list[dict]:
    posts = []
    for md_file in sorted(POSTS_DIR.glob("*/index.md")):
        slug = md_file.parent.name
        raw = md_file.read_text(encoding="utf-8")
        meta, body = parse_front_matter(raw)

        if str(meta.get("draft", "")).lower() in ("true", "yes", "1"):
            print(f"  skipping draft: {slug}")
            continue

        tags = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
        posts.append({
            "slug": slug,
            "title": meta.get("title") or slug.replace("-", " ").title(),
            "date": meta.get("date", ""),
            "description": meta.get("description") or summarise(body),
            "tags": tags,
            "readtime": meta.get("readtime") or reading_time(body),
        })

    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    return posts


def write_index(posts: list[dict]) -> None:
    # No build timestamp: re-running with unchanged posts must produce no diff.
    payload = {"posts": posts}
    out = POSTS_DIR / "index.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  wrote {out.relative_to(ROOT)} ({len(posts)} posts)")


def rfc822(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        dt = datetime.now(timezone.utc)
    return format_datetime(dt)


def write_feed(posts: list[dict]) -> None:
    items = []
    for post in posts:
        link = f"{SITE_URL}/blog.html?post={post['slug']}"
        categories = "".join(
            f"\n      <category>{escape(tag)}</category>" for tag in post["tags"]
        )
        items.append(
            "    <item>\n"
            f"      <title>{escape(post['title'])}</title>\n"
            f"      <link>{escape(link)}</link>\n"
            f"      <guid isPermaLink=\"true\">{escape(link)}</guid>\n"
            f"      <pubDate>{rfc822(post['date'])}</pubDate>\n"
            f"      <description>{escape(post['description'])}</description>"
            f"{categories}\n"
            "    </item>"
        )

    # Derived from the newest post rather than "now", so an unchanged blog
    # regenerates byte-for-byte and doesn't show up as a spurious git diff.
    built = rfc822(posts[0]["date"]) if posts else format_datetime(datetime.now(timezone.utc))
    feed = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "  <channel>\n"
        f"    <title>{escape(SITE_TITLE)}</title>\n"
        f"    <link>{SITE_URL}/blog.html</link>\n"
        f"    <description>{escape(SITE_DESC)}</description>\n"
        "    <language>en-us</language>\n"
        f"    <managingEditor>sagalpreet60@gmail.com ({AUTHOR})</managingEditor>\n"
        f"    <lastBuildDate>{built}</lastBuildDate>\n"
        f'    <atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>\n'
        + "\n".join(items) + "\n"
        "  </channel>\n"
        "</rss>\n"
    )
    out = ROOT / "feed.xml"
    out.write_text(feed, encoding="utf-8")
    print(f"  wrote {out.relative_to(ROOT)}")


def main() -> int:
    if not POSTS_DIR.is_dir():
        print(f"No posts directory at {POSTS_DIR}", file=sys.stderr)
        return 1
    print("Building blog data…")
    posts = collect()
    write_index(posts)
    write_feed(posts)
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
