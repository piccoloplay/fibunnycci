#!/usr/bin/env python3
"""
split_tileset.py — cut a GPT-generated tileset / spritesheet into
individual PNG tiles for FiBunnyCci.

Two modes:

1. UNIFORM GRID
   python tools/split_tileset.py --image sheet.png --grid 4 4 \
       --names tools/names.txt --out assets/tiles/urban/

   Splits the image into COLS x ROWS equal cells. Names are read,
   one per line, in left-to-right top-to-bottom order.

2. MANUAL BOUNDING BOXES (for non-uniform grids, GPT output fits this)
   python tools/split_tileset.py --image sheet.png \
       --boxes tools/urban_boxes.json --out assets/tiles/urban/

   JSON format: a list of { "name": "grass", "x": 0, "y": 0, "w": 256, "h": 256 }

Optional flags:
  --resize N        downscale each output to N x N (nearest neighbour, pixel-perfect)
  --chroma HEX      replace the given hex colour (e.g. ff00ff) with transparency
  --trim            trim transparent / chroma border around each output
  --out DIR         output directory (default: ./out)

Dependencies: Pillow. Install with `pip install Pillow`.
"""

from __future__ import annotations
import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image


def parse_hex(h: str) -> tuple[int, int, int]:
    h = h.strip().lstrip("#")
    if len(h) != 6:
        raise ValueError(f"chroma must be 6 hex digits, got '{h}'")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def apply_chroma(img: Image.Image, colour: tuple[int, int, int], tolerance: int = 12) -> Image.Image:
    """Replace pixels close to `colour` with transparent."""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    tr, tg, tb = colour
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if abs(r - tr) <= tolerance and abs(g - tg) <= tolerance and abs(b - tb) <= tolerance:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def trim_empty(img: Image.Image) -> Image.Image:
    """Trim fully transparent rows/columns from the borders."""
    rgba = img.convert("RGBA")
    bbox = rgba.getbbox()
    return rgba.crop(bbox) if bbox else rgba


def resize_nearest(img: Image.Image, target: int) -> Image.Image:
    return img.resize((target, target), Image.NEAREST)


def load_names(path: str, expected: int) -> list[str]:
    lines = [line.strip() for line in Path(path).read_text(encoding="utf-8").splitlines()]
    names = [ln for ln in lines if ln and not ln.startswith("#")]
    if len(names) < expected:
        raise ValueError(f"names file has {len(names)} entries, need {expected}")
    return names[:expected]


def slug(name: str) -> str:
    keep = []
    for ch in name.lower().strip():
        if ch.isalnum():
            keep.append(ch)
        elif ch in " -_/":
            keep.append("_")
    s = "".join(keep).strip("_")
    while "__" in s:
        s = s.replace("__", "_")
    return s or "tile"


def export_cell(src: Image.Image, box: tuple[int, int, int, int], name: str,
                out_dir: Path, args) -> Path:
    x, y, w, h = box
    cell = src.crop((x, y, x + w, y + h))
    if args.chroma:
        cell = apply_chroma(cell, parse_hex(args.chroma))
    if args.trim:
        cell = trim_empty(cell)
    if args.resize:
        cell = resize_nearest(cell, args.resize)
    out_path = out_dir / f"{slug(name)}.png"
    cell.save(out_path, "PNG")
    return out_path


def run_grid(args) -> None:
    src = Image.open(args.image)
    W, H = src.size
    cols, rows = args.grid
    if W % cols != 0 or H % rows != 0:
        print(f"warning: image {W}x{H} is not evenly divisible by {cols}x{rows}. "
              f"Cell will be cropped to {W // cols}x{H // rows}.", file=sys.stderr)
    cw, ch = W // cols, H // rows

    if args.names:
        names = load_names(args.names, cols * rows)
    else:
        names = [f"tile_{i:02d}" for i in range(cols * rows)]

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    for r in range(rows):
        for c in range(cols):
            idx = r * cols + c
            path = export_cell(src, (c * cw, r * ch, cw, ch), names[idx], out_dir, args)
            print(f"  wrote {path}")


def run_boxes(args) -> None:
    src = Image.open(args.image)
    data = json.loads(Path(args.boxes).read_text(encoding="utf-8"))
    if isinstance(data, dict) and "tiles" in data:
        data = data["tiles"]
    if not isinstance(data, list):
        raise ValueError("boxes JSON must be a list or { tiles: [...] }")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    for entry in data:
        name = entry.get("name") or f"tile_{data.index(entry):02d}"
        box = (int(entry["x"]), int(entry["y"]), int(entry["w"]), int(entry["h"]))
        path = export_cell(src, box, name, out_dir, args)
        print(f"  wrote {path}  from {box}")


def main() -> int:
    p = argparse.ArgumentParser(description="Split a tileset/spritesheet into individual PNG tiles.")
    p.add_argument("--image", required=True, help="Input PNG/JPG")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--grid", nargs=2, type=int, metavar=("COLS", "ROWS"),
                   help="Uniform grid split")
    g.add_argument("--boxes", help="JSON with manual bounding boxes")
    p.add_argument("--names", help="(grid mode) txt with one tile name per line, L-to-R T-to-B")
    p.add_argument("--out", default="./out", help="Output directory (default ./out)")
    p.add_argument("--resize", type=int, help="Downscale each tile to NxN (nearest neighbour)")
    p.add_argument("--chroma", help="Hex colour to make transparent, e.g. ff00ff")
    p.add_argument("--trim", action="store_true", help="Trim fully-transparent borders after cutting")
    args = p.parse_args()

    if args.grid:
        run_grid(args)
    else:
        run_boxes(args)

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
