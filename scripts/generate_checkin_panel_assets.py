#!/usr/bin/env python3
"""Generate check-in panel assets with Gemini image model.

Outputs:
- assets/design-v6/checkin/checkin_day_card_solid.png
- assets/design-v6/checkin/checkin_day7_panel.png
"""

from __future__ import annotations

import base64
import json
import os
import time
from io import BytesIO
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CHECKIN_DIR = ROOT / "assets" / "design-v6" / "checkin"
REF_CARD_PATH = CHECKIN_DIR / "checkin_day_card_cut.png"
OUT_CARD_PATH = CHECKIN_DIR / "checkin_day_card_solid.png"
OUT_DAY7_PATH = CHECKIN_DIR / "checkin_day7_panel.png"
MANIFEST_PATH = CHECKIN_DIR / "checkin_panel_gen_manifest.json"
MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")


def ensure_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("Missing GEMINI_API_KEY / GOOGLE_API_KEY in environment.")
    return key


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def extract_first_image_bytes(response_json: dict) -> bytes:
    for candidate in response_json.get("candidates", []):
        parts = candidate.get("content", {}).get("parts", [])
        for part in parts:
            inline = part.get("inlineData") or part.get("inline_data")
            if not inline:
                continue
            mime_type = inline.get("mimeType") or inline.get("mime_type") or ""
            if not mime_type.startswith("image/"):
                continue
            data = inline.get("data")
            if data:
                return base64.b64decode(data)
    raise RuntimeError("No image payload returned by model.")


def call_model(*, key: str, prompt: str, images: list[bytes], timeout_sec: int = 240, max_retries: int = 5) -> bytes:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}"
    parts = [{"text": prompt}]
    for image in images:
        parts.append({"inline_data": {"mime_type": "image/png", "data": b64(image)}})
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": parts,
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseModalities": ["IMAGE", "TEXT"],
        },
    }
    attempt = 0
    while True:
        attempt += 1
        try:
            resp = requests.post(url, json=payload, timeout=timeout_sec)
            if resp.status_code != 200:
                raise RuntimeError(f"Model request failed ({resp.status_code}): {resp.text[:700]}")
            return extract_first_image_bytes(resp.json())
        except Exception:
            if attempt >= max_retries:
                raise
            sleep_sec = min(12, 2 * attempt)
            print(f"[retry] attempt {attempt}/{max_retries}, sleep {sleep_sec}s")
            time.sleep(sleep_sec)


def image_to_png_bytes(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def build_rounded_mask(size: tuple[int, int], radius: int, inset: int = 0) -> Image.Image:
    width, height = size
    img = Image.new("L", size, 0)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        (inset, inset, width - 1 - inset, height - 1 - inset),
        radius=max(1, radius),
        fill=255,
    )
    return img


def fit_rgb_to_template_alpha(template_alpha: Image.Image, generated_img: Image.Image) -> Image.Image:
    gen = generated_img.convert("RGBA")
    arr = np.array(gen, dtype=np.uint8)
    alpha = arr[..., 3]
    alpha_bbox = Image.fromarray(alpha, "L").getbbox() or (0, 0, gen.width, gen.height)
    crop = gen.crop(alpha_bbox).convert("RGBA")
    resized = crop.resize(template_alpha.size, Image.Resampling.LANCZOS)
    rgb = np.array(resized.convert("RGB"), dtype=np.uint8)
    alpha_np = np.array(template_alpha, dtype=np.uint8)
    out = np.dstack([rgb, alpha_np])
    return Image.fromarray(out, "RGBA")


def save_locked_asset(*, ref_images: list[bytes], prompt: str, template_alpha: Image.Image, output_path: Path, key: str) -> None:
    raw_bytes = call_model(key=key, prompt=prompt, images=ref_images)
    raw_img = Image.open(BytesIO(raw_bytes)).convert("RGBA")
    final_img = fit_rgb_to_template_alpha(template_alpha, raw_img)
    final_img.save(output_path)


def main() -> int:
    key = ensure_key()
    if not REF_CARD_PATH.is_file():
        raise FileNotFoundError(f"Reference card not found: {REF_CARD_PATH}")

    CHECKIN_DIR.mkdir(parents=True, exist_ok=True)
    ref_card = Image.open(REF_CARD_PATH).convert("RGBA")
    ref_card_bytes = image_to_png_bytes(ref_card)

    square_alpha = build_rounded_mask(ref_card.size, radius=24, inset=2)
    day7_alpha = build_rounded_mask((356, 154), radius=18, inset=2)
    day7_guide = Image.new("RGBA", day7_alpha.size, (190, 194, 205, 0))
    day7_guide.putalpha(day7_alpha)
    day7_guide_bytes = image_to_png_bytes(day7_guide)

    square_prompt = (
        "Create one polished mobile game UI reward tile on a transparent background. "
        "Image 1 is the exact style reference. Keep the same brown wood-like border, warm pale yellow parchment fill, "
        "soft painterly highlights, same corner softness, same border thickness, and same cozy fantasy game look. "
        "Important: remove the large circular cutout completely and fill the whole interior with continuous pale yellow parchment. "
        "Do not add any icons, text, holes, circles, extra ornaments, extra outlines, drop shadows outside the tile, or background."
    )

    day7_prompt = (
        "Create one horizontal mobile game reward panel on a transparent background. "
        "Image 1 is the exact style reference. Image 2 is the strict geometry and size guide. "
        "Match the silhouette of image 2. Use the same brown wood-like border, warm pale yellow parchment center, "
        "soft painterly highlights, and same cozy fantasy mobile game style from image 1. "
        "Important: no inner cutout, no circles, no icons, no text, no decorations beyond the border and parchment face, no background."
    )

    save_locked_asset(
        ref_images=[ref_card_bytes],
        prompt=square_prompt,
        template_alpha=square_alpha,
        output_path=OUT_CARD_PATH,
        key=key,
    )
    print(f"[ok] {OUT_CARD_PATH}")

    save_locked_asset(
        ref_images=[ref_card_bytes, day7_guide_bytes],
        prompt=day7_prompt,
        template_alpha=day7_alpha,
        output_path=OUT_DAY7_PATH,
        key=key,
    )
    print(f"[ok] {OUT_DAY7_PATH}")

    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "model": MODEL,
                "reference": str(REF_CARD_PATH.relative_to(ROOT)).replace("\\", "/"),
                "outputs": [
                    str(OUT_CARD_PATH.relative_to(ROOT)).replace("\\", "/"),
                    str(OUT_DAY7_PATH.relative_to(ROOT)).replace("\\", "/"),
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
