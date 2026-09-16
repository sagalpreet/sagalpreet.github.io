#!/usr/bin/env python3
"""
build_worldmap.py — generate assets/world.svg, the backdrop for travel.html.

    python3 tools/build_worldmap.py

Source is Natural Earth's 110m country boundaries, which are public domain,
packaged as TopoJSON by the `world-atlas` project. The file is downloaded once
into tools/ and cached; delete it to re-fetch.

The output is a plain SVG of country outlines in an equirectangular projection,
committed to the repo. travel.js inlines it and drops pins on top using the same
projection, so keep these two in step:

    x = (lon + 180) * (WIDTH / 360)
    y = (90  - lat) * (WIDTH / 2 / 180)

Antarctica is dropped and the viewBox is cropped to +84°..-60°, which is every
latitude anyone takes a holiday in and saves a third of the height.

Standard library only.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / "countries-110m.json"
OUT = ROOT / "assets" / "world.svg"

SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json"

WIDTH = 1000.0
HEIGHT = WIDTH / 2          # full -90..90 height before cropping
LAT_TOP, LAT_BOTTOM = 84.0, -60.0
PRECISION = 1               # decimal places kept in path data
SKIP = {"Antarctica"}


def project(lon: float, lat: float) -> tuple[float, float]:
    return (lon + 180.0) * (WIDTH / 360.0), (90.0 - lat) * (HEIGHT / 180.0)


def decode_arcs(topo: dict) -> list[list[tuple[float, float]]]:
    """Undo TopoJSON delta encoding and quantisation, once, for every arc."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append(project(x * sx + tx, y * sy + ty))
        out.append(points)
    return out


def ring_points(indices: list[int], arcs: list) -> list[tuple[float, float]]:
    """A ring is a run of arc indices; a negative index means that arc reversed."""
    pts: list[tuple[float, float]] = []
    for idx in indices:
        seg = arcs[~idx][::-1] if idx < 0 else arcs[idx]
        pts.extend(seg[1:] if pts else seg)
    return pts


def ring_to_path(pts: list[tuple[float, float]]) -> str:
    out, last = [], None
    for x, y in pts:
        xy = (round(x, PRECISION), round(y, PRECISION))
        if xy == last:            # drop points that collapse at this precision
            continue
        out.append(xy)
        last = xy
    if len(out) < 3:
        return ""

    # Russia, Fiji and the Aleutians straddle the antimeridian. In an
    # equirectangular projection their coordinates jump the full width of the
    # map, which would otherwise draw a stripe right across it. Break the path
    # at any such jump and start a new subpath instead.
    d, prev = [], None
    for x, y in out:
        if prev is None or abs(x - prev[0]) > WIDTH / 2:
            d.append(f"M{x} {y}")
        else:
            d.append(f"L{x} {y}")
        prev = (x, y)
    return "".join(d) + "Z"


def main() -> int:
    if not CACHE.exists():
        print(f"Downloading {SOURCE}")
        try:
            urllib.request.urlretrieve(SOURCE, CACHE)
        except Exception as exc:
            print(f"Could not download the source: {exc}", file=sys.stderr)
            return 1
    topo = json.loads(CACHE.read_text())
    arcs = decode_arcs(topo)

    paths, skipped = [], 0
    for geom in topo["objects"]["countries"]["geometries"]:
        name = (geom.get("properties") or {}).get("name", "")
        if name in SKIP:
            skipped += 1
            continue
        if geom["type"] == "Polygon":
            rings = geom["arcs"]
        elif geom["type"] == "MultiPolygon":
            rings = [r for poly in geom["arcs"] for r in poly]
        else:
            continue
        d = "".join(ring_to_path(ring_points(r, arcs)) for r in rings)
        if d:
            esc = name.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
            paths.append(f'<path data-name="{esc}" d="{d}"/>')

    top, bottom = project(0, LAT_TOP)[1], project(0, LAT_BOTTOM)[1]
    view = f"0 {top:g} {WIDTH:g} {bottom - top:g}"

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" '
        f'class="world" role="img" aria-label="World map">\n'
        f'<g class="world__land">\n' + "\n".join(paths) + "\n</g>\n</svg>\n"
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(svg, encoding="utf-8")
    print(f"  wrote {OUT.relative_to(ROOT)} "
          f"({len(paths)} countries, {skipped} skipped, {len(svg) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
