from pathlib import Path
from PIL import Image

root = Path(r"D:/Projects/Game_Arrows")
src = root / "temp"
out = root / "assets" / "design-v3" / "clean"
out.mkdir(parents=True, exist_ok=True)

def remove_checkerboard(img):
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            avg = (r + g + b) / 3
            if abs(r-g) <= 8 and abs(g-b) <= 8 and 175 <= avg <= 245:
                px[x, y] = (r, g, b, 0)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img

# 1) App bg: center-crop to game ratio 430x932
bg = Image.open(src / "ui_app_bg_gemini.png").convert("RGB")
tw, th = 430, 932
scale = max(tw / bg.width, th / bg.height)
rw, rh = int(bg.width * scale), int(bg.height * scale)
bg = bg.resize((rw, rh), Image.Resampling.LANCZOS)
left = max(0, (rw - tw) // 2)
top = max(0, (rh - th) // 2)
bg = bg.crop((left, top, left + tw, top + th))
bg.save(out / "ui_app_bg.png", "PNG")

# 2) Round item button
btn_round = remove_checkerboard(Image.open(src / "ui_item_button_gemini.png"))
btn_round = btn_round.resize((320, 320), Image.Resampling.LANCZOS)
btn_round.save(out / "ui_item_button.png", "PNG")

# 3) Panel and generic button skin
panel = remove_checkerboard(Image.open(src / "ui_popup_panel_gemini.png"))
panel.save(out / "ui_panel.png", "PNG")

# Derive long button skin from panel center area
pw, ph = panel.size
crop = panel.crop((int(pw*0.06), int(ph*0.23), int(pw*0.94), int(ph*0.77)))
crop = crop.resize((760, 220), Image.Resampling.LANCZOS)
crop.save(out / "ui_button.png", "PNG")

print("Generated:")
for p in sorted(out.glob("*.png")):
    print(p.name, p.stat().st_size)
