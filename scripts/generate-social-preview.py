"""Regenerate the committed social preview: python3 scripts/generate-social-preview.py.

Requires Pillow for this optional artwork task; website builds use the saved PNG.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
image = Image.new('RGB', (1200, 630), '#f8f1e4')
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((28, 28, 1172, 602), radius=32, fill='#221810')
draw.ellipse((800, -100, 1360, 460), fill='#33241a')
draw.ellipse((805, 175, 1125, 495), fill='#83421c')
draw.rounded_rectangle((900, 220, 1030, 410), radius=64, fill='#eabd66')
draw.ellipse((944, 256, 980, 320), fill='#f9edd0')
draw.ellipse((849, 303, 896, 360), fill='#f2d89e')
draw.ellipse((1036, 311, 1083, 368), fill='#f2d89e')

def font(size, serif=False):
    name = 'Georgia.ttf' if serif else 'Arial.ttf'
    path = Path('/System/Library/Fonts/Supplemental') / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default(size=size)

draw.text((85, 97), 'CREAMYNUT', font=font(23), fill='#f0c04a')
draw.text((80, 177), 'Your bread’s', font=font(75, True), fill='#fdfaf4')
draw.text((80, 265), 'best friend.', font=font(75, True), fill='#f0c04a')
draw.text((85, 382), 'From bread to soup, we’ve got you.', font=font(27), fill='#efe3cd')
draw.text((85, 493), '2.5 kg  ·  5 kg  ·  Custom orders from 10 kg', font=font(23), fill='#efe3cd')
draw.text((85, 544), 'creamynut.vercel.app', font=font(20), fill='#eabd66')
image.save(root / 'public' / 'social-preview.png', optimize=True)
