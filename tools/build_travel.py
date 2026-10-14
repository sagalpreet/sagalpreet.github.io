#!/usr/bin/env python3
"""
build_travel.py — regenerate trips/index.json from the Markdown.

Run this after adding or editing a trip or a place:

    python3 tools/build_travel.py

It reads two folders and writes one file. The Markdown is the only source of
truth — unlike the blog there is no array to keep in step by hand.

    trips/<slug>/index.md    a dated trip: several places in order, a memoir
    places/<slug>/index.md   one standing location: no date, no itinerary

A TRIP is somewhere you went on a particular occasion, and its places are drawn
joined in the order you list them:

    ---
    title: Ladakh by Road
    date: 2025-06-10
    cover: hunder.jpg
    summary: One line for the trip card.
    places:
      - Leh, India | 34.1526, 77.5771
      - Nubra Valley, India | 34.6868, 77.5619
    photos:
      - hunder.jpg | Sand dunes at Hunder
    ---

A PLACE is somewhere not tied to a single occasion. Either a `haunt`, a town you
keep going back to or have lived in, or a `recommendation`, a specific spot you
liked enough to send someone else to: a restaurant, a cafe, a viewpoint. Both are
places you have been; a recommendation is a verdict on one, not a wish list. A
haunt is usually a town, a recommendation usually something inside one:

    ---
    name: Nani's house, Phagwara
    kind: haunt              # haunt | recommendation
    at: 31.2200, 75.7700
    ---

Both kinds can sit at the same coordinates, and the same place can appear in any
number of trips. The builder merges everything within ~100 m into a single PIN,
so the map never stacks two markers on the same spot; the page offers a chooser
when a pin carries more than one thing.

`summary` falls back to the first paragraph, `cover` to the first photo, and
`draft: true` keeps an entry off the map.

Standard library only — no dependencies, no build toolchain.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRIPS_DIR = ROOT / "trips"
PLACES_DIR = ROOT / "places"

FRONT_MATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.S)
LIST_KEYS = {"places", "photos"}
PLACE_KINDS = {"haunt", "recommendation"}

# Coordinates are merged at 3 decimal places, roughly 100 m at the equator.
MERGE_DP = 3


def parse_front_matter(text: str) -> tuple[dict, str]:
    """Like the blog's parser, but `places:` and `photos:` may be "- " lists."""
    match = FRONT_MATTER.match(text)
    if not match:
        return {}, text
    meta: dict = {}
    current: str | None = None
    for line in match.group(1).splitlines():
        if not line.strip():
            continue
        stripped = line.strip()
        if current and stripped.startswith("- "):
            meta[current].append(stripped[2:].strip())
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip().strip("\"'")
        if key in LIST_KEYS and not value:
            meta[key] = []
            current = key
        else:
            meta[key] = value
            current = None
    return meta, text[match.end():]


def read_coords(raw: str, where: str) -> tuple[float, float] | None:
    parts = [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]
    if len(parts) != 2:
        print(f"  {where}: could not read coordinates from {raw!r}", file=sys.stderr)
        return None
    try:
        lat, lon = float(parts[0]), float(parts[1])
    except ValueError:
        print(f"  {where}: coordinates are not numbers in {raw!r}", file=sys.stderr)
        return None
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        print(f"  {where}: {lat},{lon} is off the globe", file=sys.stderr)
        return None
    return lat, lon


def parse_place_line(raw: str, where: str) -> dict | None:
    """"Leh, India | 34.1526, 77.5771" -> {name, lat, lon}"""
    if "|" not in raw:
        print(f"  {where}: place needs a 'Name | lat, lon' form, got {raw!r}", file=sys.stderr)
        return None
    name, _, coords = raw.partition("|")
    got = read_coords(coords, where)
    if not got:
        return None
    return {"name": name.strip(), "lat": got[0], "lon": got[1]}


def parse_photo(raw: str) -> dict:
    src, _, caption = raw.partition("|")
    return {"src": src.strip(), "caption": caption.strip()}


def check_photos(photos: list[dict], folder: Path, where: str) -> None:
    for photo in photos:
        if not (folder / photo["src"]).exists():
            print(f"  {where}: photo not found: {photo['src']}", file=sys.stderr)


def summarise(body: str, limit: int = 180) -> str:
    for para in body.split("\n\n"):
        clean = para.strip()
        if not clean or clean.startswith(("#", "---", "|", "```", ">", "!")):
            continue
        clean = re.sub(r"[*_`]", "", clean)
        clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", clean)
        clean = " ".join(clean.split())
        return clean if len(clean) <= limit else clean[:limit].rsplit(" ", 1)[0] + "…"
    return ""


def is_draft(meta: dict) -> bool:
    return str(meta.get("draft", "")).lower() in ("true", "yes", "1")


def collect_trips() -> list[dict]:
    trips = []
    if not TRIPS_DIR.is_dir():
        return trips
    for md_file in sorted(TRIPS_DIR.glob("*/index.md")):
        slug = md_file.parent.name
        meta, body = parse_front_matter(md_file.read_text(encoding="utf-8"))
        if is_draft(meta):
            print(f"  skipping draft trip: {slug}")
            continue

        places = [p for p in (parse_place_line(r, f"trips/{slug}") for r in meta.get("places", [])) if p]
        if not places:
            print(f"  trips/{slug}: no usable places, so it gets no pins", file=sys.stderr)

        photos = [p for p in (parse_photo(r) for r in meta.get("photos", [])) if p["src"]]
        check_photos(photos, md_file.parent, f"trips/{slug}")

        cover = meta.get("cover") or (photos[0]["src"] if photos else "")
        if cover and not (md_file.parent / cover).exists():
            print(f"  trips/{slug}: cover not found: {cover}", file=sys.stderr)

        trips.append({
            "slug": slug,
            "title": meta.get("title") or slug.replace("-", " ").title(),
            "date": meta.get("date", ""),
            "summary": meta.get("summary") or summarise(body),
            "cover": cover,
            "places": places,
            "photos": photos,
        })
    trips.sort(key=lambda t: (t["date"], t["slug"]), reverse=True)
    return trips


def collect_places() -> list[dict]:
    places = []
    if not PLACES_DIR.is_dir():
        return places
    for md_file in sorted(PLACES_DIR.glob("*/index.md")):
        slug = md_file.parent.name
        meta, body = parse_front_matter(md_file.read_text(encoding="utf-8"))
        if is_draft(meta):
            print(f"  skipping draft place: {slug}")
            continue

        kind = (meta.get("kind") or "haunt").strip().lower()
        if kind not in PLACE_KINDS:
            print(f"  places/{slug}: unknown kind {kind!r}, treating as 'haunt' "
                  f"(expected one of {', '.join(sorted(PLACE_KINDS))})", file=sys.stderr)
            kind = "haunt"

        got = read_coords(meta.get("at", ""), f"places/{slug}")
        if not got:
            print(f"  places/{slug}: skipped, it needs an 'at: lat, lon'", file=sys.stderr)
            continue

        photos = [p for p in (parse_photo(r) for r in meta.get("photos", [])) if p["src"]]
        check_photos(photos, md_file.parent, f"places/{slug}")

        cover = meta.get("cover") or (photos[0]["src"] if photos else "")
        if cover and not (md_file.parent / cover).exists():
            print(f"  places/{slug}: cover not found: {cover}", file=sys.stderr)

        places.append({
            "slug": slug,
            "name": meta.get("name") or slug.replace("-", " ").title(),
            "kind": kind,
            "lat": got[0],
            "lon": got[1],
            "summary": meta.get("summary") or summarise(body),
            "cover": cover,
            "photos": photos,
        })
    places.sort(key=lambda p: p["name"].lower())
    return places


def build_pins(trips: list[dict], places: list[dict]) -> list[dict]:
    """One pin per location, carrying everything that happens to be there."""
    pins: dict[tuple[float, float], dict] = {}

    def pin_at(lat: float, lon: float, name: str) -> dict:
        key = (round(lat, MERGE_DP), round(lon, MERGE_DP))
        if key not in pins:
            pins[key] = {
                "id": f"{key[0]:.{MERGE_DP}f},{key[1]:.{MERGE_DP}f}",
                "name": name,
                "lat": key[0],
                "lon": key[1],
                "items": [],
            }
        return pins[key]

    for trip in trips:
        for place in trip["places"]:
            pin = pin_at(place["lat"], place["lon"], place["name"])
            pin["items"].append({
                "type": "trip",
                "slug": trip["slug"],
                "title": trip["title"],
                "date": trip["date"],
                "placeName": place["name"],
            })

    for place in places:
        pin = pin_at(place["lat"], place["lon"], place["name"])
        # A named place is the better label for a shared pin than a trip's stop.
        pin["name"] = place["name"]
        pin["items"].append({
            "type": "place",
            "slug": place["slug"],
            "title": place["name"],
            "kind": place["kind"],
        })

    out = []
    for pin in pins.values():
        kinds = {i["kind"] if i["type"] == "place" else "trip" for i in pin["items"]}
        # Shape says what sort of place it is, colour flags a recommendation.
        shape = "trip" if "trip" in kinds else ("haunt" if "haunt" in kinds else "recommendation")
        pin["shape"] = shape
        pin["recommended"] = "recommendation" in kinds
        pin["visits"] = sum(1 for i in pin["items"] if i["type"] == "trip")
        out.append(pin)

    out.sort(key=lambda p: (-len(p["items"]), p["name"].lower()))
    return out


def main() -> int:
    if not TRIPS_DIR.is_dir() and not PLACES_DIR.is_dir():
        print(f"Neither {TRIPS_DIR} nor {PLACES_DIR} exists", file=sys.stderr)
        return 1
    print("Building travel data…")
    trips = collect_trips()
    places = collect_places()
    pins = build_pins(trips, places)

    TRIPS_DIR.mkdir(parents=True, exist_ok=True)
    out = TRIPS_DIR / "index.json"
    # No build timestamp: re-running with nothing changed must produce no diff.
    out.write_text(
        json.dumps({"trips": trips, "places": places, "pins": pins},
                   indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    shared = sum(1 for p in pins if len(p["items"]) > 1)
    print(f"  wrote {out.relative_to(ROOT)} "
          f"({len(trips)} trips, {len(places)} places, {len(pins)} pins"
          + (f", {shared} shared" if shared else "") + ")")
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
