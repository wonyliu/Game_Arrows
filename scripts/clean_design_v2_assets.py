from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "assets" / "design-v2"
OUT_DIR = SRC_DIR / "clean"


def is_likely_bg(r: int, g: int, b: int, a: int) -> bool:
    if a < 10:
        return True
    mx = max(r, g, b)
    mn = min(r, g, b)
    delta = mx - mn
    avg = (r + g + b) / 3.0
    return delta <= 24 and 145 <= avg <= 252


def idx(x: int, y: int, width: int) -> int:
    return y * width + x


def pixel_offset(pixel_index: int) -> int:
    return pixel_index * 4


def clean_image(image_path: Path, output_path: Path) -> None:
    image = Image.open(image_path).convert("RGBA")
    width, height = image.size
    data = bytearray(image.tobytes())
    pixel_count = width * height

    bg = bytearray(pixel_count)
    edge_queue: deque[int] = deque()

    def enqueue_if_bg(x: int, y: int) -> None:
        pixel_index = idx(x, y, width)
        if bg[pixel_index]:
            return
        offset = pixel_offset(pixel_index)
        r, g, b, a = data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
        if is_likely_bg(r, g, b, a):
            bg[pixel_index] = 1
            edge_queue.append(pixel_index)

    for x in range(width):
        enqueue_if_bg(x, 0)
        enqueue_if_bg(x, height - 1)
    for y in range(height):
        enqueue_if_bg(0, y)
        enqueue_if_bg(width - 1, y)

    while edge_queue:
        current = edge_queue.popleft()
        x = current % width
        y = current // width

        if x > 0:
            enqueue_if_bg(x - 1, y)
        if x < width - 1:
            enqueue_if_bg(x + 1, y)
        if y > 0:
            enqueue_if_bg(x, y - 1)
        if y < height - 1:
            enqueue_if_bg(x, y + 1)

    for pixel_index in range(pixel_count):
        if bg[pixel_index]:
            offset = pixel_offset(pixel_index)
            data[offset + 3] = 0

    def opaque(pixel_index: int) -> bool:
        return data[pixel_offset(pixel_index) + 3] > 12

    visited = bytearray(pixel_count)
    largest_seed = -1
    largest_size = 0

    for pixel_index in range(pixel_count):
        if visited[pixel_index] or not opaque(pixel_index):
            continue

        queue: deque[int] = deque([pixel_index])
        visited[pixel_index] = 1
        comp_size = 0

        while queue:
            current = queue.popleft()
            comp_size += 1
            x = current % width
            y = current // width

            if x > 0:
                left = current - 1
                if not visited[left] and opaque(left):
                    visited[left] = 1
                    queue.append(left)
            if x < width - 1:
                right = current + 1
                if not visited[right] and opaque(right):
                    visited[right] = 1
                    queue.append(right)
            if y > 0:
                up = current - width
                if not visited[up] and opaque(up):
                    visited[up] = 1
                    queue.append(up)
            if y < height - 1:
                down = current + width
                if not visited[down] and opaque(down):
                    visited[down] = 1
                    queue.append(down)

        if comp_size > largest_size:
            largest_size = comp_size
            largest_seed = pixel_index

    keep = bytearray(pixel_count)
    if largest_seed >= 0:
        queue: deque[int] = deque([largest_seed])
        keep[largest_seed] = 1

        while queue:
            current = queue.popleft()
            x = current % width
            y = current // width

            if x > 0:
                left = current - 1
                if not keep[left] and opaque(left):
                    keep[left] = 1
                    queue.append(left)
            if x < width - 1:
                right = current + 1
                if not keep[right] and opaque(right):
                    keep[right] = 1
                    queue.append(right)
            if y > 0:
                up = current - width
                if not keep[up] and opaque(up):
                    keep[up] = 1
                    queue.append(up)
            if y < height - 1:
                down = current + width
                if not keep[down] and opaque(down):
                    keep[down] = 1
                    queue.append(down)

    for pixel_index in range(pixel_count):
        if not keep[pixel_index]:
            data[pixel_offset(pixel_index) + 3] = 0

    result = Image.frombytes("RGBA", (width, height), bytes(data))

    min_x, min_y, max_x, max_y = width, height, -1, -1
    pixels = result.load()
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] > 12:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if max_x >= min_x and max_y >= min_y:
        pad = 2
        left = max(0, min_x - pad)
        top = max(0, min_y - pad)
        right = min(width, max_x + pad + 1)
        bottom = min(height, max_y + pad + 1)
        result = result.crop((left, top, right, bottom))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, "PNG")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    png_files = sorted(path for path in SRC_DIR.glob("*.png") if path.is_file())
    for path in png_files:
        clean_image(path, OUT_DIR / path.name)
        print(f"cleaned: {path.name}")


if __name__ == "__main__":
    main()
