#!/usr/bin/env python3
from __future__ import annotations

import math
import shutil
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent.parent
AUDIO_PATH = ROOT / "assets" / "audio" / "bgm" / "扭扭舞.mp3"
SKIN_DIR = ROOT / "assets" / "skins" / "orange-jelly-snake"
OUTPUT_DIR = ROOT / "output" / "intro_preview"
TEMP_DIR = OUTPUT_DIR / "temp"
FRAMES_DIR = TEMP_DIR / "frames"
WAV_PATH = TEMP_DIR / "audio_10s.wav"
VIDEO_SILENT_PATH = OUTPUT_DIR / "snake_bollywood_preview_silent.mp4"
VIDEO_FINAL_PATH = OUTPUT_DIR / "snake_bollywood_preview_10s.mp4"

WIDTH = 720
HEIGHT = 1280
FPS = 30
DURATION = 10.0
TOTAL_FRAMES = int(FPS * DURATION)
BG_COLORS = ((43, 12, 25), (110, 30, 57), (214, 119, 49))


@dataclass(frozen=True)
class SceneCaption:
    start: float
    end: float
    text: str


CAPTIONS = (
    SceneCaption(0.15, 1.80, "蛇蛇登场"),
    SceneCaption(2.00, 3.95, "扭~ 扭~ 扭~"),
    SceneCaption(4.10, 6.35, "咖喱节拍上线"),
    SceneCaption(6.50, 8.15, "全场一起摇"),
    SceneCaption(8.45, 9.95, "蛇蛇大冒险"),
)

FALLBACK_BEATS = [0.62, 1.10, 1.62, 2.15, 2.66, 3.15, 3.70, 4.24, 4.78, 5.28, 5.80, 6.33, 6.85, 7.35, 7.90, 8.40, 8.94, 9.42]


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def ease_out_back(t: float) -> float:
    s = 1.70158
    p = t - 1.0
    return 1 + (s + 1) * p * p * p + s * p * p


def ease_in_out_sine(t: float) -> float:
    return -(math.cos(math.pi * t) - 1.0) / 2.0


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if TEMP_DIR.exists():
        shutil.rmtree(TEMP_DIR)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)


def ffmpeg_exe() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()


def extract_audio_clip() -> None:
    cmd = [
        ffmpeg_exe(),
        "-y",
        "-ss",
        "0",
        "-t",
        f"{DURATION:.2f}",
        "-i",
        str(AUDIO_PATH),
        "-ac",
        "1",
        "-ar",
        "22050",
        str(WAV_PATH),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def read_wav_mono(path: Path) -> tuple[int, np.ndarray]:
    with wave.open(str(path), "rb") as wav_file:
        sample_rate = wav_file.getframerate()
        frames = wav_file.readframes(wav_file.getnframes())
        samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    return sample_rate, samples


def detect_beats(samples: np.ndarray, sample_rate: int) -> list[float]:
    window_size = int(sample_rate * 0.05)
    hop_size = int(sample_rate * 0.02)
    if window_size <= 0 or hop_size <= 0 or len(samples) < window_size:
        return FALLBACK_BEATS

    rms = []
    for start in range(0, len(samples) - window_size, hop_size):
        window = samples[start:start + window_size]
        rms.append(float(np.sqrt(np.mean(window * window) + 1e-8)))
    envelope = np.array(rms, dtype=np.float32)
    if envelope.size < 3:
        return FALLBACK_BEATS

    smooth = np.convolve(envelope, np.ones(5, dtype=np.float32) / 5.0, mode="same")
    onset = np.maximum(0.0, smooth - np.roll(smooth, 1))
    onset[0] = 0.0
    threshold = float(np.mean(onset) + np.std(onset) * 0.8)
    beats: list[float] = []
    min_gap = 0.34

    for i in range(1, len(onset) - 1):
        if onset[i] < threshold:
            continue
        if onset[i] < onset[i - 1] or onset[i] < onset[i + 1]:
            continue
        time_sec = i * hop_size / sample_rate
        if time_sec > DURATION:
            continue
        if beats and time_sec - beats[-1] < min_gap:
            if onset[i] > onset[int(beats[-1] * sample_rate / hop_size)]:
                beats[-1] = time_sec
            continue
        beats.append(time_sec)

    return beats if len(beats) >= 8 else FALLBACK_BEATS


def compute_frame_energy(samples: np.ndarray, sample_rate: int) -> np.ndarray:
    energies = np.zeros(TOTAL_FRAMES, dtype=np.float32)
    frame_span = int(sample_rate * 0.08)
    for frame_idx in range(TOTAL_FRAMES):
        center = int((frame_idx / FPS) * sample_rate)
        start = max(0, center - frame_span // 2)
        end = min(len(samples), center + frame_span // 2)
        if end <= start:
            continue
        window = samples[start:end]
        value = float(np.sqrt(np.mean(window * window) + 1e-8))
        energies[frame_idx] = value
    max_value = float(np.max(energies) or 1.0)
    energies /= max_value
    return energies


def make_gradient_background() -> Image.Image:
    bg = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(bg)
    for y in range(HEIGHT):
        t = y / max(1, HEIGHT - 1)
        if t < 0.55:
            k = t / 0.55
            color = tuple(int(lerp(BG_COLORS[0][i], BG_COLORS[1][i], k)) for i in range(3))
        else:
            k = (t - 0.55) / 0.45
            color = tuple(int(lerp(BG_COLORS[1][i], BG_COLORS[2][i], k)) for i in range(3))
        draw.line((0, y, WIDTH, y), fill=color)
    return bg


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    if bold:
        return ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", size=size)
    return ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", size=size)


def colorize_sprite(image: Image.Image, tint: tuple[int, int, int], alpha: int) -> Image.Image:
    rgba = image.convert("RGBA")
    overlay = Image.new("RGBA", rgba.size, (*tint, alpha))
    tinted = Image.alpha_composite(rgba, ImageChops.multiply(overlay, rgba))
    return tinted


def paste_rotated(base: Image.Image, sprite: Image.Image, center: tuple[float, float], angle_deg: float, scale: float = 1.0) -> None:
    width = max(2, int(sprite.width * scale))
    height = max(2, int(sprite.height * scale))
    resized = sprite.resize((width, height), Image.Resampling.LANCZOS)
    rotated = resized.rotate(angle_deg, resample=Image.Resampling.BICUBIC, expand=True)
    x = int(center[0] - rotated.width / 2)
    y = int(center[1] - rotated.height / 2)
    base.alpha_composite(rotated, (x, y))


def draw_sunburst(image: Image.Image, time_sec: float, beat: float, energy: float) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy = WIDTH // 2, 235
    radius = int(280 + 45 * beat + 30 * energy)
    for idx in range(20):
        angle = time_sec * 10 + idx * (360 / 20)
        a0 = math.radians(angle - 4)
        a1 = math.radians(angle + 4)
        p1 = (cx + math.cos(a0) * 12, cy + math.sin(a0) * 12)
        p2 = (cx + math.cos(a1) * 12, cy + math.sin(a1) * 12)
        p3 = (cx + math.cos(math.radians(angle)) * radius, cy + math.sin(math.radians(angle)) * radius)
        fill = (255, 230, 166, 34) if idx % 2 == 0 else (255, 162, 92, 22)
        draw.polygon([p1, p2, p3], fill=fill)
    image.alpha_composite(overlay)


def draw_garland(image: Image.Image, y_base: int, flip: bool = False) -> None:
    draw = ImageDraw.Draw(image)
    points = []
    for x in range(-40, WIDTH // 2 + 70, 38):
        local_x = WIDTH - x if flip else x
        local_y = y_base + int(math.sin(x * 0.02) * 28)
        points.append((local_x, local_y))
    draw.line(points, fill=(247, 210, 118, 180), width=4)
    bead_colors = ((255, 96, 134, 235), (255, 206, 105, 235), (61, 214, 199, 235))
    for idx, point in enumerate(points[1:-1], start=1):
        bead_color = bead_colors[idx % len(bead_colors)]
        x, y = point
        draw.ellipse((x - 12, y - 2, x + 12, y + 22), fill=bead_color)


def draw_stage_props(image: Image.Image, time_sec: float, beat: float, energy: float) -> None:
    draw = ImageDraw.Draw(image)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)

    draw_garland(overlay, 118, flip=False)
    draw_garland(overlay, 126, flip=True)

    palace_color = (112, 42, 38, 120)
    odraw.polygon([(45, 820), (60, 650), (90, 580), (110, 470), (160, 420), (190, 470), (210, 580), (240, 650), (255, 820)], fill=palace_color)
    odraw.polygon([(465, 820), (480, 650), (510, 580), (530, 470), (580, 420), (610, 470), (630, 580), (660, 650), (675, 820)], fill=palace_color)

    floor_glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(floor_glow)
    glow_alpha = int(82 + energy * 90)
    gdraw.ellipse((145, 915, 575, 1065), fill=(255, 226, 142, glow_alpha))
    floor_glow = floor_glow.filter(ImageFilter.GaussianBlur(radius=28))
    image.alpha_composite(floor_glow)
    image.alpha_composite(overlay)

    basket = Image.new("RGBA", (320, 210), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(basket)
    bdraw.rounded_rectangle((36, 68, 284, 186), radius=42, fill=(137, 72, 28, 255), outline=(241, 195, 116, 255), width=7)
    for x in range(60, 270, 28):
        bdraw.arc((x - 10, 78, x + 10, 180), 80, 280, fill=(253, 214, 146, 130), width=4)
    bdraw.rounded_rectangle((62, 28, 258, 80), radius=24, fill=(92, 42, 19, 255))
    basket = basket.rotate(math.sin(time_sec * 1.6) * (2.2 + beat * 2.0), resample=Image.Resampling.BICUBIC, expand=True)
    image.alpha_composite(basket, (WIDTH // 2 - basket.width // 2, 818))

    for lamp_x in (128, 592):
        flame = Image.new("RGBA", (100, 160), (0, 0, 0, 0))
        fdraw = ImageDraw.Draw(flame)
        pulse = 1 + beat * 0.22 + energy * 0.18
        fdraw.rounded_rectangle((30, 98, 70, 116), radius=8, fill=(96, 38, 19, 255))
        fdraw.polygon(
            [
                (50, int(26 - 8 * pulse)),
                (68, 74),
                (50, 98),
                (32, 74),
            ],
            fill=(255, 202, 96, 235),
        )
        flame = flame.filter(ImageFilter.GaussianBlur(radius=0.5))
        image.alpha_composite(flame, (lamp_x - 50, 860))


def build_snake_sprites() -> dict[str, Image.Image]:
    return {
        "head": Image.open(SKIN_DIR / "snake_head.png").convert("RGBA"),
        "head_curious": Image.open(SKIN_DIR / "snake_head_curious.png").convert("RGBA"),
        "head_surprised": Image.open(SKIN_DIR / "snake_head_surprised.png").convert("RGBA"),
        "seg_a": Image.open(SKIN_DIR / "snake_seg_a.png").convert("RGBA"),
        "seg_b": Image.open(SKIN_DIR / "snake_seg_b.png").convert("RGBA"),
        "tail_base": Image.open(SKIN_DIR / "snake_tail_base.png").convert("RGBA"),
        "tail_tip": Image.open(SKIN_DIR / "snake_tail_tip.png").convert("RGBA"),
    }


def scene_phase(time_sec: float) -> float:
    if time_sec < 1.7:
        return ease_out_back(clamp(time_sec / 1.7, 0, 1))
    return 1.0


def active_caption(time_sec: float) -> str:
    for caption in CAPTIONS:
        if caption.start <= time_sec < caption.end:
            return caption.text
    return ""


def beat_strength(time_sec: float, beats: list[float]) -> float:
    pulse = 0.0
    for beat in beats:
        delta = abs(time_sec - beat)
        if delta > 0.32:
            continue
        pulse = max(pulse, 1.0 - delta / 0.32)
    return pulse ** 2


def draw_snake(
    image: Image.Image,
    sprites: dict[str, Image.Image],
    time_sec: float,
    beat: float,
    energy: float,
) -> None:
    rise = scene_phase(time_sec)
    dance = clamp((time_sec - 1.2) / 1.5, 0.0, 1.0)
    ghost_strength = clamp((time_sec - 5.0) / 1.2, 0.0, 1.0) * clamp((8.2 - time_sec) / 1.1, 0.0, 1.0)
    finale = clamp((time_sec - 8.2) / 1.0, 0.0, 1.0)

    base_x = WIDTH * (0.5 + math.sin(time_sec * 0.8) * 0.02 + dance * 0.05)
    base_y = HEIGHT * (0.84 - rise * 0.30 - finale * 0.03)
    segment_count = 11
    spacing = 58
    amplitude = 16 + 42 * dance + 28 * beat + 24 * energy
    scale = 5.0 + beat * 0.18

    def draw_pass(x_offset: float, tint: tuple[int, int, int] | None, alpha: int, head_key: str) -> None:
        points: list[tuple[float, float]] = []
        for idx in range(segment_count):
            phase = time_sec * 4.6 - idx * 0.48 + x_offset * 0.01
            x = base_x + x_offset + math.sin(phase) * amplitude * (1 - idx / (segment_count + 3))
            y = base_y + idx * spacing * 0.78 + math.cos(phase * 0.72) * 10
            points.append((x, y))

        halo = Image.new("RGBA", image.size, (0, 0, 0, 0))
        hdraw = ImageDraw.Draw(halo)
        hx, hy = points[0]
        radius = 82 + beat * 30 + energy * 20
        for idx in range(10):
            angle = time_sec * 2.4 + idx * (math.pi * 2 / 10)
            x0 = hx + math.cos(angle) * radius * 0.78
            y0 = hy + math.sin(angle) * radius * 0.60
            x1 = hx + math.cos(angle) * radius
            y1 = hy + math.sin(angle) * radius * 0.76
            hdraw.line((x0, y0, x1, y1), fill=(255, 230, 160, alpha // 2), width=4)
        halo = halo.filter(ImageFilter.GaussianBlur(radius=1.2))
        image.alpha_composite(halo)

        for idx in range(segment_count - 1, -1, -1):
            px, py = points[idx]
            nx, ny = points[max(0, idx - 1)]
            angle_deg = math.degrees(math.atan2(ny - py, nx - px)) + 90
            if idx == segment_count - 1:
                sprite = sprites["tail_tip"]
            elif idx == segment_count - 2:
                sprite = sprites["tail_base"]
            else:
                sprite = sprites["seg_a"] if idx % 2 == 0 else sprites["seg_b"]
            if tint is not None:
                sprite = colorize_sprite(sprite, tint, alpha)
            paste_rotated(image, sprite, (px, py), angle_deg, scale * (1 - idx * 0.014))

        head_sprite = sprites[head_key]
        if tint is not None:
            head_sprite = colorize_sprite(head_sprite, tint, alpha)
        hx, hy = points[0]
        nx, ny = points[1]
        head_angle = math.degrees(math.atan2(hy - ny, hx - nx)) - 90 + math.sin(time_sec * 8.2) * 4 + beat * 7
        paste_rotated(image, head_sprite, (hx, hy), head_angle, scale * (1.02 + beat * 0.05))

    if ghost_strength > 0:
        ghost_alpha = int(74 * ghost_strength)
        draw_pass(-96, (47, 215, 197), ghost_alpha, "head_curious")
        draw_pass(96, (255, 90, 148), ghost_alpha, "head_surprised")

    head_key = "head_curious" if 2.2 < time_sec < 6.8 else ("head_surprised" if time_sec > 6.8 else "head")
    draw_pass(0, None, 255, head_key)


def draw_overlay_text(image: Image.Image, time_sec: float, beat: float) -> None:
    draw = ImageDraw.Draw(image)
    title_font = load_font(70, bold=True)
    sub_font = load_font(28, bold=True)
    badge_font = load_font(24, bold=False)
    caption_font = load_font(40, bold=True)

    draw.rounded_rectangle((32, 34, 220, 76), radius=22, fill=(62, 18, 31, 180), outline=(255, 233, 187, 72), width=2)
    draw.text((50, 46), "10s 试看", font=badge_font, fill=(255, 239, 204, 255))

    caption = active_caption(time_sec)
    if caption:
        bbox = draw.textbbox((0, 0), caption, font=caption_font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = WIDTH / 2 - tw / 2 - 26
        y = 104 + math.sin(time_sec * 8.0) * (4 + beat * 10)
        draw.rounded_rectangle((x, y, x + tw + 52, y + th + 28), radius=26, fill=(59, 14, 29, 174), outline=(255, 234, 190, 68), width=2)
        draw.text((x + 26, y + 12), caption, font=caption_font, fill=(255, 245, 214, 255))

    if time_sec >= 8.2:
        t = clamp((time_sec - 8.2) / 1.1, 0.0, 1.0)
        scale = ease_out_back(t)
        temp = Image.new("RGBA", image.size, (0, 0, 0, 0))
        tdraw = ImageDraw.Draw(temp)
        tdraw.text((WIDTH / 2 - 180, 216), "蛇蛇大冒险", font=title_font, fill=(255, 244, 203, int(255 * t)))
        tdraw.text((WIDTH / 2 - 132, 292), "扭扭舞开场", font=sub_font, fill=(255, 226, 145, int(255 * t)))
        scaled = temp.resize((max(1, int(WIDTH * scale)), max(1, int(HEIGHT * scale))), Image.Resampling.LANCZOS)
        offset = ((WIDTH - scaled.width) // 2, (HEIGHT - scaled.height) // 2)
        image.alpha_composite(scaled, offset)


def render_frames(beats: list[float], frame_energy: np.ndarray) -> None:
    base_bg = make_gradient_background().convert("RGBA")
    sprites = build_snake_sprites()

    for frame_idx in range(TOTAL_FRAMES):
        time_sec = frame_idx / FPS
        beat = beat_strength(time_sec, beats)
        energy = float(frame_energy[min(frame_idx, len(frame_energy) - 1)])

        frame = base_bg.copy()
        draw_sunburst(frame, time_sec, beat, energy)
        draw_stage_props(frame, time_sec, beat, energy)
        draw_snake(frame, sprites, time_sec, beat, energy)
        draw_overlay_text(frame, time_sec, beat)

        # Floating confetti dots.
        confetti = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
        cdraw = ImageDraw.Draw(confetti)
        for idx in range(24):
            orbit = idx / 24
            x = int((orbit * WIDTH + math.sin(time_sec * 1.7 + idx) * 42 + frame_idx * 1.2) % WIDTH)
            y = int((HEIGHT * 0.18 + idx * 37 + math.cos(time_sec * 1.3 + idx * 0.7) * 24 + frame_idx * 4.6) % HEIGHT)
            size = 6 + (idx % 3) * 4 + beat * 4
            color = ((255, 210, 106, 118), (255, 88, 140, 110), (55, 216, 198, 112))[idx % 3]
            cdraw.ellipse((x, y, x + size, y + size), fill=color)
        confetti = confetti.filter(ImageFilter.GaussianBlur(radius=0.5))
        frame.alpha_composite(confetti)

        frame.convert("RGB").save(FRAMES_DIR / f"frame_{frame_idx:05d}.png", quality=95)


def encode_silent_video() -> None:
    cmd = [
        ffmpeg_exe(),
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(FRAMES_DIR / "frame_%05d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(VIDEO_SILENT_PATH),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def mux_audio() -> None:
    cmd = [
        ffmpeg_exe(),
        "-y",
        "-i",
        str(VIDEO_SILENT_PATH),
        "-ss",
        "0",
        "-t",
        f"{DURATION:.2f}",
        "-i",
        str(AUDIO_PATH),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(VIDEO_FINAL_PATH),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> int:
    ensure_dirs()
    extract_audio_clip()
    sample_rate, samples = read_wav_mono(WAV_PATH)
    beats = detect_beats(samples, sample_rate)
    frame_energy = compute_frame_energy(samples, sample_rate)
    render_frames(beats, frame_energy)
    encode_silent_video()
    mux_audio()
    print(VIDEO_FINAL_PATH)
    print("beats:", ",".join(f"{beat:.2f}" for beat in beats))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
