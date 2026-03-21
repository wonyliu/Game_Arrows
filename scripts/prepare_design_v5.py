from __future__ import annotations

import json
import argparse
from collections import deque
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / 'temp' / 'design-v5' / 'raw'
OUT_DIR = PROJECT_ROOT / 'assets' / 'design-v5' / 'clean'
MANIFEST_PATH = PROJECT_ROOT / 'assets' / 'design-v5' / 'manifest.json'


FALLBACK_SLOTS = {
    'home.background': 'assets/design-v3/clean/ui_app_bg.png',
    'surface.panel': 'assets/design-v3/clean/ui_panel.png',
    'button.primary': 'assets/design-v3/clean/ui_button.png',
    'card.feature': 'assets/design-v3/clean/ui_item_button.png',
    'icon.home': 'assets/design-v2/clean/icon_home.png',
    'icon.settings': 'assets/design-v2/clean/icon_settings.png',
    'icon.leaderboard': 'assets/design-v2/clean/icon_rank.png',
    'icon.skins': 'assets/design-v2/clean/icon_theme.png',
    'icon.checkin': 'assets/design-v2/clean/icon_gift.png',
    'icon.exit': 'assets/design-v2/clean/icon_lock.png',
    'icon.coin': 'assets/design-v2/clean/icon_coin.png',
    'icon.energy': 'assets/design-v2/clean/icon_energy.png'
}


def is_likely_bg(r: int, g: int, b: int, a: int) -> bool:
    if a < 10:
        return True
    mx = max(r, g, b)
    mn = min(r, g, b)
    delta = mx - mn
    avg = (r + g + b) / 3.0
    return delta <= 26 and 145 <= avg <= 252


def _quantize_checker_key(r: int, g: int, b: int) -> tuple[int, int, int]:
    return ((r // 8) * 8, (g // 8) * 8, (b // 8) * 8)


def remove_checkerboard_pixels(image: Image.Image, aggressive_matte: bool = False) -> Image.Image:
    """Remove common generated checkerboard fake-transparency pixels."""
    rgba = image.convert('RGBA')
    width, height = rgba.size
    data = bytearray(rgba.tobytes())
    pixel_count = width * height

    neutral_counter: Counter[tuple[int, int, int]] = Counter()
    opaque_count = 0
    all_counter: Counter[tuple[int, int, int]] = Counter()
    for i in range(pixel_count):
        o = i * 4
        r, g, b, a = data[o], data[o + 1], data[o + 2], data[o + 3]
        if a < 8:
            continue
        opaque_count += 1
        q = _quantize_checker_key(r, g, b)
        all_counter[q] += 1
        if max(abs(r - g), abs(g - b), abs(r - b)) <= 10:
            avg = (r + g + b) // 3
            if 168 <= avg <= 248:
                neutral_counter[q] += 1

    def remove_color_matte(target: tuple[int, int, int], tol: int) -> int:
        removed_local = 0
        tr, tg, tb = target
        for idx in range(pixel_count):
            off = idx * 4
            r, g, b, a = data[off], data[off + 1], data[off + 2], data[off + 3]
            if a < 8:
                continue
            if abs(r - tr) <= tol and abs(g - tg) <= tol and abs(b - tb) <= tol:
                data[off + 3] = 0
                removed_local += 1
        return removed_local

    removed = 0

    if aggressive_matte and opaque_count >= int(pixel_count * 0.95):
        neutral_any = 0
        for i in range(pixel_count):
            o = i * 4
            r, g, b, a = data[o], data[o + 1], data[o + 2], data[o + 3]
            if a < 8:
                continue
            if max(abs(r - g), abs(g - b), abs(r - b)) <= 14:
                neutral_any += 1

        if neutral_any >= int(pixel_count * 0.35):
            for i in range(pixel_count):
                o = i * 4
                r, g, b, a = data[o], data[o + 1], data[o + 2], data[o + 3]
                if a < 8:
                    continue
                if max(abs(r - g), abs(g - b), abs(r - b)) <= 14:
                    avg = (r + g + b) // 3
                    if 24 <= avg <= 248:
                        data[o + 3] = 0
                        removed += 1

    if aggressive_matte and opaque_count >= int(pixel_count * 0.99) and all_counter:
        dominant_color, dominant_count = all_counter.most_common(1)[0]
        dr, dg, db = dominant_color
        avg = (dr + dg + db) // 3
        if dominant_count >= int(pixel_count * 0.22) and max(abs(dr - dg), abs(dg - db), abs(dr - db)) <= 12 and avg >= 200:
            removed += remove_color_matte(dominant_color, 22)

    candidates = []
    min_pixels = max(600, int(pixel_count * 0.01))
    for color, count in neutral_counter.items():
        if count >= min_pixels:
            candidates.append((color, count))

    candidates.sort(key=lambda item: item[1], reverse=True)
    checker_colors = [item[0] for item in candidates[:2]]

    def near(c: tuple[int, int, int], t: tuple[int, int, int], tol: int = 16) -> bool:
        return abs(c[0] - t[0]) <= tol and abs(c[1] - t[1]) <= tol and abs(c[2] - t[2]) <= tol

    if len(checker_colors) >= 2:
        for i in range(pixel_count):
            o = i * 4
            r, g, b, a = data[o], data[o + 1], data[o + 2], data[o + 3]
            if a < 8:
                continue
            pix = (r, g, b)
            if near(pix, checker_colors[0]) or near(pix, checker_colors[1]):
                data[o + 3] = 0
                removed += 1

    matte_like = 0
    color_counter: Counter[tuple[int, int, int]] = Counter()
    for i in range(pixel_count):
        o = i * 4
        r, g, b, a = data[o], data[o + 1], data[o + 2], data[o + 3]
        if a < 8:
            continue
        key = _quantize_checker_key(r, g, b)
        color_counter[key] += 1
        if max(abs(r - g), abs(g - b), abs(r - b)) <= 12:
            avg = (r + g + b) // 3
            if 175 <= avg <= 248:
                matte_like += 1

    if matte_like >= int(pixel_count * 0.18):
        for i in range(pixel_count):
            o = i * 4
            r, g, b, a = data[o], data[o + 1], data[o + 2], data[o + 3]
            if a < 8:
                continue
            if max(abs(r - g), abs(g - b), abs(r - b)) <= 12:
                avg = (r + g + b) // 3
                if 175 <= avg <= 248:
                    data[o + 3] = 0
                    removed += 1

    if color_counter:
        dominant_color, dominant_count = color_counter.most_common(1)[0]
        dr, dg, db = dominant_color
        dominant_avg = (dr + dg + db) // 3
        if dominant_count >= int(pixel_count * 0.2) and max(abs(dr - dg), abs(dg - db), abs(dr - db)) <= 10 and dominant_avg >= 220:
            for i in range(pixel_count):
                o = i * 4
                r, g, b, a = data[o], data[o + 1], data[o + 2], data[o + 3]
                if a < 8:
                    continue
                if abs(r - dr) <= 16 and abs(g - dg) <= 16 and abs(b - db) <= 16:
                    data[o + 3] = 0
                    removed += 1

    if removed < max(500, int(pixel_count * 0.005)):
        return rgba

    return Image.frombytes('RGBA', (width, height), bytes(data))


def remove_background_and_keep_main_component(image: Image.Image) -> Image.Image:
    image = image.convert('RGBA')
    width, height = image.size
    data = bytearray(image.tobytes())
    original_data = bytearray(data)
    pixel_count = width * height

    bg = bytearray(pixel_count)
    queue: deque[int] = deque()

    def to_idx(x: int, y: int) -> int:
        return y * width + x

    def off(i: int) -> int:
        return i * 4

    def enqueue_if_bg(x: int, y: int) -> None:
        i = to_idx(x, y)
        if bg[i]:
            return
        o = off(i)
        r, g, b, a = data[o], data[o + 1], data[o + 2], data[o + 3]
        if is_likely_bg(r, g, b, a):
            bg[i] = 1
            queue.append(i)

    for x in range(width):
        enqueue_if_bg(x, 0)
        enqueue_if_bg(x, height - 1)
    for y in range(height):
        enqueue_if_bg(0, y)
        enqueue_if_bg(width - 1, y)

    while queue:
        i = queue.popleft()
        x = i % width
        y = i // width

        if x > 0:
            enqueue_if_bg(x - 1, y)
        if x < width - 1:
            enqueue_if_bg(x + 1, y)
        if y > 0:
            enqueue_if_bg(x, y - 1)
        if y < height - 1:
            enqueue_if_bg(x, y + 1)

    for i in range(pixel_count):
        if bg[i]:
            data[off(i) + 3] = 0

    def opaque(i: int) -> bool:
        return data[off(i) + 3] > 12

    visited = bytearray(pixel_count)
    keep = bytearray(pixel_count)
    best_seed = -1
    best_size = 0

    for i in range(pixel_count):
        if visited[i] or not opaque(i):
            continue

        q: deque[int] = deque([i])
        visited[i] = 1
        comp_size = 0

        while q:
            j = q.popleft()
            comp_size += 1
            x = j % width
            y = j // width

            if x > 0:
                left = j - 1
                if not visited[left] and opaque(left):
                    visited[left] = 1
                    q.append(left)
            if x < width - 1:
                right = j + 1
                if not visited[right] and opaque(right):
                    visited[right] = 1
                    q.append(right)
            if y > 0:
                up = j - width
                if not visited[up] and opaque(up):
                    visited[up] = 1
                    q.append(up)
            if y < height - 1:
                down = j + width
                if not visited[down] and opaque(down):
                    visited[down] = 1
                    q.append(down)

        if comp_size > best_size:
            best_size = comp_size
            best_seed = i

    if best_seed >= 0:
        q: deque[int] = deque([best_seed])
        keep[best_seed] = 1
        while q:
            j = q.popleft()
            x = j % width
            y = j // width

            if x > 0:
                left = j - 1
                if not keep[left] and opaque(left):
                    keep[left] = 1
                    q.append(left)
            if x < width - 1:
                right = j + 1
                if not keep[right] and opaque(right):
                    keep[right] = 1
                    q.append(right)
            if y > 0:
                up = j - width
                if not keep[up] and opaque(up):
                    keep[up] = 1
                    q.append(up)
            if y < height - 1:
                down = j + width
                if not keep[down] and opaque(down):
                    keep[down] = 1
                    q.append(down)

    for i in range(pixel_count):
        if not keep[i]:
            data[off(i) + 3] = 0
        elif data[off(i) + 3] < 72:
            data[off(i) + 3] = 0

    # Fill tiny transparent holes inside the kept component to avoid ragged edges.
    trans_visited = bytearray(pixel_count)
    hole_limit = max(12, int(pixel_count * 0.00015))
    for i in range(pixel_count):
        if trans_visited[i] or data[off(i) + 3] > 0:
            continue

        q: deque[int] = deque([i])
        trans_visited[i] = 1
        hole: list[int] = []
        touches_boundary = False

        while q:
            j = q.popleft()
            hole.append(j)
            x = j % width
            y = j // width
            if x == 0 or y == 0 or x == width - 1 or y == height - 1:
                touches_boundary = True

            if x > 0:
                left = j - 1
                if not trans_visited[left] and data[off(left) + 3] == 0:
                    trans_visited[left] = 1
                    q.append(left)
            if x < width - 1:
                right = j + 1
                if not trans_visited[right] and data[off(right) + 3] == 0:
                    trans_visited[right] = 1
                    q.append(right)
            if y > 0:
                up = j - width
                if not trans_visited[up] and data[off(up) + 3] == 0:
                    trans_visited[up] = 1
                    q.append(up)
            if y < height - 1:
                down = j + width
                if not trans_visited[down] and data[off(down) + 3] == 0:
                    trans_visited[down] = 1
                    q.append(down)

        if touches_boundary or len(hole) > hole_limit:
            continue

        for j in hole:
            o = off(j)
            data[o] = original_data[o]
            data[o + 1] = original_data[o + 1]
            data[o + 2] = original_data[o + 2]
            data[o + 3] = max(96, original_data[o + 3])

    result = Image.frombytes('RGBA', (width, height), bytes(data))
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)
    return result


def fit_image(image: Image.Image, width: int, height: int, crop_mode: str, transparent: bool) -> Image.Image:
    src = image.convert('RGBA')

    if crop_mode == 'cover':
        scale = max(width / src.width, height / src.height)
        resized = src.resize((max(1, int(src.width * scale)), max(1, int(src.height * scale))), Image.Resampling.LANCZOS)
        left = max(0, (resized.width - width) // 2)
        top = max(0, (resized.height - height) // 2)
        return resized.crop((left, top, left + width, top + height))

    if crop_mode == 'contain':
        scale = min(width / src.width, height / src.height)
        resized = src.resize((max(1, int(src.width * scale)), max(1, int(src.height * scale))), Image.Resampling.LANCZOS)
        base = Image.new('RGBA', (width, height), (0, 0, 0, 0) if transparent else (255, 255, 255, 255))
        x = (width - resized.width) // 2
        y = (height - resized.height) // 2
        base.paste(resized, (x, y), resized)
        return base

    return src.resize((width, height), Image.Resampling.LANCZOS)


def main() -> None:
    parser = argparse.ArgumentParser(description='Prepare design-v5 assets from raw generation output.')
    parser.add_argument(
        '--config',
        default='scripts/design-v5-prompts.json',
        help='Prompt config path relative to project root (default: scripts/design-v5-prompts.json)'
    )
    args = parser.parse_args()

    prompts_path = (PROJECT_ROOT / args.config).resolve()
    config = json.loads(prompts_path.read_text(encoding='utf-8'))
    assets = config.get('assets') or []

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    slot_paths: dict[str, str] = {}
    entries: list[dict] = []

    for asset in assets:
        file_name = asset['fileName']
        src_path = RAW_DIR / file_name
        out_path = OUT_DIR / file_name

        if src_path.exists():
            img = Image.open(src_path)
            if asset.get('transparent', False):
                aggressive = asset.get('slot') in {'button.primary'}
                img = remove_checkerboard_pixels(img, aggressive_matte=aggressive)
                if not bool(asset.get('skipBgFloodFill', False)):
                    img = remove_background_and_keep_main_component(img)
            img = fit_image(
                img,
                int(asset.get('width', img.width)),
                int(asset.get('height', img.height)),
                asset.get('cropMode', 'contain'),
                bool(asset.get('transparent', False))
            )
            img.save(out_path, 'PNG')
            width, height = img.width, img.height
            print(f'prepared: {file_name}')
        else:
            fallback = FALLBACK_SLOTS.get(asset['slot'])
            if fallback and (PROJECT_ROOT / fallback).exists():
                src = Image.open(PROJECT_ROOT / fallback).convert('RGBA')
                src = fit_image(
                    src,
                    int(asset.get('width', src.width)),
                    int(asset.get('height', src.height)),
                    asset.get('cropMode', 'contain'),
                    bool(asset.get('transparent', False))
                )
                src.save(out_path, 'PNG')
                width, height = src.width, src.height
                print(f'fallback: {file_name} <- {fallback}')
            else:
                print(f'skip: {file_name} (raw and fallback missing)')
                continue

        slot_paths[asset['slot']] = f'assets/design-v5/clean/{file_name}'
        entries.append({
            'slot': asset['slot'],
            'file': file_name,
            'usage': asset.get('usage', ''),
            'size': {'width': width, 'height': height},
            'prompt': asset.get('prompt', ''),
            'promptVersion': config.get('promptVersion', 'v1')
        })

    manifest = {
        'theme': config.get('theme', 'design-v5'),
        'version': '1.0.0',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'promptVersion': config.get('promptVersion', 'v1'),
        'slots': slot_paths,
        'fallbackSlots': FALLBACK_SLOTS,
        'entries': entries
    }

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'manifest: {MANIFEST_PATH.relative_to(PROJECT_ROOT)}')


if __name__ == '__main__':
    main()
