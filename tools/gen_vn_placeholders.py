#!/usr/bin/env python3
"""
gen_vn_placeholders.py — generate placeholder backgrounds and character
sprites for the visual-novel system, so the VN runtime can be developed
and tested before real art lands.

Backgrounds: 672x860 gradient + big location label.
Sprites:     400x700 colored silhouette + character name + expression,
             bottom-aligned on transparent canvas.

Overwrites any existing PNG in the target directories.
"""
from __future__ import annotations
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BG_DIR = ROOT / "assets" / "vn" / "bg"
SPR_DIR = ROOT / "assets" / "vn" / "sprites"

BG_W, BG_H = 672, 860
SPR_W, SPR_H = 400, 700


def _font(size: int) -> ImageFont.FreeTypeFont:
    for name in ("DejaVuSans-Bold.ttf", "DejaVuSans.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _centered_text(draw: ImageDraw.ImageDraw, xy, text: str,
                   font: ImageFont.ImageFont, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = xy[0] - tw // 2 - bbox[0]
    y = xy[1] - th // 2 - bbox[1]
    # subtle shadow
    draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 180))
    draw.text((x, y), text, font=font, fill=fill)


def make_bg(name: str, label: str, top_rgb, bot_rgb) -> None:
    img = Image.new("RGB", (BG_W, BG_H), top_rgb)
    px = img.load()
    tr, tg, tb = top_rgb
    br, bg_, bb = bot_rgb
    for y in range(BG_H):
        t = y / (BG_H - 1)
        r = int(tr + (br - tr) * t)
        g = int(tg + (bg_ - tg) * t)
        b = int(tb + (bb - tb) * t)
        for x in range(BG_W):
            px[x, y] = (r, g, b)
    draw = ImageDraw.Draw(img)
    # grid lines for "placeholder" feel
    for gx in range(0, BG_W, 64):
        draw.line([(gx, 0), (gx, BG_H)], fill=(255, 255, 255, 20), width=1)
    for gy in range(0, BG_H, 64):
        draw.line([(0, gy), (BG_W, gy)], fill=(255, 255, 255, 20), width=1)
    _centered_text(draw, (BG_W // 2, BG_H // 2 - 30), label,
                   _font(56), (255, 255, 255))
    _centered_text(draw, (BG_W // 2, BG_H // 2 + 40),
                   "— placeholder —", _font(24), (230, 230, 230))
    _centered_text(draw, (BG_W // 2, BG_H - 40), f"bg/{name}.png",
                   _font(18), (200, 200, 200))
    BG_DIR.mkdir(parents=True, exist_ok=True)
    img.save(BG_DIR / f"{name}.png")
    print(f"  wrote bg/{name}.png  ({label})")


def make_sprite(name: str, character: str, expression: str,
                body_rgb, accent_rgb) -> None:
    img = Image.new("RGBA", (SPR_W, SPR_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # head circle
    head_r = 80
    cx = SPR_W // 2
    head_cy = 110
    draw.ellipse([cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r],
                 fill=body_rgb, outline=(0, 0, 0, 255), width=4)
    # body trapezoid
    body_top_y = head_cy + head_r - 10
    body_bot_y = SPR_H - 40
    draw.polygon([
        (cx - 80, body_top_y),
        (cx + 80, body_top_y),
        (cx + 150, body_bot_y),
        (cx - 150, body_bot_y),
    ], fill=body_rgb, outline=(0, 0, 0, 255))
    # accent stripe diagonal
    draw.polygon([
        (cx - 40, body_top_y + 20),
        (cx + 40, body_top_y + 20),
        (cx + 60, body_bot_y - 20),
        (cx - 60, body_bot_y - 20),
    ], fill=accent_rgb)
    # face minimal
    draw.ellipse([cx - 30, head_cy - 10, cx - 14, head_cy + 6],
                 fill=(30, 30, 30, 255))
    draw.ellipse([cx + 14, head_cy - 10, cx + 30, head_cy + 6],
                 fill=(30, 30, 30, 255))
    # label block
    lbl_y = body_bot_y + 4
    draw.rectangle([cx - 170, lbl_y - 2, cx + 170, lbl_y + 36],
                   fill=(0, 0, 0, 200))
    _centered_text(draw, (cx, lbl_y + 18), character.upper(),
                   _font(22), (255, 255, 255))
    # expression badge top-left
    draw.rectangle([10, 10, 170, 42], fill=(0, 0, 0, 200))
    _centered_text(draw, (90, 28), expression, _font(18), (255, 220, 120))
    SPR_DIR.mkdir(parents=True, exist_ok=True)
    img.save(SPR_DIR / f"{name}.png")
    print(f"  wrote sprites/{name}.png  ({character} — {expression})")


def main() -> int:
    print("Backgrounds:")
    make_bg("bg_kebab_interno",  "INTERNO KEBAB",   (140, 60, 30),  (40, 16, 10))
    make_bg("bg_lavagna",        "LA LAVAGNA",      (30, 40, 50),   (10, 14, 20))
    make_bg("bg_esterno_notte",  "ESTERNO NOTTE",   (20, 20, 60),   (5, 5, 20))
    make_bg("bg_foresta_notte",  "FORESTA NOTTE",   (15, 40, 25),   (3, 10, 6))
    make_bg("bg_monte",          "MONTE",           (100, 120, 160),(40, 50, 70))
    make_bg("bg_tempio",         "TEMPIO DEL DRAGO",(90, 30, 50),   (30, 10, 20))
    make_bg("bg_citta_notte",    "NUMEROPOLI",      (60, 30, 100),  (10, 5, 30))
    make_bg("bg_dojo",           "DOJO",            (120, 90, 60),  (40, 30, 20))

    print("\nSprites:")
    pp_color = (255, 200, 200, 255); pp_accent = (200, 100, 100, 255)
    make_sprite("piccoloplay_normale",      "Piccoloplay", "normale",      pp_color, pp_accent)
    make_sprite("piccoloplay_triste",       "Piccoloplay", "triste",       pp_color, (100, 120, 180, 255))
    make_sprite("piccoloplay_curioso",      "Piccoloplay", "curioso",      pp_color, (220, 200, 100, 255))
    make_sprite("piccoloplay_determinato",  "Piccoloplay", "determinato",  pp_color, (220, 100, 60, 255))

    kb_color = (200, 150, 90, 255); kb_accent = (120, 80, 40, 255)
    make_sprite("kebabbaro_normale",  "Kebabbaro", "normale",  kb_color, kb_accent)
    make_sprite("kebabbaro_ridente",  "Kebabbaro", "ridente",  kb_color, (240, 180, 60, 255))
    make_sprite("kebabbaro_serio",    "Kebabbaro", "serio",    kb_color, (60, 40, 20, 255))

    mei_color = (255, 170, 200, 255); mei_accent = (200, 90, 140, 255)
    make_sprite("mei_normale",      "Mei", "normale",      mei_color, mei_accent)
    make_sprite("mei_imbarazzata",  "Mei", "imbarazzata",  mei_color, (220, 120, 160, 255))
    make_sprite("mei_triste",       "Mei", "triste",       mei_color, (120, 100, 140, 255))

    lz_color = (150, 200, 130, 255); lz_accent = (80, 140, 70, 255)
    make_sprite("lucertola_normale", "Lucertola Sensei", "normale", lz_color, lz_accent)
    make_sprite("lucertola_saggio",  "Lucertola Sensei", "saggio",  lz_color, (200, 170, 60, 255))

    wt_color = (110, 110, 110, 255); wt_accent = (60, 60, 60, 255)
    make_sprite("watcher_normale",   "Watcher", "normale",   wt_color, wt_accent)
    make_sprite("watcher_malefico",  "Watcher", "malefico",  wt_color, (180, 0, 0, 255))

    ac_color = (60, 20, 60, 255); ac_accent = (180, 0, 90, 255)
    make_sprite("anticristo_normale", "Anticristo", "normale", ac_color, ac_accent)

    print("\ndone.")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
