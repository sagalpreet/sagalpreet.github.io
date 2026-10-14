#!/usr/bin/env bash
# build_cv.sh — compile the LaTeX in cv/ into the PDFs the site links to.
#
#     ./tools/build_cv.sh            # build whatever exists
#     ./tools/build_cv.sh resume     # build just one
#
# GitHub Pages does not run LaTeX, so the built PDFs are committed alongside
# the source. Run this before pushing whenever the .tex changes.
#
# Aux files go to cv/.build/ so they never land next to the source.
set -euo pipefail
cd "$(dirname "$0")/.."

# pdfTeX stamps the build time into the PDF, so an unchanged .tex would still
# produce a new binary and show up as a diff on every run. Pinning the clock to
# the source's own mtime makes a rebuild byte-identical when nothing changed.
export FORCE_SOURCE_DATE=1

command -v latexmk >/dev/null || { echo "latexmk not found (MacTeX / TeX Live)"; exit 1; }

declare -a TARGETS=("resume:Sagalpreet-Resume" "cv:Sagalpreet-CV")
want="${1:-}"
built=0

for pair in "${TARGETS[@]}"; do
    src="${pair%%:*}"; out="${pair##*:}"
    [ -n "$want" ] && [ "$want" != "$src" ] && continue
    [ -f "cv/$src.tex" ] || { [ -n "$want" ] && echo "cv/$src.tex not found" && exit 1; continue; }

    echo "==> $src.tex"
    # cv/ vendors moderncv v1.2.0; TeX Live ships v2.3.1, which is a different
    # class. Without cv/ ahead on TEXINPUTS the build silently picks the newer
    # one and the layout changes. The trailing colon keeps the default paths.
    export TEXINPUTS="./cv:${TEXINPUTS:-}"
    SOURCE_DATE_EPOCH="$(stat -f %m "cv/$src.tex" 2>/dev/null || stat -c %Y "cv/$src.tex")"
    export SOURCE_DATE_EPOCH
    latexmk -pdf -interaction=nonstopmode -halt-on-error \
            -outdir=cv/.build "cv/$src.tex" >/dev/null 2>&1 || {
        echo "    FAILED. Re-running to show the error:"; 
        latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=cv/.build "cv/$src.tex" 2>&1 | tail -30
        exit 1; }

    cp "cv/.build/$src.pdf" "assets/$out.pdf"
    printf "    assets/%s.pdf  (%s)\n" "$out" "$(du -h "assets/$out.pdf" | cut -f1)"
    built=$((built+1))
done

[ "$built" -eq 0 ] && echo "nothing to build" || echo "done: $built file(s)"
