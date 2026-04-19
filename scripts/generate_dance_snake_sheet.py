#!/usr/bin/env python3
"""Build a simple dancing snake sprite sheet for the home screen mascot."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SKIN_DIR = ROOT / "assets" / "skins" / "classic-burrow"
OUTPUT_DIR = ROOT / "assets" / "ui" / "home" / "mascots"

FRAME_COUNT = 16
FRAME_SIZE = (96, 96)
CHROMA_GREEN = (0, 255, 0, 255)


def load_part(name: str, scale: float) -> Image.Image:
    image = Image.open(SKIN_DIR / name).convert("RGBA")
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def rotate_part(image: Image.Image, angle_degrees: float) -> Image.Image:
    return image.rotate(angle_degrees, resample=Image.Resampling.BICUBIC, expand=True)


def paste_centered(target: Image.Image, sprite: Image.Image, center_x: float, center_y: float) -> None:
    left = round(center_x - (sprite.width / 2))
    top = round(center_y - (sprite.height / 2))
    target.alpha_composite(sprite, (left, top))


def build_frame(progress: float, parts: dict[str, Image.Image]) -> Image.Image:
    frame = Image.new("RGBA", FRAME_SIZE, CHROMA_GREEN)
    pivot_x = 48 + math.sin(progress * math.tau) * 4.8
    pivot_y = 22 + math.sin(progress * math.tau * 2) * 1.8

    chain_points: list[tuple[float, float]] = []
    for index in range(6):
        t = index / 5
        wave = math.sin((progress * math.tau) + (t * 1.2 * math.pi))
        twist = math.sin((progress * math.tau * 2) + (t * math.pi * 0.7))
        x = pivot_x + wave * (8.5 - t * 3.2) + twist * 1.1
        y = pivot_y + (t * 13.2) + math.cos((progress * math.tau) + (t * math.pi * 1.5)) * 1.6
        chain_points.append((x, y))

    head_angle = math.degrees(math.sin(progress * math.tau) * 0.18 + math.sin(progress * math.tau * 2) * 0.08)
    paste_centered(frame, rotate_part(parts["head"], head_angle), chain_points[0][0], chain_points[0][1])

    for index in range(1, len(chain_points) - 1):
        prev_x, prev_y = chain_points[index - 1]
        curr_x, curr_y = chain_points[index]
        angle = math.degrees(math.atan2(curr_y - prev_y, curr_x - prev_x))
        part_name = "seg_a" if index % 2 else "seg_b"
        paste_centered(frame, rotate_part(parts[part_name], angle - 90), curr_x, curr_y)

    tail_base_x, tail_base_y = chain_points[-1]
    before_tail_x, before_tail_y = chain_points[-2]
    tail_angle = math.degrees(math.atan2(tail_base_y - before_tail_y, tail_base_x - before_tail_x))
    tail_tip_angle = tail_angle + math.degrees(math.sin(progress * math.tau * 2) * 0.28)
    paste_centered(frame, rotate_part(parts["tail_base"], tail_angle - 90), tail_base_x, tail_base_y)

    tail_tip_offset = 12
    tail_tip_x = tail_base_x + math.cos(math.radians(tail_angle)) * tail_tip_offset
    tail_tip_y = tail_base_y + math.sin(math.radians(tail_angle)) * tail_tip_offset
    paste_centered(frame, rotate_part(parts["tail_tip"], tail_tip_angle - 90), tail_tip_x, tail_tip_y)
    return frame


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    parts = {
        "head": load_part("snake_head.png", 1.24),
        "seg_a": load_part("snake_seg_a.png", 1.26),
        "seg_b": load_part("snake_seg_b.png", 1.32),
        "tail_base": load_part("snake_tail_base.png", 1.26),
        "tail_tip": load_part("snake_tail_tip.png", 1.18),
    }

    raw_sheet = Image.new("RGBA", (FRAME_SIZE[0] * FRAME_COUNT, FRAME_SIZE[1]), CHROMA_GREEN)
    transparent_sheet = Image.new("RGBA", (FRAME_SIZE[0] * FRAME_COUNT, FRAME_SIZE[1]), (0, 0, 0, 0))

    for index in range(FRAME_COUNT):
        progress = index / FRAME_COUNT
        frame = build_frame(progress, parts)
        transparent_frame = frame.copy()
        pixels = transparent_frame.load()
        for y in range(transparent_frame.height):
            for x in range(transparent_frame.width):
                if pixels[x, y][:3] == CHROMA_GREEN[:3]:
                    pixels[x, y] = (0, 0, 0, 0)

        raw_sheet.alpha_composite(frame, (FRAME_SIZE[0] * index, 0))
        transparent_sheet.alpha_composite(transparent_frame, (FRAME_SIZE[0] * index, 0))
        frame.save(OUTPUT_DIR / f"dance_snake_frame_{index:02d}_raw.png")
        transparent_frame.save(OUTPUT_DIR / f"dance_snake_frame_{index:02d}.png")

    raw_sheet.save(OUTPUT_DIR / "dance_snake_sheet_raw.png")
    transparent_sheet.save(OUTPUT_DIR / "dance_snake_sheet_cutout.png")
    print(f"[OK] wrote mascot sheets to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
