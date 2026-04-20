"""Swap green pixels in the original Family Plan logo to royal blue
while preserving the real transparency (alpha channel). Gold bars/coins stay.
"""
import os
import shutil
import time
from pathlib import Path
from PIL import Image

SRC = Path(r'c:/Users/User/familybudget/public/logo-familyplan-light.png')
BACKUP_GREEN = Path(r'C:\Users\User\AppData\Local\Temp\logoswap\logo-green.png')
DEST_DIR = Path.home() / 'Downloads'
DEST_DIR.mkdir(parents=True, exist_ok=True)
OUT = DEST_DIR / f'logo-familyplan-blue-clean_{int(time.time())}.png'

if not BACKUP_GREEN.exists():
    raise SystemExit(f'Original green logo not found: {BACKUP_GREEN}')

# Deep royal blue target (#1E3FA8)
BLUE = (30, 63, 168)

im = Image.open(BACKUP_GREEN).convert('RGBA')
pixels = im.load()
w, h = im.size

swapped = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if a < 8:
            continue
        # green: G dominant over R and B by a clear margin,
        # and not gold/yellow (which has R and G both very high)
        if g > r + 15 and g > b + 15 and not (r > 150 and g > 140):
            # scale the green pixel's intensity into blue while keeping shading
            # heuristic: preserve relative brightness of the original green
            intensity = g / 100.0  # dominant green ~94 → ~0.94
            nr = min(255, int(BLUE[0] * intensity))
            ng = min(255, int(BLUE[1] * intensity))
            nb = min(255, int(BLUE[2] * intensity))
            pixels[x, y] = (nr, ng, nb, a)
            swapped += 1

print(f'[recolor] swapped {swapped} pixels')
im.save(OUT, 'PNG')
print(f'[recolor] saved: {OUT}')

# Also place in public/ (will overwrite the bad Gemini output)
shutil.copy2(OUT, SRC)
print(f'[recolor] installed at: {SRC}')
