#!/usr/bin/env python3
"""Extract a usable sprite sheet from a Gemini browser screenshot crop."""

from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "temp" / "gemini-snake-sheet-browser-crop.png"
OUTPUT_DIR = ROOT / "assets" / "ui" / "home" / "mascots"

COLUMNS = 5
ROWS = 3
FRAME_SIZE = 128
GREEN_THRESHOLD = (70, 150, 40)


def is_green(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = pixel
    return g >= GREEN_THRESHOLD[1] and g >= r + GREEN_THRESHOLD[0] and g >= b + GREEN_THRESHOLD[2]


def cutout_green(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if is_green((r, g, b, a)):
                pixels[x, y] = (0, 0, 0, 0)
                continue
            green_spill = g - max(r, b)
            if a > 0 and green_spill > 18:
                pixels[x, y] = (r, max(max(r, b), g - green_spill), b, a)
    return rgba


def crop_content_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    pixels = image.load()
    min_x, min_y = image.width, image.height
    max_x, max_y = -1, -1
    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y][3] == 0:
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if max_x < min_x or max_y < min_y:
        return (0, 0, image.width, image.height)
    return (min_x, min_y, max_x + 1, max_y + 1)


def fit_frame(image: Image.Image) -> Image.Image:
    content = image.crop(crop_content_bounds(image))
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    scale = min(1.0, 96 / max(1, content.width), 104 / max(1, content.height))
    resized = content.resize(
        (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
        Image.Resampling.LANCZOS,
    )
    left = round((FRAME_SIZE - resized.width) / 2)
    top = round(10 + ((104 - resized.height) / 2))
    canvas.alpha_composite(resized, (left, top))
    return canvas


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    raw = Image.open(INPUT_PATH).convert("RGBA")
    raw.save(OUTPUT_DIR / "dance_snake_sheet_browser_raw.png")

    x_edges = [round(raw.width * index / COLUMNS) for index in range(COLUMNS + 1)]
    y_edges = [round(raw.height * index / ROWS) for index in range(ROWS + 1)]

    frames: list[Image.Image] = []
    for row in range(ROWS):
        for col in range(COLUMNS):
            left_pad = 18 if col == 0 else 4
            right_pad = 18 if col == COLUMNS - 1 else 4
            top_pad = 18 if row == 0 else 4
            bottom_pad = 18 if row == ROWS - 1 else 4
            left = x_edges[col] + left_pad
            top = y_edges[row] + top_pad
            right = x_edges[col + 1] - right_pad
            bottom = y_edges[row + 1] - bottom_pad
            cell = raw.crop((left, top, right, bottom))
            cutout = fit_frame(cutout_green(cell))
            cutout.save(OUTPUT_DIR / f"dance_snake_browser_frame_{len(frames):02d}.png")
            frames.append(cutout)

    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (FRAME_SIZE * index, 0))

    sheet.save(OUTPUT_DIR / "dance_snake_sheet_cutout.png")
    print(f"[OK] extracted {len(frames)} browser frames to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
