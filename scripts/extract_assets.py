import cv2
import numpy as np
import os

def extract():
    frames_dir = r'temp\frames_crash'
    assets_dir = r'assets\ui'
    
    if not os.path.exists(assets_dir):
        os.makedirs(assets_dir)
        
    # 1. 提取顶部 Header (从 f_600.jpg)
    f600 = os.path.join(frames_dir, 'f_600.jpg')
    if os.path.exists(f600):
        img = cv2.imread(f600)
        # 微信头 + 关卡信息区 (大约顶部 180px)
        header = img[0:180, :]
        cv2.imwrite(os.path.join(assets_dir, 'header_full.png'), header)
        print("Extracted header_full.png")
        
    # 2. 提取底部 Toolbar (从 f_600.jpg)
        # 底部大约 200px
        h, w = img.shape[:2]
        toolbar = img[h-220:h, :]
        cv2.imwrite(os.path.join(assets_dir, 'toolbar_full.png'), toolbar)
        print("Extracted toolbar_full.png")

    # 3. 提取 Game Over 弹窗 (从 frame_1275.jpg)
    f_over = os.path.join(frames_dir, 'frame_1275.jpg')
    if os.path.exists(f_over):
        img_over = cv2.imread(f_over)
        oh, ow = img_over.shape[:2]
        # 弹窗居中，大约 500x600
        popup = img_over[oh//2-300:oh//2+350, ow//2-250:ow//2+250]
        cv2.imwrite(os.path.join(assets_dir, 'game_over_popup.png'), popup)
        print("Extracted game_over_popup.png")

if __name__ == "__main__":
    extract()
