#!/usr/bin/env python3
"""Generate reward unlock banner art and remove solid background."""

from __future__ import annotations

import base64
import json
import os
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

from auto_cutout_skin_part import cutout_solid_background


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "assets" / "design-v6" / "combo"
RAW_PATH = OUTPUT_DIR / "reward_unlock_banner_raw.png"
FINAL_PATH = OUTPUT_DIR / "reward_unlock_banner.png"
MANIFEST_PATH = OUTPUT_DIR / "reward_unlock_banner_manifest.json"

MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
SOLID_BG_HEX = "#00FF00"


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


def call_model(*, key: str, prompt: str, timeout_sec: int = 240, max_retries: int = 5) -> bytes:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.35,
            "responseModalities": ["IMAGE", "TEXT"],
        },
    }
    attempt = 0
    while True:
        attempt += 1
        try:
            response = requests.post(url, json=payload, timeout=timeout_sec)
            if response.status_code != 200:
                raise RuntimeError(f"Model request failed ({response.status_code}): {response.text[:700]}")
            return extract_first_image_bytes(response.json())
        except Exception:
            if attempt >= max_retries:
                raise
            sleep_sec = min(12, 2 * attempt)
            print(f"[retry] attempt {attempt}/{max_retries}, sleep {sleep_sec}s")
            time.sleep(sleep_sec)


def save_manifest() -> None:
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "model": MODEL,
                "solidBackground": SOLID_BG_HEX,
                "outputs": [
                    str(RAW_PATH.relative_to(ROOT)).replace("\\", "/"),
                    str(FINAL_PATH.relative_to(ROOT)).replace("\\", "/"),
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def estimate_background_color(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    sample_points = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, 0),
        (width // 2, height - 1),
        (0, height // 2),
        (width - 1, height // 2),
    ]
    pixels = [rgb.getpixel(point) for point in sample_points]
    r = round(sum(p[0] for p in pixels) / len(pixels))
    g = round(sum(p[1] for p in pixels) / len(pixels))
    b = round(sum(p[2] for p in pixels) / len(pixels))
    return (r, g, b)


def main() -> int:
    key = ensure_key()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    prompt = (
        "Create a bold Chinese game banner text image that says exactly: 奖励关达成. "
        "The text must feel highly passionate, explosive, victory style, with intense fiery orange-red-gold effects. "
        "No extra words. No logos. No characters. No icons. "
        f"Use one completely solid background color only: {SOLID_BG_HEX}. "
        "Keep the subject centered with enough padding."
    )

    raw_bytes = call_model(key=key, prompt=prompt)
    RAW_PATH.write_bytes(raw_bytes)
    print(f"[ok] raw saved: {RAW_PATH}")

    raw_img = Image.open(BytesIO(raw_bytes)).convert("RGBA")
    estimated_bg = estimate_background_color(raw_img)
    cutout = cutout_solid_background(
        raw_img,
        bg_color=estimated_bg,
        tolerance=55,
        feather=1.0,
        preserve_input_alpha=True,
    )
    cutout.save(FINAL_PATH)
    print(f"[ok] cutout saved: {FINAL_PATH}")

    save_manifest()
    print(f"[ok] manifest saved: {MANIFEST_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
