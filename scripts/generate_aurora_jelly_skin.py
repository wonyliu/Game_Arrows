#!/usr/bin/env python3
"""Generate aurora-jelly skin assets with classic silhouette lock."""

from __future__ import annotations

import argparse
import json
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

DOT_PALETTE = np.array(
    [
        [0.98, 0.35, 0.78],  # pink
        [0.23, 0.86, 0.97],  # cyan
        [0.56, 0.98, 0.42],  # lime
        [1.00, 0.90, 0.35],  # yellow
        [0.66, 0.52, 0.99],  # violet
        [0.33, 0.96, 0.86],  # aqua
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


def box_blur_5x5(img: np.ndarray) -> np.ndarray:
    h, w = img.shape
    pad = np.pad(img, ((2, 2), (2, 2)), mode="edge")
    out = np.zeros_like(img, dtype=np.float32)
    for dy in range(5):
        for dx in range(5):
            out += pad[dy : dy + h, dx : dx + w]
    return out / 25.0


def connected_components(mask: np.ndarray, min_area: int, max_area: int) -> list[list[tuple[int, int]]]:
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


def aurora_gradient(width: int, height: int, seed: float) -> np.ndarray:
    x = np.linspace(0.0, 1.0, width, dtype=np.float32)[None, :]
    y = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]

    top = np.array([0.46, 0.90, 0.98], dtype=np.float32)
    mid = np.array([0.80, 0.98, 0.78], dtype=np.float32)
    bot = np.array([0.97, 0.62, 0.90], dtype=np.float32)

    mix_a = np.clip(y / 0.56, 0.0, 1.0)[..., None]
    upper = top * (1.0 - mix_a) + mid * mix_a
    mix_b = np.clip((y - 0.56) / 0.44, 0.0, 1.0)[..., None]
    grad = upper * (1.0 - mix_b) + bot * mix_b

    wave = np.sin((x * 7.2 + y * 9.5 + seed) * np.pi).astype(np.float32)
    aqua = np.array([0.36, 0.98, 0.92], dtype=np.float32)
    violet = np.array([0.65, 0.58, 0.99], dtype=np.float32)
    pos = np.clip(wave, 0.0, 1.0)[..., None]
    neg = np.clip(-wave, 0.0, 1.0)[..., None]
    grad = grad * (1.0 - pos * 0.18 - neg * 0.12) + violet * (pos * 0.18) + aqua * (neg * 0.12)
    return np.clip(grad, 0.0, 1.0)


def stylize_part(src_img: Image.Image, part_index: int) -> Image.Image:
    arr = np.array(src_img.convert("RGBA"), dtype=np.float32)
    rgb = arr[..., :3] / 255.0
    alpha = arr[..., 3]
    opaque = alpha > 0

    h, w = rgb.shape[:2]
    _, sat, _ = to_hsv(rgb)
    luma = rgb_luma(rgb)
    blur_luma = box_blur_5x5(luma)

    dark_ink = (luma < 0.24) & (sat < 0.28) & opaque
    eye_white = (luma > 0.78) & (sat < 0.16) & opaque

    dot_candidate = (sat > 0.34) & (luma > 0.20) & (luma < 0.93) & opaque & ~dark_ink
    dot_components = connected_components(dot_candidate, min_area=5, max_area=3800)
    dot_mask = np.zeros((h, w), dtype=bool)
    for comp in dot_components:
        for y, x in comp:
            dot_mask[y, x] = True

    body_mask = opaque & ~dot_mask & ~dark_ink & ~eye_white

    out = np.zeros_like(rgb, dtype=np.float32)
    grad = aurora_gradient(w, h, seed=0.47 * (part_index + 1))
    shade = np.clip(0.72 + luma * 0.62, 0.58, 1.18)
    out[body_mask] = np.clip(grad[body_mask] * shade[body_mask, None], 0.0, 1.0)

    # Keep eye whites bright and clear.
    out[eye_white] = np.array([0.97, 0.98, 1.0], dtype=np.float32)

    # Dark line art uses deep indigo to stay visible over gradients.
    out[dark_ink] = np.array([0.12, 0.08, 0.18], dtype=np.float32)

    # Repaint candy dots into bright gem palette, with subtle per-dot shading.
    for comp in dot_components:
        ys = [p[0] for p in comp]
        xs = [p[1] for p in comp]
        cy = int(sum(ys) / len(ys))
        cx = int(sum(xs) / len(xs))
        color_idx = (cx * 31 + cy * 17 + part_index * 13) % len(DOT_PALETTE)
        base = DOT_PALETTE[color_idx]
        for y, x in comp:
            local_shade = np.clip(0.72 + luma[y, x] * 0.65, 0.64, 1.20)
            out[y, x] = np.clip(base * local_shade, 0.0, 1.0)

    # Add pearl highlights from source bright map to keep volume readable.
    hl = (blur_luma - luma > 0.08) & body_mask
    out[hl] = np.clip(out[hl] * 1.12 + 0.06, 0.0, 1.0)

    # Any untouched opaque pixel fallback.
    untouched = opaque & (np.sum(out, axis=2) < 1e-6)
    out[untouched] = rgb[untouched]

    rgba = np.dstack([(out * 255.0).astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(rgba, mode="RGBA")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default="temp/skins/candy-dream/v2_locked_userref")
    parser.add_argument("--target-dir", default="assets/skins/aurora-jelly")
    parser.add_argument("--preview-dir", default="temp/skins/aurora-jelly/v1")
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
        "skinId": "aurora-jelly",
        "generatedAt": __import__("datetime").datetime.now().astimezone().isoformat(timespec="seconds"),
        "variant": "v1-gradient-gem",
        "source": "Style transfer from curated candy source + procedural aurora/gem recolor + strict alpha lock",
        "inputs": {
            "sourceDir": str(source_dir).replace("\\", "/"),
            "baseGeometryDir": str(base_dir).replace("\\", "/"),
        },
        "outputs": generated,
        "notes": "Classic silhouette locked, vibrant high-readability candy palette.",
    }
    (target_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[OK] manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
