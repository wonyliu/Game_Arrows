#!/usr/bin/env python3
"""Generate snake skin parts with Nano Banana + solid background cutout + template alpha lock."""

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
from PIL import Image, ImageFilter

from auto_cutout_skin_part import cutout_solid_background, parse_hex_color


@dataclass(frozen=True)
class PartSpec:
    output_name: str
    label: str
    is_head: bool
    expression_note: str


PARTS: tuple[PartSpec, ...] = (
    PartSpec("snake_head.png", "Head Default", True, "neutral expression, both eyes open"),
    PartSpec("snake_head_curious.png", "Head Curious", True, "curious expression, wink style remains clear"),
    PartSpec("snake_head_sleepy.png", "Head Sleepy", True, "sleepy expression, droopy/closed eye feeling remains clear"),
    PartSpec("snake_head_surprised.png", "Head Surprised", True, "surprised expression, round eye/mouth feeling remains clear"),
    PartSpec("snake_seg_a.png", "Segment A", False, "body segment only, no face"),
    PartSpec("snake_seg_b.png", "Segment B", False, "body segment only, no face"),
    PartSpec("snake_tail_base.png", "Tail Base", False, "tail base connection shape unchanged"),
    PartSpec("snake_tail_tip.png", "Tail Tip", False, "tail tip curve and thickness unchanged"),
)


def ensure_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("Missing GEMINI_API_KEY / GOOGLE_API_KEY in environment.")
    return key


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def find_alpha_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    bbox = img.getchannel("A").getbbox()
    return bbox or (0, 0, img.width, img.height)


def bleed_transparent_rgb(arr_rgba: np.ndarray, passes: int = 4) -> np.ndarray:
    """Fill RGB of transparent pixels with neighbor color to avoid dark fringe on resize."""
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


def fit_rgb_to_template_alpha(template_img: Image.Image, generated_img: Image.Image) -> Image.Image:
    """Resize generated RGB into template alpha bbox, then lock final alpha exactly to template."""
    base = template_img.convert("RGBA")
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
    """Create geometry-only guide image from template alpha."""
    base = base_img.convert("RGBA")
    arr = np.array(base, dtype=np.uint8)
    alpha = arr[..., 3]
    h, w = alpha.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    inside = alpha >= 16
    rgb[inside] = np.array([188, 194, 205], dtype=np.uint8)

    yy = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    xx = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :]
    glow = np.exp(-(((yy - 0.15) / 0.22) ** 2 + ((xx - 0.5) / 0.42) ** 2))
    for c in range(3):
        channel = rgb[..., c].astype(np.float32)
        channel[inside] = np.clip(channel[inside] + glow[inside] * 22, 0, 255)
        rgb[..., c] = channel.astype(np.uint8)

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
        border |= inside & (shifted < 16)
    rgb[border] = np.array([90, 98, 114], dtype=np.uint8)

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


def apply_template_expression_overlay(generated_head: Image.Image, template_head: Image.Image) -> Image.Image:
    """Inject readable template facial cues so tiny gameplay heads keep expression clarity."""
    gen = np.array(generated_head.convert("RGBA"), dtype=np.float32)
    base = np.array(template_head.convert("RGBA"), dtype=np.float32)
    if gen.shape != base.shape:
        base = np.array(template_head.convert("RGBA").resize((gen.shape[1], gen.shape[0]), Image.Resampling.NEAREST), dtype=np.float32)

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
    dark_features &= ~eye_white & ~tongue_like
    eye_white &= ~tongue_like

    out = gen.copy()
    feature_region = dilate_mask(dark_features | eye_white | tongue_like, iterations=6)
    blur_rgb = np.array(generated_head.convert("RGB").filter(ImageFilter.GaussianBlur(radius=3.2)), dtype=np.float32)
    if np.any(feature_region):
        out[feature_region, :3] = out[feature_region, :3] * 0.10 + blur_rgb[feature_region, :3] * 0.90
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
        "contents": [{"role": "user", "parts": parts}],
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


def iter_parts(include: Iterable[str] | None) -> Iterable[PartSpec]:
    if not include:
        return PARTS
    include_set = {x.strip() for x in include if x.strip()}
    return [part for part in PARTS if part.output_name in include_set]


def parse_annotation_json(path: str | None) -> dict:
    if not path:
        return {}
    file_path = Path(path)
    if not file_path.is_file():
        return {}
    try:
        parsed = json.loads(file_path.read_text(encoding="utf-8-sig"))
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def parse_custom_prompts(path: str | None) -> dict[str, str]:
    if not path:
        return {}
    file_path = Path(path)
    if not file_path.is_file():
        return {}
    try:
        parsed = json.loads(file_path.read_text(encoding="utf-8-sig"))
    except Exception:
        return {}
    if not isinstance(parsed, dict):
        return {}
    output: dict[str, str] = {}
    for key, value in parsed.items():
        if not isinstance(key, str) or not isinstance(value, str):
            continue
        key_text = key.strip()
        prompt_text = value.strip()
        if not key_text or not prompt_text:
            continue
        output[key_text] = prompt_text
    return output


def read_template_map(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise FileNotFoundError(f"template map json not found: {path}")
    raw = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(raw, dict):
        raise RuntimeError("template map must be a JSON object")

    normalized: dict[str, str] = {}
    for part in PARTS:
        value = raw.get(part.output_name)
        if not isinstance(value, str) or not value.strip():
            raise RuntimeError(f"template map missing path for {part.output_name}")
        normalized[part.output_name] = value.strip()
    return normalized


def expression_clause(part_name: str) -> str:
    if part_name == "snake_head.png":
        return "Expression strictness: both eyes open, neutral slight frown mouth, no tongue, no wink."
    if part_name == "snake_head_curious.png":
        return "Expression strictness: one eye open + one wink arc, curious smile, no tongue."
    if part_name == "snake_head_sleepy.png":
        return "Expression strictness: sleepy eye mood, heavy eyelids, no tongue."
    if part_name == "snake_head_surprised.png":
        return "Expression strictness: eyes wide open, small open mouth with tongue visible."
    return ""


def make_prompt(
    part: PartSpec,
    *,
    template_skin_id: str,
    solid_bg: str,
    prompt_extra: str,
    global_note: str,
    part_note: str,
    has_style_ref: bool,
    has_annotation_overlay: bool,
) -> str:
    style_line = (
        f"将 {part.output_name} 的颜色和纹理替换成参考图中的样式。"
        if has_style_ref
        else f"未提供材质参考图，请根据“用户附加提示”直接设计 {part.output_name} 的新颜色和纹理。"
    )
    part_line = (
        f"表情保持与模板一致（{part.label}）。"
        if part.is_head
        else "这是身体/尾巴配件，不要添加眼睛嘴巴等脸部元素。"
    )
    overlay_line = "如果有标注图，优先按标注修改。" if has_annotation_overlay else ""
    lines = [
        f"任务：生成 1 张蛇皮肤配件图（{part.output_name}）。",
        "参考图2是洞穴经典该配件的形状模板，必须保持轮廓、比例、朝向完全一致。",
        "参考图3是洞穴经典该配件原图。",
        style_line,
        part_line,
        overlay_line,
        f"背景色为纯色：{solid_bg}。",
        f"全局设计说明：{global_note or '无'}",
        f"部件编辑说明：{part_note or '无'}",
        f"用户附加提示：{prompt_extra or '无'}",
    ]
    return "\n".join([line for line in lines if line])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skin-id", default="new-skin")
    parser.add_argument("--template-skin-id", default="classic-burrow")
    parser.add_argument("--style-ref", default="", help="Optional style reference image path")
    parser.add_argument("--template-map-json", required=True, help="JSON map {outputName: templatePartPath}")
    parser.add_argument("--annotation-json", default="", help="JSON with global note and per-part notes/overlay")
    parser.add_argument("--out-dir", required=True, help="Output directory for generated assets")
    parser.add_argument("--target-dir", default="", help="Optional final destination directory")
    parser.add_argument("--model", default="gemini-2.5-flash-image")
    parser.add_argument("--prompt-extra", default="")
    parser.add_argument("--solid-bg", default="#00ff00")
    parser.add_argument("--bg-tolerance", type=int, default=42)
    parser.add_argument("--bg-feather", type=float, default=1.0)
    parser.add_argument("--timeout-sec", type=int, default=240)
    parser.add_argument("--max-retries", type=int, default=5)
    parser.add_argument("--only", nargs="*", help="Optional subset by output filename")
    parser.add_argument("--custom-prompts-json", default="", help="Optional JSON map of custom prompts by part filename")
    parser.add_argument("--disable-expression-overlay", action="store_true")
    args = parser.parse_args()

    key = ensure_key()
    style_path = Path(args.style_ref) if args.style_ref else None
    if style_path and not style_path.is_file():
        raise FileNotFoundError(f"style reference not found: {style_path}")

    template_map = read_template_map(Path(args.template_map_json))
    annotation_payload = parse_annotation_json(args.annotation_json)
    annotation_parts = annotation_payload.get("parts") if isinstance(annotation_payload.get("parts"), dict) else {}
    global_note = annotation_payload.get("globalNote") if isinstance(annotation_payload.get("globalNote"), str) else ""
    custom_prompts = parse_custom_prompts(args.custom_prompts_json)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    target_dir = Path(args.target_dir) if args.target_dir else None
    if target_dir:
        target_dir.mkdir(parents=True, exist_ok=True)

    solid_bg = args.solid_bg.strip() or "#00ff00"
    bg_color = parse_hex_color(solid_bg)
    style_png = style_path.read_bytes() if style_path else None
    records: list[dict] = []

    for part in iter_parts(args.only):
        template_path = Path(template_map[part.output_name])
        if not template_path.is_file():
            raise FileNotFoundError(f"template part not found: {template_path}")
        part_annotation = annotation_parts.get(part.output_name) if isinstance(annotation_parts.get(part.output_name), dict) else {}
        part_note = part_annotation.get("note") if isinstance(part_annotation.get("note"), str) else ""
        overlay_path_text = part_annotation.get("overlayPath") if isinstance(part_annotation.get("overlayPath"), str) else ""
        overlay_path = Path(overlay_path_text) if overlay_path_text else None
        overlay_exists = bool(overlay_path and overlay_path.is_file())

        template_img = Image.open(template_path).convert("RGBA")
        geom_lock = make_geometry_lock_image(template_img)
        geom_lock_path = out_dir / f"{Path(part.output_name).stem}_geom_lock.png"
        geom_lock.save(geom_lock_path)

        prompt = custom_prompts.get(part.output_name)
        if not isinstance(prompt, str) or not prompt.strip():
            prompt = make_prompt(
                part,
                template_skin_id=args.template_skin_id,
                solid_bg=solid_bg,
                prompt_extra=args.prompt_extra,
                global_note=global_note,
                part_note=part_note,
                has_style_ref=style_png is not None,
                has_annotation_overlay=overlay_exists,
            )
        else:
            prompt = prompt.strip()
        image_blobs = []
        if style_png is not None:
            image_blobs.append(style_png)
        image_blobs.extend([geom_lock_path.read_bytes(), template_path.read_bytes()])
        if overlay_exists and overlay_path:
            image_blobs.append(overlay_path.read_bytes())

        raw_bytes = call_model(
            key=key,
            model=args.model,
            prompt=prompt,
            image_blobs=image_blobs,
            timeout_sec=args.timeout_sec,
            max_retries=args.max_retries,
        )

        raw_path = out_dir / f"{Path(part.output_name).stem}_raw.png"
        cut_path = out_dir / f"{Path(part.output_name).stem}_cutout.png"
        final_path = out_dir / part.output_name
        raw_path.write_bytes(raw_bytes)

        raw_img = Image.open(raw_path).convert("RGBA")
        cut_img = cutout_solid_background(
            raw_img,
            bg_color=bg_color,
            tolerance=max(0, min(441, args.bg_tolerance)),
            feather=max(0.0, args.bg_feather),
            preserve_input_alpha=True,
        )
        cut_img.save(cut_path)

        final_img = fit_rgb_to_template_alpha(template_img, cut_img)
        if part.is_head and not args.disable_expression_overlay:
            final_img = apply_template_expression_overlay(final_img, template_img)

        base_alpha = np.array(template_img.getchannel("A"), dtype=np.uint8)
        final_alpha = np.array(final_img.getchannel("A"), dtype=np.uint8)
        if not np.array_equal(base_alpha, final_alpha):
            raise RuntimeError(f"alpha lock failed for {part.output_name}")

        final_img.save(final_path)
        target_path = None
        if target_dir:
            target_path = target_dir / part.output_name
            final_img.save(target_path)

        records.append(
            {
                "part": part.output_name,
                "template": str(template_path).replace("\\", "/"),
                "raw": str(raw_path).replace("\\", "/"),
                "cutout": str(cut_path).replace("\\", "/"),
                "final": str(final_path).replace("\\", "/"),
                "target": str(target_path).replace("\\", "/") if target_path else None,
                "prompt": prompt,
                "overlay": str(overlay_path).replace("\\", "/") if overlay_exists and overlay_path else "",
                "model": args.model,
            }
        )
        print(f"[OK] {part.output_name}")

    manifest = {
        "skinId": args.skin_id,
        "templateSkinId": args.template_skin_id,
        "model": args.model,
        "styleRef": str(style_path).replace("\\", "/") if style_path else "",
        "solidBackground": solid_bg,
        "parts": records,
    }
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] wrote manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
