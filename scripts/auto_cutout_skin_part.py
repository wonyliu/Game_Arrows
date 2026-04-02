#!/usr/bin/env python3
"""Remove a solid-color background from a generated skin part image."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def parse_hex_color(value: str) -> tuple[int, int, int]:
    text = (value or "").strip().lstrip("#")
    if len(text) != 6:
        raise ValueError("background color must be 6-hex like #00ff00")
    try:
        return (int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16))
    except ValueError as exc:
        raise ValueError("invalid background hex color") from exc


def build_border_connected_mask(candidate: np.ndarray) -> np.ndarray:
    height, width = candidate.shape
    visited = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        if candidate[0, x]:
            visited[0, x] = True
            queue.append((0, x))
        if candidate[height - 1, x]:
            visited[height - 1, x] = True
            queue.append((height - 1, x))
    for y in range(height):
        if candidate[y, 0] and not visited[y, 0]:
            visited[y, 0] = True
            queue.append((y, 0))
        if candidate[y, width - 1] and not visited[y, width - 1]:
            visited[y, width - 1] = True
            queue.append((y, width - 1))

    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if ny < 0 or nx < 0 or ny >= height or nx >= width:
                continue
            if visited[ny, nx] or not candidate[ny, nx]:
                continue
            visited[ny, nx] = True
            queue.append((ny, nx))
    return visited


def cutout_solid_background(
    image: Image.Image,
    *,
    bg_color: tuple[int, int, int],
    tolerance: int = 42,
    feather: float = 1.2,
    preserve_input_alpha: bool = True,
) -> Image.Image:
    rgba = image.convert("RGBA")
    arr = np.array(rgba, dtype=np.uint8)
    rgb = arr[..., :3].astype(np.float32)
    alpha_in = arr[..., 3].astype(np.uint8)

    bg = np.array(bg_color, dtype=np.float32)
    diff = rgb - bg
    distance = np.sqrt(np.sum(diff * diff, axis=2, dtype=np.float32))
    candidate_bg = distance <= max(0, tolerance)
    border_bg = build_border_connected_mask(candidate_bg)

    alpha_out = np.where(border_bg, 0, 255).astype(np.uint8)
    if preserve_input_alpha:
        alpha_out = np.minimum(alpha_out, alpha_in)

    if feather > 0:
        alpha_img = Image.fromarray(alpha_out, "L").filter(ImageFilter.GaussianBlur(radius=feather))
        alpha_out = np.array(alpha_img, dtype=np.uint8)

    out = arr.copy()
    out[..., 3] = alpha_out
    return Image.fromarray(out, "RGBA")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input image path")
    parser.add_argument("--output", required=True, help="Output RGBA image path")
    parser.add_argument("--bg-color", default="#00ff00", help="Solid background hex color")
    parser.add_argument("--tolerance", type=int, default=42, help="Color distance tolerance (0-441)")
    parser.add_argument("--feather", type=float, default=1.2, help="Alpha blur radius")
    parser.add_argument(
        "--preserve-input-alpha",
        action="store_true",
        help="Keep input transparency when present by taking min(alpha_in, cutout_alpha).",
    )
    args = parser.parse_args()

    bg = parse_hex_color(args.bg_color)
    src_path = Path(args.input)
    dst_path = Path(args.output)
    dst_path.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(src_path).convert("RGBA")
    cutout = cutout_solid_background(
        image,
        bg_color=bg,
        tolerance=args.tolerance,
        feather=max(0.0, args.feather),
        preserve_input_alpha=args.preserve_input_alpha,
    )
    cutout.save(dst_path)
    print(f"[OK] cutout saved: {dst_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
