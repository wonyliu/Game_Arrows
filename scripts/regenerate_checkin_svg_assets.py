#!/usr/bin/env python3
"""Regenerate claimed/day7 checkin assets with chroma background and embed into SVG."""

from __future__ import annotations

import base64
import os
import re
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CHECKIN_DIR = ROOT / "assets" / "design-v6" / "checkin"
SVG_PATH = CHECKIN_DIR / "checkin_figma_export.svg"
REF_CLAIMED = CHECKIN_DIR / "checkin_day_card_claimed_cut.png"
REF_DAY_CARD = CHECKIN_DIR / "checkin_day_card_cut.png"
REF_SOLID = CHECKIN_DIR / "checkin_day_card_solid.png"
OUT_CLAIMED = CHECKIN_DIR / "checkin_day_card_claimed_solid.png"
OUT_DAY7 = CHECKIN_DIR / "checkin_day7_panel.png"
MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")

GREEN = (0, 255, 0)


def ensure_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("Missing GEMINI_API_KEY / GOOGLE_API_KEY")
    return key


def png_bytes(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def call_model(prompt: str, images: list[bytes], key: str) -> Image.Image:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}"
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": prompt}] + [
                {"inline_data": {"mime_type": "image/png", "data": b64(image)}}
                for image in images
            ],
        }],
        "generationConfig": {
            "temperature": 0.2,
            "responseModalities": ["IMAGE", "TEXT"],
        },
    }
    response = requests.post(url, json=payload, timeout=300)
    response.raise_for_status()
    data = response.json()
    for candidate in data.get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and (inline.get("mimeType") or inline.get("mime_type", "")).startswith("image/"):
                return Image.open(BytesIO(base64.b64decode(inline["data"]))).convert("RGBA")
    raise RuntimeError("No image returned by model")


def rounded_mask(size: tuple[int, int], radius: int, inset: int = 0) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((inset, inset, size[0] - 1 - inset, size[1] - 1 - inset), radius, fill=255)
    return mask


def chroma_to_alpha(img: Image.Image, key_rgb: tuple[int, int, int], tolerance: int = 28) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    kr, kg, kb = key_rgb
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if abs(r - kr) <= tolerance and abs(g - kg) <= tolerance and abs(b - kb) <= tolerance:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if g > 145 and g - r > 45 and g - b > 35:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def fit_to_mask(img: Image.Image, mask: Image.Image) -> Image.Image:
    bbox = img.getbbox() or (0, 0, img.width, img.height)
    crop = img.crop(bbox).resize(mask.size, Image.Resampling.LANCZOS).convert("RGBA")
    crop.putalpha(mask)
    return crop


def edge_cleanup(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if a < 10:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if (r < 20 and g < 20 and b < 20) or (r > 235 and g > 245 and b > 235):
                if x < 6 or y < 6 or x >= width - 6 or y >= height - 6:
                    pixels[x, y] = (0, 0, 0, 0)
    return rgba


def clear_fake_checker(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if abs(r - g) < 10 and abs(g - b) < 10 and 180 <= r <= 255:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def update_svg_image(svg_text: str, image_id: str, png_path: Path) -> str:
    data_uri = f"data:image/png;base64,{b64(png_path.read_bytes())}"
    pattern = rf'(<image id="{re.escape(image_id)}"[^>]*xlink:href=")data:image/png;base64,[^"]+("/>)'
    updated, count = re.subn(pattern, rf"\1{data_uri}\2", svg_text, count=1)
    if count != 1:
        raise RuntimeError(f"Failed to update {image_id} in SVG")
    return updated


def main() -> int:
    key = ensure_key()

    claimed_ref = Image.open(REF_CLAIMED).convert("RGBA")
    day_card_ref = Image.open(REF_DAY_CARD).convert("RGBA")
    solid_ref = Image.open(REF_SOLID).convert("RGBA").resize(claimed_ref.size, Image.Resampling.LANCZOS)

    guide_day7 = Image.new("RGBA", (329, 154), GREEN + (255,))
    ImageDraw.Draw(guide_day7).rounded_rectangle((2, 2, 326, 151), 18, fill=(200, 180, 120, 255))

    claimed = solid_ref.copy()
    claimed.alpha_composite(clear_fake_checker(claimed_ref))
    claimed.save(OUT_CLAIMED)

    day7_prompt = (
        "Create one horizontal fantasy game reward panel on a pure solid neon green background (#00FF00). "
        "Use image 1 as the style reference and image 2 as the strict size and shape guide. "
        "Match the same brown wood-like edge, soft warm parchment center, and painted game UI style. "
        "Important: no circular cutout, no icons, no text, no black edge, no glow, and no extra ornaments. "
        "The only background must be flat neon green."
    )
    day7_raw = call_model(day7_prompt, [png_bytes(day_card_ref), png_bytes(guide_day7)], key)
    day7 = edge_cleanup(fit_to_mask(chroma_to_alpha(day7_raw, GREEN), rounded_mask(guide_day7.size, 18, 2)))
    day7.save(OUT_DAY7)

    svg_text = SVG_PATH.read_text(encoding="utf-8")
    svg_text = update_svg_image(svg_text, "image2_5_2", OUT_CLAIMED)
    svg_text = update_svg_image(svg_text, "image7_5_2", OUT_DAY7)
    SVG_PATH.write_text(svg_text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
