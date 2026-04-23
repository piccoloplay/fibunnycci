#!/usr/bin/env python3
"""
split_creature_variants.py — cut a row of N creature variants out of a
single generated sheet and save them as transparent PNGs.

Usage:
    python tools/split_creature_variants.py \
        --image assets/sprites/raw/coniglio_sheet.png \
        --creature coniglio \
        --elements metallo,fuoco,acqua,terra,legno \
        --out assets/sprites/creatures/

Assumptions:
- Sheet has the variants lined up left-to-right on a flat background.
- Background sampled from the top-left pixel (5,5) and chroma-keyed with
  a generous tolerance (± 45 per channel) because GPT's bg varies.
- Each variant gets trimmed to its own bounding box after keying, then
  scaled into a target canvas preserving aspect and bottom-aligning so
  the creature "stands" at the bottom of the tile.
"""
from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path

from PIL import Image


def chroma_key(img: Image.Image, target, tol: int = 45) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    tr, tg, tb = target
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if abs(r - tr) <= tol and abs(g - tg) <= tol and abs(b - tb) <= tol:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def sample_bg(img: Image.Image) -> tuple[int, int, int]:
    rgb = img.convert("RGB")
    samples = [rgb.getpixel((5, 5)), rgb.getpixel((rgb.size[0] - 6, 5)),
               rgb.getpixel((5, rgb.size[1] - 6))]
    r = sum(s[0] for s in samples) // 3
    g = sum(s[1] for s in samples) // 3
    b = sum(s[2] for s in samples) // 3
    return (r, g, b)


def fit_on_canvas(cell: Image.Image, size: int) -> Image.Image:
    bbox = cell.getbbox()
    if bbox:
        cell = cell.crop(bbox)
    scale = min(size / cell.width, size / cell.height)
    nw, nh = max(1, int(cell.width * scale)), max(1, int(cell.height * scale))
    resized = cell.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    paste_x = (size - nw) // 2
    paste_y = size - nh  # bottom-align
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--image", required=True)
    p.add_argument("--creature", required=True, help="base id, e.g. coniglio")
    p.add_argument("--elements", required=True,
                   help="comma-separated list in left→right order, "
                        "e.g. metallo,fuoco,acqua,terra,legno")
    p.add_argument("--size", type=int, default=128,
                   help="output NxN canvas size (default 128)")
    p.add_argument("--tolerance", type=int, default=45,
                   help="chroma tolerance per channel (default 45)")
    p.add_argument("--out", default="assets/sprites/creatures/")
    args = p.parse_args()

    elements = [e.strip() for e in args.elements.split(",") if e.strip()]
    src = Image.open(args.image)
    bg = sample_bg(src)
    print(f"sampled bg RGB: {bg}  tol ±{args.tolerance}")

    W, H = src.size
    cw = W // len(elements)
    print(f"sheet {W}x{H}, slicing into {len(elements)} columns of {cw}x{H}")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    for i, el in enumerate(elements):
        cell = src.crop((i * cw, 0, (i + 1) * cw, H))
        cell = chroma_key(cell, bg, args.tolerance)
        canvas = fit_on_canvas(cell, args.size)
        fname = f"creature_{args.creature}_{el}.png"
        canvas.save(out_dir / fname)
        print(f"  wrote {out_dir / fname}")

    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
