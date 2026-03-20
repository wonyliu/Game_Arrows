import cv2
import numpy as np
import os

def extract_icons(frame_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    img = cv2.imread(frame_path)
    if img is None:
        print("Frame not found")
        return
    
    h, w = img.shape[:2]
    # In 540x960 frame:
    # 3 items are near the bottom.
    # We found center X is ~270, items are ~125px apart? 
    # Let's try to be precise.
    
    # Eraser: (100, 900) size 80x80?
    # Actually let's just crop 100x100 blocks
    cuts = [
        ('eraser', (105, 905, 90, 90)),
        ('wand', (230, 905, 90, 90)),
        ('clock', (355, 905, 90, 90))
    ]
    
    for name, (x, y, cw, ch) in cuts:
        if y + ch > h: ch = h - y
        if x + cw > w: cw = w - x
        crop = img[y:y+ch, x:x+cw]
        cv2.imwrite(os.path.join(output_dir, f'icon_{name}.png'), crop)
        print(f"Saved {name} at {x},{y}")

if __name__ == "__main__":
    extract_icons('D:\\Projects\\Game_Arrows\\temp\\frames_crash\\f_635.jpg', 'D:\\Projects\\Game_Arrows\\assets\\ui\\icons\\')
