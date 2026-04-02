#!/usr/bin/env python3
"""Generate jelly-cube skin assets with classic silhouette lock."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
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

# Palette inspired by candy-jelly cubes (red/green/blue/orange/mint/pink/yellow/cyan/cream).
JELLY_BASE_COLORS = np.array(
    [
        [0.96, 0.18, 0.20],  # red
        [0.68, 0.90, 0.10],  # lime
        [0.56, 0.58, 0.96],  # violet blue
        [0.99, 0.62, 0.10],  # orange
        [0.26, 0.88, 0.66],  # mint
        [0.96, 0.58, 0.86],  # pink
        [0.99, 0.86, 0.18],  # yellow
        [0.24, 0.78, 0.98],  # cyan
        [0.92, 0.88, 0.72],  # cream
    ],
    dtype=np.float32,
)


def rgb_luma(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def to_hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    diff = mx - mn

    h = np.zeros_like(mx)
    s = np.zeros_like(mx)
    v = mx.copy()

    nonzero = mx > 1e-6
    s[nonzero] = diff[nonzero] / mx[nonzero]

    mask = diff > 1e-6
    rmask = (mx == r) & mask
    gmask = (mx == g) & mask
    bmask = (mx == b) & mask

    h[rmask] = ((g[rmask] - b[rmask]) / diff[rmask]) % 6.0
    h[gmask] = (b[gmask] - r[gmask]) / diff[gmask] + 2.0
    h[bmask] = (r[bmask] - g[bmask]) / diff[bmask] + 4.0
    h = (h / 6.0) % 1.0
    return h, s, v


def connected_components(mask: np.ndarray, min_area: int = 1, max_area: int = 1_000_000) -> list[list[tuple[int, int]]]:
    h, w = mask.shape
    visited = np.zeros((h, w), dtype=bool)
    comps: list[list[tuple[int, int]]] = []
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
        if min_area <= len(points) <= max_area:
            comps.append(points)
    return comps


def lock_alpha(src_img: Image.Image, base_img: Image.Image) -> Image.Image:
    src = src_img.convert("RGBA")
    base = base_img.convert("RGBA")
    if src.size != base.size:
        src = src.resize(base.size, Image.Resampling.LANCZOS)
    src_arr = np.array(src, dtype=np.uint8)
    base_alpha = np.array(base.getchannel("A"), dtype=np.uint8)
    out = np.dstack([src_arr[..., :3], base_alpha])
    return Image.fromarray(out, mode="RGBA")


def jelly_gradient(width: int, height: int, base_color: np.ndarray, seed: float) -> np.ndarray:
    x = np.linspace(0.0, 1.0, width, dtype=np.float32)[None, :]
    y = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]

    white = np.array([1.0, 1.0, 1.0], dtype=np.float32)
    top = base_color * 0.80 + white * 0.20
    mid = base_color * 0.94 + np.array([0.03, 0.02, 0.05], dtype=np.float32)
    bottom_tint = np.array([0.96, 0.28, 0.58], dtype=np.float32)
    bottom = base_color * 0.70 + bottom_tint * 0.30

    ym = np.clip(y / 0.55, 0.0, 1.0)[..., None]
    base_grad = top * (1.0 - ym) + mid * ym
    yb = np.clip((y - 0.55) / 0.45, 0.0, 1.0)[..., None]
    base_grad = base_grad * (1.0 - yb) + bottom * yb

    # Soft internal jelly bands.
    wave = np.sin((x * 4.8 - y * 3.4 + seed) * np.pi).astype(np.float32)
    wave_2 = np.sin((x * 2.6 + y * 4.2 + seed * 0.73) * np.pi).astype(np.float32)
    wave_mix = 0.55 * wave + 0.45 * wave_2
    warm = np.array([1.0, 0.72, 0.38], dtype=np.float32)
    cool = np.array([0.44, 0.76, 1.0], dtype=np.float32)

    pos = np.clip(wave_mix, 0.0, 1.0)[..., None]
    neg = np.clip(-wave_mix, 0.0, 1.0)[..., None]
    grad = base_grad * (1.0 - pos * 0.11 - neg * 0.08) + warm * (pos * 0.07) + cool * (neg * 0.06)

    # Top specular strip.
    strip = np.exp(-(((y - 0.07) / 0.026) ** 2 + ((x - 0.50) / 0.30) ** 2))[..., None]
    grad = grad * (1.0 - strip * 0.26) + white * (strip * 0.26)

    # Corner glints.
    glint_a = np.exp(-(((y - 0.14) / 0.045) ** 2 + ((x - 0.16) / 0.06) ** 2))[..., None]
    glint_b = np.exp(-(((y - 0.16) / 0.050) ** 2 + ((x - 0.84) / 0.075) ** 2))[..., None]
    grad = grad * (1.0 - (glint_a + glint_b) * 0.18) + white * ((glint_a + glint_b) * 0.18)

    return np.clip(grad, 0.0, 1.0)


def build_edge_shading(width: int, height: int) -> np.ndarray:
    x = np.linspace(0.0, 1.0, width, dtype=np.float32)[None, :]
    y = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]
    edge = np.minimum(np.minimum(x, 1.0 - x), np.minimum(y, 1.0 - y))
    edge = np.clip(edge / 0.22, 0.0, 1.0)
    return edge


def stylize_part(src_img: Image.Image, part_index: int) -> Image.Image:
    arr = np.array(src_img.convert("RGBA"), dtype=np.float32)
    rgb = arr[..., :3] / 255.0
    alpha = arr[..., 3]
    opaque = alpha > 0

    h, w = rgb.shape[:2]
    _, sat, _ = to_hsv(rgb)
    luma = rgb_luma(rgb)

    # Keep facial/outline readability.
    dark_ink = (luma < 0.22) & (sat < 0.40) & opaque
    eye_white = np.zeros((h, w), dtype=bool)
    if part_index <= 3:
        bright_neutral = (luma > 0.82) & (sat < 0.16) & opaque
        for comp in connected_components(bright_neutral, min_area=120, max_area=9500):
            ys = [p[0] for p in comp]
            xs = [p[1] for p in comp]
            y1, y2 = min(ys), max(ys)
            x1, x2 = min(xs), max(xs)
            area = len(comp)
            bw = x2 - x1 + 1
            bh = y2 - y1 + 1
            ratio = bw / max(1, bh)
            cy = (y1 + y2) * 0.5 / max(1, h - 1)

            # Keep likely eye whites only: medium-size round-ish blobs in upper area.
            if area < 500 or area > 8000:
                continue
            if ratio < 0.45 or ratio > 2.2:
                continue
            if cy > 0.72:
                continue

            pad = 3
            ny1 = max(0, y1 - pad)
            ny2 = min(h, y2 + pad + 1)
            nx1 = max(0, x1 - pad)
            nx2 = min(w, x2 + pad + 1)
            if np.count_nonzero(dark_ink[ny1:ny2, nx1:nx2]) < 80:
                continue

            for y, x in comp:
                eye_white[y, x] = True

    body_mask = opaque & ~dark_ink & ~eye_white

    base_color = JELLY_BASE_COLORS[part_index % len(JELLY_BASE_COLORS)]
    grad = jelly_gradient(w, h, base_color, seed=0.37 * (part_index + 1))
    edge = build_edge_shading(w, h)[..., None]

    out = np.zeros_like(rgb, dtype=np.float32)
    body = grad * (0.82 + edge * 0.18)

    # Add translucent depth with source luminance.
    depth = np.clip(0.80 + luma[..., None] * 0.26, 0.78, 1.05)
    out[body_mask] = np.clip(body[body_mask] * depth[body_mask], 0.0, 0.96)

    # Preserve eyes and line art.
    out[eye_white] = np.array([0.98, 0.99, 1.0], dtype=np.float32)
    out[dark_ink] = np.array([0.14, 0.09, 0.20], dtype=np.float32)

    # Fallback for any untouched opaque pixels.
    untouched = opaque & (np.sum(out, axis=2) < 1e-6)
    out[untouched] = rgb[untouched]

    rgba = np.dstack([(out * 255.0).astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(rgba, mode="RGBA")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default="assets/skins/gemini-candy")
    parser.add_argument("--target-dir", default="assets/skins/jelly-cube")
    parser.add_argument("--preview-dir", default="temp/skins/jelly-cube/v1")
    parser.add_argument("--base-dir", default="assets/design-v4/clean")
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    target_dir = Path(args.target_dir)
    preview_dir = Path(args.preview_dir)
    base_dir = Path(args.base_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    generated = []
    for idx, name in enumerate(PART_FILES):
        src_path = source_dir / name
        if not src_path.exists():
            raise FileNotFoundError(src_path)
        base_name = BASE_PART_MAP[name]
        base_path = base_dir / base_name
        if not base_path.exists():
            raise FileNotFoundError(base_path)

        src = Image.open(src_path).convert("RGBA")
        stylized = stylize_part(src, idx)
        locked = lock_alpha(stylized, Image.open(base_path).convert("RGBA"))
        locked.save(preview_dir / name)
        locked.save(target_dir / name)
        generated.append(name)
        print(f"[OK] {name}")

    manifest = {
        "skinId": "jelly-cube",
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "variant": "v1-glossy-jelly-cube",
        "source": "Procedural glossy jelly recolor based on gemini-candy source + strict classic alpha lock",
        "inputs": {
            "sourceDir": str(source_dir).replace("\\", "/"),
            "baseGeometryDir": str(base_dir).replace("\\", "/"),
        },
        "outputs": generated,
        "notes": "Reference style: glossy candy cubes with bright specular highlights and translucent gradient layers.",
    }
    (target_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[OK] manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
