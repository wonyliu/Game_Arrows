#!/usr/bin/env python3
"""Recolor candy-dream skin to a readable black/white style."""

from __future__ import annotations

import argparse
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image


PART_FILES = (
    "snake_head.png",
    "snake_head_curious.png",
    "snake_head_sleepy.png",
    "snake_head_surprised.png",
    "snake_seg_a.png",
    "snake_seg_b.png",
    "snake_tail_base.png",
    "snake_tail_tip.png",
)

BASE_PART_MAP = {
    "snake_head.png": "snake_head.png",
    "snake_head_curious.png": "snake_head_curious_r2.png",
    "snake_head_sleepy.png": "snake_head_sleepy_r2.png",
    "snake_head_surprised.png": "snake_head_surprised_r2.png",
    "snake_seg_a.png": "snake_seg_a.png",
    "snake_seg_b.png": "snake_seg_b.png",
    "snake_tail_base.png": "snake_tail_base.png",
    "snake_tail_tip.png": "snake_tail_tip.png",
}


def to_hsv(rgb: np.ndarray) -> np.ndarray:
    out = np.empty_like(rgb)
    flat = rgb.reshape(-1, 3)
    flat_out = out.reshape(-1, 3)
    for i, (r, g, b) in enumerate(flat):
        h, s, v = colorsys.rgb_to_hsv(float(r), float(g), float(b))
        flat_out[i] = (h * 360.0, s, v)
    return out


def rgb_luma(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def box_blur_5x5(img: np.ndarray) -> np.ndarray:
    h, w = img.shape
    pad = np.pad(img, ((2, 2), (2, 2)), mode="edge")
    out = np.zeros_like(img, dtype=np.float32)
    for dy in range(5):
        for dx in range(5):
            out += pad[dy : dy + h, dx : dx + w]
    return out / 25.0


def filter_connected_components(mask: np.ndarray, min_area: int, max_area: int) -> np.ndarray:
    h, w = mask.shape
    visited = np.zeros((h, w), dtype=bool)
    keep = np.zeros((h, w), dtype=bool)
    ys, xs = np.nonzero(mask)

    for sy, sx in zip(ys, xs):
        if visited[sy, sx]:
            continue
        stack = [(sy, sx)]
        visited[sy, sx] = True
        points: list[tuple[int, int]] = []
        while stack:
            y, x = stack.pop()
            points.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if ny < 0 or ny >= h or nx < 0 or nx >= w:
                    continue
                if visited[ny, nx] or not mask[ny, nx]:
                    continue
                visited[ny, nx] = True
                stack.append((ny, nx))

        area = len(points)
        if min_area <= area <= max_area:
            for y, x in points:
                keep[y, x] = True

    return keep


def recolor_image(src: Image.Image, seed_shift: float) -> Image.Image:
    arr = np.array(src.convert("RGBA"), dtype=np.float32)
    rgb = arr[..., :3]
    alpha = arr[..., 3]
    opaque = alpha > 0

    hsv = to_hsv(np.clip(rgb / 255.0, 0, 1))
    hue = hsv[..., 0]
    sat = hsv[..., 1]
    val = hsv[..., 2]
    luma = rgb_luma(rgb)
    blur_luma = box_blur_5x5(luma)

    # Classify pixel groups.
    dark_ink = (luma < 62.0) & (sat < 0.20) & opaque
    candy_candidate = (sat > 0.28) & (val > 0.18) & opaque
    candy_dot = filter_connected_components(candy_candidate, min_area=2, max_area=2600)
    base_body = opaque & ~(dark_ink | candy_dot)

    out = np.zeros_like(rgb, dtype=np.float32)

    # Black snake body: deep charcoal with readable shading.
    body_gray = 18.0 + np.power(np.clip(luma / 255.0, 0, 1), 1.60) * 36.0
    body_gray = np.clip(body_gray, 12.0, 62.0)
    out[base_body] = body_gray[base_body, None]

    # Candy dots convert to light grayscale tones for clear black/white identity.
    hue_band = ((hue + seed_shift) % 360.0) / 360.0
    tones = np.where(hue_band < 1 / 3, 242.0, np.where(hue_band < 2 / 3, 210.0, 176.0))
    tone_mix = tones * 0.78 + luma * 0.22
    tone_mix = np.clip(tone_mix, 164.0, 248.0)
    out[candy_dot] = tone_mix[candy_dot, None]

    # Resolve original black details:
    # - around white eye areas keep dark pupils
    # - elsewhere brighten lines so they don't merge into black body
    near_bright = blur_luma > 145.0
    preserved_dark = dark_ink & near_bright
    lifted_lines = dark_ink & ~near_bright

    out[preserved_dark] = np.array([14.0, 14.0, 16.0], dtype=np.float32)
    line_gray = np.clip(190.0 + (luma - 28.0) * 0.32, 168.0, 220.0)
    out[lifted_lines] = line_gray[lifted_lines, None]
    out = np.clip(out, 0.0, 255.0)

    rgba = np.dstack([out.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(rgba, mode="RGBA")


def lock_alpha(img: Image.Image, base_img: Image.Image) -> Image.Image:
    src = img.convert("RGBA")
    base = base_img.convert("RGBA")
    if src.size != base.size:
        src = src.resize(base.size, Image.Resampling.LANCZOS)
    src_arr = np.array(src, dtype=np.uint8)
    base_alpha = np.array(base.getchannel("A"), dtype=np.uint8)
    out = np.dstack([src_arr[..., :3], base_alpha])
    return Image.fromarray(out, mode="RGBA")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in-dir", default="assets/skins/candy-dream")
    parser.add_argument("--out-dir", default="assets/skins/candy-dream")
    parser.add_argument("--preview-dir", default="temp/skins/candy-dream/v5_bw")
    parser.add_argument("--lock-alpha-dir", default="assets/design-v4/clean")
    args = parser.parse_args()

    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir)
    preview_dir = Path(args.preview_dir)
    lock_alpha_dir = Path(args.lock_alpha_dir) if args.lock_alpha_dir else None
    preview_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    for i, name in enumerate(PART_FILES):
        src_path = in_dir / name
        if not src_path.exists():
            raise FileNotFoundError(src_path)
        src = Image.open(src_path)
        bw = recolor_image(src, seed_shift=float(i * 17))
        if lock_alpha_dir:
            base_name = BASE_PART_MAP.get(name, name)
            base_path = lock_alpha_dir / base_name
            if base_path.exists():
                bw = lock_alpha(bw, Image.open(base_path))
        bw.save(preview_dir / name)
        bw.save(out_dir / name)
        print(f"[OK] {name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
