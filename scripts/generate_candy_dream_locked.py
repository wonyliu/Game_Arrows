#!/usr/bin/env python3
"""Generate candy-dream skin parts with Gemini image model and lock alpha to classic geometry."""

from __future__ import annotations

import argparse
import base64
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import requests
import numpy as np
from PIL import Image


@dataclass(frozen=True)
class PartSpec:
    output_name: str
    base_name: str
    part_label: str
    expression_note: str


PARTS: tuple[PartSpec, ...] = (
    PartSpec("snake_head.png", "snake_head.png", "Head Default", "neutral expression, keep same pose"),
    PartSpec("snake_head_curious.png", "snake_head_curious_r2.png", "Head Curious", "curious expression, keep same face rhythm"),
    PartSpec("snake_head_sleepy.png", "snake_head_sleepy_r2.png", "Head Sleepy", "sleepy expression, same wink/eye structure"),
    PartSpec("snake_head_surprised.png", "snake_head_surprised_r2.png", "Head Surprised", "surprised expression, same mouth/eye emotion"),
    PartSpec("snake_seg_a.png", "snake_seg_a.png", "Segment A", "body segment only, no face"),
    PartSpec("snake_seg_b.png", "snake_seg_b.png", "Segment B", "body segment only, no face"),
    PartSpec("snake_tail_base.png", "snake_tail_base.png", "Tail Base", "tail base connection ring remains same"),
    PartSpec("snake_tail_tip.png", "snake_tail_tip.png", "Tail Tip", "tail tip curvature and end thickness remain same"),
)


def ensure_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("Missing GEMINI_API_KEY / GOOGLE_API_KEY in environment.")
    return key


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def find_alpha_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    alpha = img.getchannel("A")
    return alpha.getbbox() or (0, 0, img.width, img.height)


def fit_rgb_to_base_canvas(base_img: Image.Image, generated_img: Image.Image) -> Image.Image:
    """Resize generated content with premultiplied alpha and lock final alpha to base."""
    base = base_img.convert("RGBA")
    gen = generated_img.convert("RGBA")
    base_bbox = find_alpha_bbox(base)
    gen_bbox = find_alpha_bbox(gen)

    base_w = max(1, base_bbox[2] - base_bbox[0])
    base_h = max(1, base_bbox[3] - base_bbox[1])
    gen_crop = np.array(gen.crop(gen_bbox).convert("RGBA"), dtype=np.float32)
    alpha = gen_crop[..., 3:4] / 255.0
    premult = gen_crop[..., :3] * alpha

    premult_img = Image.fromarray(np.clip(premult, 0, 255).astype(np.uint8), "RGB")
    alpha_img = Image.fromarray(np.clip(alpha[..., 0] * 255.0, 0, 255).astype(np.uint8), "L")

    premult_resized = np.array(premult_img.resize((base_w, base_h), Image.Resampling.LANCZOS), dtype=np.float32)
    alpha_resized = np.array(alpha_img.resize((base_w, base_h), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0
    safe_alpha = np.maximum(alpha_resized[..., None], 1e-5)
    rgb_resized = np.where(alpha_resized[..., None] > 0, premult_resized / safe_alpha, 0)
    rgb_resized = np.clip(rgb_resized, 0, 255).astype(np.uint8)

    rgb_canvas = np.zeros((base.height, base.width, 3), dtype=np.uint8)
    x1, y1, x2, y2 = base_bbox
    rgb_canvas[y1:y2, x1:x2] = rgb_resized

    base_alpha = np.array(base.getchannel("A"), dtype=np.uint8)
    final = np.dstack([rgb_canvas, base_alpha])
    return Image.fromarray(final, "RGBA")


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


def call_model(
    *,
    key: str,
    model: str,
    prompt: str,
    style_png: bytes,
    base_png: bytes,
    timeout_sec: int,
    max_retries: int,
) -> bytes:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/png", "data": b64(style_png)}},
                    {"inline_data": {"mime_type": "image/png", "data": b64(base_png)}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.25,
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
            print(f"[Retry] model call failed, attempt {attempt}/{max_retries}, sleep {sleep_sec}s")
            time.sleep(sleep_sec)


def make_prompt(part: PartSpec) -> str:
    is_head = part.output_name.startswith("snake_head")
    role_note = (
        "This part IS a head. Keep the same eye/mouth expression structure as reference image 2."
        if is_head
        else "This part is NOT a head. Do not draw eyes, mouth, nose, cheeks, ears, or any face features."
    )
    return (
        "Generate ONE transparent PNG snake skin part for a 2D puzzle game.\n"
        "Reference image 1 = strict style bible (white creamy candy snake with colorful jellybean dots).\n"
        "Reference image 2 = strict geometry + expression lock (classic-burrow).\n\n"
        f"Part: {part.output_name} ({part.part_label}).\n"
        f"Expression note: {part.expression_note}.\n\n"
        f"{role_note}\n\n"
        "Hard requirements:\n"
        "- Keep EXACT silhouette/contour from reference image 2.\n"
        "- Keep EXACT canvas size of reference image 2.\n"
        "- Keep same facing direction and center alignment.\n"
        "- Keep same expression category as reference image 2.\n"
        "- Keep background fully transparent.\n"
        "- Color/material must match reference image 1: white-dominant body, soft creamy shading, multicolor candy dots.\n"
        "- Do not tint overall skin blue/purple.\n\n"
        "Hard negatives:\n"
        "- no size change\n"
        "- no shape deformation\n"
        "- no hexagon/honeycomb/faceted pattern\n"
        "- no geometric panel lines\n"
        "- no extra outline rings\n"
        "- no border glow\n"
        "- no neck extension\n"
        "- no props/accessories\n"
        "- no background"
    )


def iter_parts(include: Iterable[str] | None) -> Iterable[PartSpec]:
    if not include:
        return PARTS
    include_set = {x.strip() for x in include if x.strip()}
    return [p for p in PARTS if p.output_name in include_set]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--style-ref", default="temp/skins/candy-dream/style_ref_user_exact.png")
    parser.add_argument("--base-dir", default="assets/design-v4/clean")
    parser.add_argument("--out-dir", default="temp/skins/candy-dream/v3_raw_userref_lock")
    parser.add_argument("--target-dir", default="assets/skins/candy-dream")
    parser.add_argument("--model", default="gemini-2.5-flash-image")
    parser.add_argument("--timeout-sec", type=int, default=240)
    parser.add_argument("--max-retries", type=int, default=5)
    parser.add_argument("--resume", action="store_true", help="Skip parts that already exist in out-dir and target-dir")
    parser.add_argument("--only", nargs="*", help="Optional subset by output filename, e.g. snake_tail_tip.png")
    args = parser.parse_args()

    key = ensure_key()
    style_path = Path(args.style_ref)
    if not style_path.is_file():
        raise FileNotFoundError(f"Style ref not found: {style_path}")

    base_dir = Path(args.base_dir)
    out_dir = Path(args.out_dir)
    target_dir = Path(args.target_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    target_dir.mkdir(parents=True, exist_ok=True)

    style_png = style_path.read_bytes()
    records: list[dict] = []

    for part in iter_parts(args.only):
        base_path = base_dir / part.base_name
        if not base_path.is_file():
            raise FileNotFoundError(f"Base part not found: {base_path}")
        final_path = out_dir / part.output_name
        target_path = target_dir / part.output_name
        if args.resume and final_path.is_file() and target_path.is_file():
            print(f"[Skip] {part.output_name} (already exists)")
            continue
        prompt = make_prompt(part)
        raw_bytes = call_model(
            key=key,
            model=args.model,
            prompt=prompt,
            style_png=style_png,
            base_png=base_path.read_bytes(),
            timeout_sec=args.timeout_sec,
            max_retries=args.max_retries,
        )

        raw_path = out_dir / f"{Path(part.output_name).stem}_raw.png"
        raw_path.write_bytes(raw_bytes)

        base_img = Image.open(base_path).convert("RGBA")
        raw_img = Image.open(raw_path).convert("RGBA")
        final_img = fit_rgb_to_base_canvas(base_img, raw_img)
        final_img.save(final_path)
        final_img.save(target_path)

        records.append(
            {
                "part": part.output_name,
                "base": str(base_path).replace("\\", "/"),
                "raw": str(raw_path).replace("\\", "/"),
                "final": str(final_path).replace("\\", "/"),
                "prompt": prompt,
                "model": args.model,
            }
        )
        print(f"[OK] {part.output_name}")

    manifest = {
        "skinId": "candy-dream",
        "variant": "v5-nano-banana-user-ref-locked",
        "source": "Gemini image generation + strict classic alpha lock",
        "styleRef": str(style_path).replace("\\", "/"),
        "model": args.model,
        "parts": records,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote manifest: {out_dir / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
