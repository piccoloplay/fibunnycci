#!/usr/bin/env python3
"""
generate_collision_mask.py — auto-build a black-and-white collision
mask from a top-down pixel-art map.

Heuristic: walkable pixels are bright green (grass), tan (dirt path),
light grey (pavement), pale sand, or the reddish tones of the
wooden bridges. Everything else (buildings, water, tree canopies,
fences, rocks, vehicles) becomes a wall.

Morphology: close small holes, open away speckle, then dilate walls
by one pixel so the player cannot slip through diagonal joints.

Usage:
    python tools/generate_collision_mask.py <in.png> <out.png>
"""
from __future__ import annotations
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def build_mask(src_path: Path, out_path: Path) -> None:
    img = Image.open(src_path).convert("RGB")
    rgb = np.array(img, dtype=np.int32)
    hsv = np.array(img.convert("HSV"), dtype=np.int32)
    H = hsv[..., 0] * 360 // 255  # degrees 0..360
    S = hsv[..., 1]
    V = hsv[..., 2]
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    # EXPLICITLY non-walkable (walls) --------------------------------------
    # Blue / cyan water (rivers, ponds, sea). Blue roofs may share this.
    water = (H >= 170) & (H <= 230) & (S >= 70) & (V >= 70)
    # Deep shade / outlines (only truly black pixels)
    deep_shade = V <= 30
    # Dark tree canopies (dark saturated green, low value)
    tree_canopy = (H >= 70) & (H <= 140) & (S >= 120) & (V <= 85)
    # Red-orange roofs (school, red-tile houses) — distinct from cherry pink
    red_roof = ((H <= 15) | (H >= 345)) & (S >= 160) & (V >= 110) & (V <= 200) & (R > B + 50)
    # Dark wood (only quite dark saturated brown/wood)
    dark_wood = (H <= 35) & (V <= 70) & (S >= 120)

    walls = water | deep_shade | tree_canopy | red_roof | dark_wood

    # Anything not explicitly a wall is considered walkable.
    walkable = ~walls

    # Morphology -----------------------------------------------------------
    mask = walkable.astype(np.uint8)
    # Close small gaps inside buildings that are actually walls
    mask = ndimage.binary_opening(mask, iterations=1).astype(np.uint8)
    # Close tiny walkable speckles surrounded by walls (noise)
    mask = ndimage.binary_closing(mask, iterations=1).astype(np.uint8)
    # Thicken walls by 1 px so the player can't slip through corners
    walls_mask = 1 - mask
    walls_mask = ndimage.binary_dilation(walls_mask, iterations=1).astype(np.uint8)
    mask = 1 - walls_mask

    out = (mask * 255).astype(np.uint8)
    Image.fromarray(out, mode="L").save(out_path)
    total = mask.size
    walk = int(mask.sum())
    print(f"{src_path.name}: {walk}/{total} walkable ({100*walk/total:.1f}%) -> {out_path}")


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    build_mask(Path(sys.argv[1]), Path(sys.argv[2]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
