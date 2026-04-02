#!/usr/bin/env python3
"""Generate jelly-cube skin with Gemini image model and strict classic silhouette lock."""

from __future__ import annotations

import argparse
import base64
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFilter


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


def bleed_transparent_rgb(arr_rgba: np.ndarray, passes: int = 3) -> np.ndarray:
    """Fill RGB for transparent pixels using neighbor colors to prevent black fringe after alpha lock."""
    out = arr_rgba.copy()
    h, w = out.shape[:2]
    for _ in range(max(1, passes)):
        data = out.copy()
        changed = False
        for y in range(h):
            for x in range(w):
                if data[y, x, 3] > 0:
                    continue
                r = g = b = count = 0
                y1 = max(0, y - 1)
                y2 = min(h - 1, y + 1)
                x1 = max(0, x - 1)
                x2 = min(w - 1, x + 1)
                for ny in range(y1, y2 + 1):
                    for nx in range(x1, x2 + 1):
                        if nx == x and ny == y:
                            continue
                        if data[ny, nx, 3] <= 0:
                            continue
                        r += int(data[ny, nx, 0])
                        g += int(data[ny, nx, 1])
                        b += int(data[ny, nx, 2])
                        count += 1
                if count > 0:
                    out[y, x, 0] = r // count
                    out[y, x, 1] = g // count
                    out[y, x, 2] = b // count
                    changed = True
        if not changed:
            break
    return out


def fit_rgb_to_base_canvas(base_img: Image.Image, generated_img: Image.Image) -> Image.Image:
    """Resize generated content with premultiplied alpha and lock final alpha to base silhouette."""
    base = base_img.convert("RGBA")
    gen = generated_img.convert("RGBA")
    base_bbox = find_alpha_bbox(base)
    gen_bbox = find_alpha_bbox(gen)

    base_w = max(1, base_bbox[2] - base_bbox[0])
    base_h = max(1, base_bbox[3] - base_bbox[1])
    gen_crop = np.array(gen.crop(gen_bbox).convert("RGBA"), dtype=np.uint8)
    gen_crop = bleed_transparent_rgb(gen_crop, passes=4)
    rgb_resized = np.array(
        Image.fromarray(gen_crop[..., :3], "RGB").resize((base_w, base_h), Image.Resampling.LANCZOS),
        dtype=np.uint8,
    )

    rgb_canvas = np.zeros((base.height, base.width, 3), dtype=np.uint8)
    x1, y1, x2, y2 = base_bbox
    rgb_canvas[y1:y2, x1:x2] = rgb_resized

    base_alpha = np.array(base.getchannel("A"), dtype=np.uint8)
    final = np.dstack([rgb_canvas, base_alpha])
    return Image.fromarray(final, "RGBA")


def make_geometry_lock_image(base_img: Image.Image) -> Image.Image:
    """Build geometry-only lock image: keeps alpha silhouette, removes internal texture hints."""
    base = base_img.convert("RGBA")
    arr = np.array(base, dtype=np.uint8)
    alpha = arr[..., 3]
    h, w = alpha.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    inside = alpha >= 16
    rgb[inside] = np.array([188, 194, 205], dtype=np.uint8)

    # Add subtle inner gradient to communicate volume but not pattern.
    yy = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    xx = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :]
    glow = np.exp(-(((yy - 0.12) / 0.22) ** 2 + ((xx - 0.5) / 0.42) ** 2))
    for c in range(3):
        channel = rgb[..., c].astype(np.float32)
        channel[inside] = np.clip(channel[inside] + glow[inside] * 26, 0, 255)
        rgb[..., c] = channel.astype(np.uint8)

    # Keep a thin dark border for silhouette readability.
    border = np.zeros_like(alpha, dtype=bool)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        shifted = np.zeros_like(alpha)
        if dy == -1:
            shifted[:-1, :] = alpha[1:, :]
        elif dy == 1:
            shifted[1:, :] = alpha[:-1, :]
        elif dx == -1:
            shifted[:, :-1] = alpha[:, 1:]
        elif dx == 1:
            shifted[:, 1:] = alpha[:, :-1]
        border |= (inside & (shifted < 16))
    rgb[border] = np.array([92, 99, 114], dtype=np.uint8)

    out = np.dstack([rgb, alpha])
    return Image.fromarray(out, "RGBA")


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


def erode_mask(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    out = mask.copy()
    for _ in range(max(0, iterations)):
        m = out
        up = np.zeros_like(m)
        down = np.zeros_like(m)
        left = np.zeros_like(m)
        right = np.zeros_like(m)
        up[1:, :] = m[:-1, :]
        down[:-1, :] = m[1:, :]
        left[:, 1:] = m[:, :-1]
        right[:, :-1] = m[:, 1:]
        out = m & up & down & left & right
    return out


def dilate_mask(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    out = mask.copy()
    for _ in range(max(0, iterations)):
        m = out
        up = np.zeros_like(m)
        down = np.zeros_like(m)
        left = np.zeros_like(m)
        right = np.zeros_like(m)
        up[1:, :] = m[:-1, :]
        down[:-1, :] = m[1:, :]
        left[:, 1:] = m[:, :-1]
        right[:, :-1] = m[:, 1:]
        out = m | up | down | left | right
    return out


def apply_classic_expression_overlay(generated_head: Image.Image, classic_head: Image.Image) -> Image.Image:
    """Inject strong expression cues from classic head (eyes/mouth/eyelids/tongue) into generated head RGB."""
    gen = np.array(generated_head.convert("RGBA"), dtype=np.float32)
    base = np.array(classic_head.convert("RGBA"), dtype=np.float32)
    if gen.shape != base.shape:
        base = np.array(classic_head.convert("RGBA").resize((gen.shape[1], gen.shape[0]), Image.Resampling.NEAREST), dtype=np.float32)

    alpha = base[..., 3] >= 16
    inner = erode_mask(alpha, iterations=6)
    rgb = base[..., :3] / 255.0
    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]
    _, sat, _ = to_hsv(rgb)
    luma = r * 0.2126 + g * 0.7152 + b * 0.0722

    eye_white = inner & (luma > 0.76) & (sat < 0.24)
    dark_features = inner & (luma < 0.34) & ((sat < 0.45) | (luma < 0.24))
    tongue_like = inner & (sat > 0.30) & (r > g * 1.12) & (r > b * 1.04) & (luma > 0.15)

    eye_white = dilate_mask(eye_white, iterations=1)
    dark_features = dilate_mask(dark_features, iterations=1)
    tongue_like = dilate_mask(tongue_like, iterations=1)

    # Priority: accent > eye white > dark lines
    dark_features &= ~eye_white & ~tongue_like
    eye_white &= ~tongue_like

    out = gen.copy()
    gen_rgb_norm = np.clip(gen[..., :3] / 255.0, 0.0, 1.0)
    _, gen_sat, _ = to_hsv(gen_rgb_norm)
    gen_luma = (
        gen_rgb_norm[..., 0] * 0.2126
        + gen_rgb_norm[..., 1] * 0.7152
        + gen_rgb_norm[..., 2] * 0.0722
    )

    # Remove model-drawn facial marks in the expression area before injecting classic features.
    feature_region = dilate_mask(dark_features | eye_white | tongue_like, iterations=6)
    blur_rgb = np.array(generated_head.convert("RGB").filter(ImageFilter.GaussianBlur(radius=3.2)), dtype=np.float32)
    if np.any(feature_region):
        out[feature_region, :3] = out[feature_region, :3] * 0.10 + blur_rgb[feature_region, :3] * 0.90

    # Remove unexpected dark/white marks outside classic feature slots to avoid double eyes/mouth.
    h, w = alpha.shape
    yy = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    xx = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :]
    face_zone = inner & (yy > 0.16) & (yy < 0.88) & (xx > 0.10) & (xx < 0.90)
    allowed_dark = dilate_mask(dark_features, iterations=2)
    allowed_white = dilate_mask(eye_white, iterations=1)
    allowed_accent = dilate_mask(tongue_like, iterations=2)
    dark_like = (gen_luma < 0.44) & (gen_sat < 0.66)
    white_like = (gen_luma > 0.74) & (gen_sat < 0.30)
    unexpected_dark = face_zone & dark_like & ~allowed_dark & ~allowed_accent
    unexpected_white = face_zone & white_like & ~allowed_white
    if np.any(unexpected_dark):
        out[unexpected_dark, :3] = blur_rgb[unexpected_dark, :3]
    if np.any(unexpected_white):
        out[unexpected_white, :3] = blur_rgb[unexpected_white, :3]

    if np.any(dark_features):
        out[dark_features, :3] = np.array([18.0, 30.0, 48.0], dtype=np.float32)
    if np.any(eye_white):
        out[eye_white, :3] = np.array([248.0, 251.0, 255.0], dtype=np.float32)
    if np.any(tongue_like):
        out[tongue_like, :3] = np.array([196.0, 88.0, 132.0], dtype=np.float32)

    out[..., 3] = gen[..., 3]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


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
    image_blobs: list[bytes],
    timeout_sec: int,
    max_retries: int,
) -> bytes:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    parts = [{"text": prompt}]
    for blob in image_blobs:
        parts.append({"inline_data": {"mime_type": "image/png", "data": b64(blob)}})
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
            print(f"[Retry] model call failed, attempt {attempt}/{max_retries}, sleep {sleep_sec}s")
            time.sleep(sleep_sec)


def create_fallback_style_ref(path: Path) -> None:
    """Create a local jelly-cube style sheet only when explicitly allowed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    width, height = 960, 960
    canvas = Image.new("RGBA", (width, height), (248, 248, 248, 255))
    draw = ImageDraw.Draw(canvas, "RGBA")

    colors = [
        (244, 55, 49),
        (188, 232, 39),
        (167, 162, 240),
        (247, 162, 40),
        (86, 221, 180),
        (238, 157, 217),
        (248, 220, 63),
        (91, 200, 239),
        (235, 227, 198),
    ]

    def draw_cube(cx: int, cy: int, size: int, rgb: tuple[int, int, int]) -> None:
        r = size // 5
        x1 = cx - size // 2
        y1 = cy - size // 2
        x2 = cx + size // 2
        y2 = cy + size // 2
        base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        base_draw = ImageDraw.Draw(base, "RGBA")
        base_draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=(*rgb, 255))
        base_draw.ellipse((size * 0.10, size * 0.08, size * 0.74, size * 0.22), fill=(255, 255, 255, 150))
        base_draw.pieslice((size * 0.00, size * 0.44, size * 0.95, size * 1.16), 180, 320, fill=(255, 255, 255, 46))
        base_draw.pieslice((size * 0.45, size * 0.38, size * 1.08, size * 1.10), 130, 290, fill=(255, 255, 255, 32))
        base_draw.ellipse((size * 0.78, size * 0.10, size * 0.90, size * 0.20), fill=(255, 255, 255, 180))
        base_draw.ellipse((size * 0.14, size * 0.20, size * 0.22, size * 0.27), fill=(255, 255, 255, 95))
        base_draw.ellipse((size * 0.19, size * 0.24, size * 0.26, size * 0.30), fill=(255, 255, 255, 70))
        canvas.alpha_composite(base, (x1, y1))
        draw.rounded_rectangle((x1, y1, x2, y2), radius=r, outline=(255, 255, 255, 38), width=4)

    gap_x = width // 3
    gap_y = height // 3
    idx = 0
    for row in range(3):
        for col in range(3):
            cx = gap_x * col + gap_x // 2
            cy = gap_y * row + gap_y // 2
            draw_cube(cx, cy, 220, colors[idx])
            idx += 1

    canvas.save(path)


def expression_clause(part_name: str) -> str:
    if part_name == "snake_head.png":
        return (
            "Expression strictness (default): both eyes open, neutral slight frown mouth, no tongue, no wink, no closed eyelids."
        )
    if part_name == "snake_head_curious.png":
        return (
            "Expression strictness (curious): left eye fully open, right eye wink/closed arc, subtle curious smile, no tongue."
        )
    if part_name == "snake_head_sleepy.png":
        return (
            "Expression strictness (sleepy): both eyes heavy/droopy half-closed, sleepy mouth, optional tiny Z mark, no tongue."
        )
    if part_name == "snake_head_surprised.png":
        return (
            "Expression strictness (surprised): both eyes wide open and round, small open O-mouth with tongue visible."
        )
    return ""


def make_prompt(part: PartSpec, use_style_anchor: bool, use_expression_anchor: bool) -> str:
    is_head = part.output_name.startswith("snake_head")
    role_note = (
        "This part IS a head. Keep the exact same expression class as reference image 2. "
        "Do not change skull contour, eye/mouth placement rhythm, or chin shape."
        if is_head
        else "This part is NOT a head. Do not draw eyes, mouth, nose, cheeks, ears, or any face features."
    )
    anchor_note = (
        "Reference image 3 is the generated style anchor head. Keep the same material language, gloss behavior, "
        "surface softness, and base hue family."
        if use_style_anchor
        else "Use reference image 1 as primary style anchor."
    )
    expression_note = (
        "Reference image 3 is classic expression anchor. Preserve the exact facial topology: eye whites/pupils/eyelids,"
        " nose dots, mouth curve, and tongue (if present). Do not simplify into tiny dot eyes."
        if use_expression_anchor
        else ""
    )
    part_expr_clause = expression_clause(part.output_name)
    return (
        "Design ONE transparent PNG snake skin part for a 2D snake puzzle game.\n"
        "Reference image 1 = style board (jelly cube icon style).\n"
        "Reference image 2 = strict geometry lock (silhouette-only base part).\n"
        f"{expression_note}\n"
        f"{anchor_note}\n\n"
        f"Part: {part.output_name} ({part.part_label}).\n"
        f"Expression note: {part.expression_note}.\n\n"
        f"{part_expr_clause}\n\n"
        f"{role_note}\n\n"
        "Theme and style requirements:\n"
        "- Glossy jelly-cube material.\n"
        "- Rounded soft volume, translucent inner curved swirls, bright top specular highlights.\n"
        "- Keep asset source hue stable in cool cyan/teal-blue jelly family for all parts.\n"
        "- Keep outlines and face readability at gameplay scale; expressions must be obvious at small size.\n"
        "- Keep same painting language for head/body/tail; they must look like one coherent set.\n"
        "- Keep edge color integrated with body (no thick white ring around silhouette).\n"
        "- Transparent background.\n"
        "- Keep value structure robust for later in-game hue variants.\n\n"
        "Hard requirements:\n"
        "- Keep EXACT silhouette and contour from reference image 2.\n"
        "- Keep EXACT canvas size of reference image 2.\n"
        "- Keep same facing direction and center alignment.\n"
        "- Ignore internal texture/color of reference image 2; use it for geometry lock only.\n"
        "- Do not add external protrusions.\n\n"
        "Hard negatives:\n"
        "- no size change\n"
        "- no shape deformation\n"
        "- no long neck\n"
        "- no extra outline rings\n"
        "- no white border ring\n"
        "- no hexagon/honeycomb/faceted panel pattern\n"
        "- no polygon crystal texture\n"
        "- no accessories\n"
        "- no background\n"
        "- no tiny minimalist dot-face replacement for classic expressions\n"
        "- no random per-part hue switching (do not make one part red and another green)"
    )


def iter_parts(include: Iterable[str] | None) -> Iterable[PartSpec]:
    if not include:
        return PARTS
    include_set = {x.strip() for x in include if x.strip()}
    return [p for p in PARTS if p.output_name in include_set]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--style-ref", default="temp/skins/jelly-cube/style_ref_cube_grid.png")
    parser.add_argument("--base-dir", default="assets/design-v4/clean")
    parser.add_argument("--out-dir", default="temp/skins/jelly-cube/v2_nano_raw")
    parser.add_argument("--target-dir", default="assets/skins/jelly-cube")
    parser.add_argument("--model", default="gemini-2.5-flash-image")
    parser.add_argument("--timeout-sec", type=int, default=240)
    parser.add_argument("--max-retries", type=int, default=5)
    parser.add_argument("--allow-fallback-style-ref", action="store_true")
    parser.add_argument("--apply-expression-overlay", action="store_true")
    parser.add_argument("--resume", action="store_true", help="Skip parts that already exist in out-dir and target-dir")
    parser.add_argument("--only", nargs="*", help="Optional subset by output filename, e.g. snake_tail_tip.png")
    args = parser.parse_args()

    key = ensure_key()
    style_path = Path(args.style_ref)
    if not style_path.is_file():
        if not args.allow_fallback_style_ref:
            raise FileNotFoundError(
                f"Style ref not found: {style_path}. "
                "Provide the user reference image path or pass --allow-fallback-style-ref explicitly."
            )
        create_fallback_style_ref(style_path)
        print(f"[WARN] created fallback style ref: {style_path}")

    base_dir = Path(args.base_dir)
    out_dir = Path(args.out_dir)
    target_dir = Path(args.target_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    target_dir.mkdir(parents=True, exist_ok=True)

    style_png = style_path.read_bytes()
    anchor_head_path = out_dir / "style_anchor_head.png"
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

        use_anchor = anchor_head_path.is_file() and part.output_name != "snake_head.png"
        use_expression_anchor = part.output_name.startswith("snake_head")
        prompt = make_prompt(part, use_style_anchor=use_anchor, use_expression_anchor=use_expression_anchor)
        base_img = Image.open(base_path).convert("RGBA")
        geom_lock_img = make_geometry_lock_image(base_img)
        geom_lock_path = out_dir / f"{Path(part.output_name).stem}_geom_lock.png"
        geom_lock_img.save(geom_lock_path)
        image_blobs = [style_png, geom_lock_path.read_bytes()]
        if use_expression_anchor:
            image_blobs.append(base_path.read_bytes())
        if use_anchor:
            image_blobs.append(anchor_head_path.read_bytes())

        raw_bytes = call_model(
            key=key,
            model=args.model,
            prompt=prompt,
            image_blobs=image_blobs,
            timeout_sec=args.timeout_sec,
            max_retries=args.max_retries,
        )

        raw_path = out_dir / f"{Path(part.output_name).stem}_raw.png"
        raw_path.write_bytes(raw_bytes)

        raw_img = Image.open(raw_path).convert("RGBA")
        final_img = fit_rgb_to_base_canvas(base_img, raw_img)
        if args.apply_expression_overlay and part.output_name.startswith("snake_head"):
            final_img = apply_classic_expression_overlay(final_img, base_img)
        final_img.save(final_path)
        final_img.save(target_path)

        if part.output_name == "snake_head.png":
            final_img.save(anchor_head_path)

        records.append(
            {
                "part": part.output_name,
                "base": str(base_path).replace("\\", "/"),
                "raw": str(raw_path).replace("\\", "/"),
                "final": str(final_path).replace("\\", "/"),
                "prompt": prompt,
                "model": args.model,
                "styleAnchorUsed": use_anchor,
            }
        )
        print(f"[OK] {part.output_name}")

    manifest = {
        "skinId": "jelly-cube",
        "variant": "v2-nano-jelly-cube-locked",
        "source": "Gemini image generation (style-board + classic geometry + style-anchor head) + strict alpha lock",
        "styleRef": str(style_path).replace("\\", "/"),
        "model": args.model,
        "parts": records,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote manifest: {out_dir / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
