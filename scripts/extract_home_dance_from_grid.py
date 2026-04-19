#!/usr/bin/env python3
"""Split a green-screen snake contact sheet into transparent animation frames."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def is_green(pixel: tuple[int, int, int, int], spill_threshold: int) -> bool:
    r, g, b, _ = pixel
    return g > 80 and (g - r) >= spill_threshold and (g - b) >= spill_threshold


def remove_green(image: Image.Image, spill_threshold: int) -> Image.Image:
    rgba = image.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if is_green((r, g, b, a), spill_threshold):
                px[x, y] = (0, 0, 0, 0)
                continue
            green_spill = g - max(r, b)
            if a > 0 and green_spill > 14:
                px[x, y] = (r, max(r, b), b, a)
    return rgba


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    px = image.load()
    min_x, min_y = image.width, image.height
    max_x, max_y = -1, -1
    for y in range(image.height):
        for x in range(image.width):
            if px[x, y][3] == 0:
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if max_x < min_x or max_y < min_y:
        return (0, 0, image.width, image.height)
    return (min_x, min_y, max_x + 1, max_y + 1)


def resize_content(content: Image.Image, scale: float) -> Image.Image:
    return content.resize(
        (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
        Image.Resampling.LANCZOS,
    )


def fit_frames_to_canvas(
    frames: list[Image.Image],
    canvas_size: int,
    content_box: tuple[int, int],
) -> list[Image.Image]:
    if not frames:
        return []

    bounds = [alpha_bounds(frame) for frame in frames]
    widths = [right - left for left, _, right, _ in bounds]
    heights = [bottom - top for _, top, _, bottom in bounds]
    max_w, max_h = content_box
    scale = min(
        max_w / max(1, max(widths)),
        max_h / max(1, max(heights)),
    )

    normalized: list[Image.Image] = []
    for frame, (left, top, right, bottom) in zip(frames, bounds):
        content = frame.crop((left, top, right, bottom))
        resized = resize_content(content, scale)
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        paste_x = round((canvas_size - resized.width) / 2)
        paste_y = round((canvas_size - resized.height) / 2)
        canvas.alpha_composite(resized, (paste_x, paste_y))
        normalized.append(canvas)

    return normalized


def fit_to_canvas(image: Image.Image, canvas_size: int, content_box: tuple[int, int]) -> Image.Image:
    content = image.crop(alpha_bounds(image))
    max_w, max_h = content_box
    scale = min(max_w / max(1, content.width), max_h / max(1, content.height))
    resized = resize_content(content, scale)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    left = round((canvas_size - resized.width) / 2)
    top = round((canvas_size - resized.height) / 2)
    canvas.alpha_composite(resized, (left, top))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input sheet path")
    parser.add_argument("--output-dir", default="assets/ui/home/mascots", help="Output directory")
    parser.add_argument("--main-cols", type=int, default=3)
    parser.add_argument("--main-rows", type=int, default=3)
    parser.add_argument("--sub-cols", type=int, default=3)
    parser.add_argument("--cell-pad", type=int, default=8)
    parser.add_argument("--frame-size", type=int, default=128)
    parser.add_argument("--content-width", type=int, default=104)
    parser.add_argument("--content-height", type=int, default=108)
    parser.add_argument("--prefix", default="dance_snake_custom_frame_")
    parser.add_argument("--duration-ms", type=int, default=90)
    parser.add_argument("--spill-threshold", type=int, default=30)
    parser.add_argument(
        "--alignment-mode",
        choices=("per-frame", "global-center"),
        default="global-center",
        help="How to normalize frame size and position on the output canvas",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(input_path).convert("RGBA")
    main_w = source.width / max(1, args.main_cols)
    main_h = source.height / max(1, args.main_rows)
    frames: list[Image.Image] = []

    for main_row in range(args.main_rows):
        for main_col in range(args.main_cols):
            left = round(main_col * main_w) + args.cell_pad
            top = round(main_row * main_h) + args.cell_pad
            right = round((main_col + 1) * main_w) - args.cell_pad
            bottom = round((main_row + 1) * main_h) - args.cell_pad
            group = source.crop((left, top, right, bottom))
            sub_w = group.width / max(1, args.sub_cols)
            for sub_col in range(args.sub_cols):
                sub_left = round(sub_col * sub_w) + 4
                sub_top = 4
                sub_right = round((sub_col + 1) * sub_w) - 4
                sub_bottom = group.height - 4
                frame = group.crop((sub_left, sub_top, sub_right, sub_bottom))
                frame = remove_green(frame, args.spill_threshold)
                frames.append(frame)

    if args.alignment_mode == "global-center":
        frames = fit_frames_to_canvas(frames, args.frame_size, (args.content_width, args.content_height))
    else:
        frames = [fit_to_canvas(frame, args.frame_size, (args.content_width, args.content_height)) for frame in frames]

    for index, frame in enumerate(frames):
        frame.save(output_dir / f"{args.prefix}{index:02d}.png")

    manifest = {
        "framePrefix": args.prefix,
        "frameCount": len(frames),
        "framePadding": 2,
        "frameDurationMs": max(40, args.duration_ms)
    }
    (output_dir / "manifest.json").write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")
    print(f"[OK] wrote {len(frames)} frames to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
