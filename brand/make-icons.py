#!/usr/bin/env python3
"""Regenerates every icon from the logo geometry below (the same shapes as brand/logo.svg).
Needs:  pip install cairosvg pillow fonttools brotli
Run from the repo root:  python3 brand/make-icons.py
Writes: www/favicon.ico, www/icons/*, brand/android/res/*  (all committed, so CI needs no image tools)."""
import io, os, sys
import cairosvg
from PIL import Image, ImageDraw, ImageFont

PRIMARY, CLOUD, NAVY, AMBER = "#5948F5", "#F6F7FB", "#10172B", "#FFB547"
E = ("M34 0 H160 A24 24 0 0 1 184 24 A24 24 0 0 1 160 48 H62 A14 14 0 0 0 48 62 V78 A14 14 0 0 0 62 92 "
     "H160 A24 24 0 0 1 184 116 A24 24 0 0 1 160 140 H62 A14 14 0 0 0 48 154 V170 A14 14 0 0 0 62 184 "
     "H160 A24 24 0 0 1 184 208 A24 24 0 0 1 160 232 H34 A34 34 0 0 1 0 198 V34 A34 34 0 0 1 34 0 Z")
EW, EH = 184, 232  # size of the E path before scaling

def svg(size, bg="round", scale=1.3, fg=CLOUD, rx=120):
    """bg: 'round' rounded square, 'full' full bleed square, 'circle', or None (transparent)."""
    tx, ty = 256 - EW * scale / 2, 256 - EH * scale / 2
    shape = {"round": f'<rect width="512" height="512" rx="{rx}" fill="{PRIMARY}"/>',
             "full": f'<rect width="512" height="512" fill="{PRIMARY}"/>',
             "circle": f'<circle cx="256" cy="256" r="256" fill="{PRIMARY}"/>',
             None: ""}[bg]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}">{shape}'
            f'<path fill="{fg}" transform="translate({tx:.2f} {ty:.2f}) scale({scale})" d="{E}"/></svg>')

def png(size, **kw):
    data = cairosvg.svg2png(bytestring=svg(size, **kw).encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(data)).convert("RGBA")

def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)

W = "www/icons/"
# ---- web ----
for s in (16, 32, 48):
    save(png(s), f"{W}favicon-{s}.png")
ico = [png(s) for s in (16, 32, 48)]
ico[2].save("www/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])
save(png(180, bg="full"), W + "apple-touch-icon.png")      # iOS rounds the corners itself
save(png(192), W + "icon-192.png")
save(png(512), W + "icon-512.png")
save(png(512, bg="full", scale=1.0), W + "icon-maskable-512.png")  # E inside the 80% safe circle
open(W + "favicon.svg", "w").write(open("brand/logo.svg").read())
open(W + "logo.svg", "w").write(open("brand/logo.svg").read())

# ---- Open Graph / link preview (1200x630) ----
def font(weight, size):
    from fontTools.ttLib import TTFont
    ttf = f"/tmp/poppins-{weight}.ttf"
    if not os.path.exists(ttf):
        f = TTFont(f"www/fonts/poppins-{weight}.woff2"); f.flavor = None; f.save(ttf)
    return ImageFont.truetype(ttf, size)
og = Image.new("RGBA", (1200, 630), NAVY)
glow = Image.new("RGBA", (1200, 630), (0, 0, 0, 0)); d = ImageDraw.Draw(glow)
d.ellipse((-380, -420, 560, 420), fill=(89, 72, 245, 105))
from PIL import ImageFilter
og.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
og.alpha_composite(png(250), (96, 190))
dr = ImageDraw.Draw(og)
dr.text((394, 226), "Campus Events", font=font(700, 84), fill=CLOUD)
dr.text((398, 332), "Registrations, tasks, tickets and check-in", font=font(500, 33), fill="#C6C9E0")
dr.text((398, 376), "for your whole event team.", font=font(500, 33), fill="#C6C9E0")
dr.rounded_rectangle((398, 446, 398 + 72, 446 + 8), radius=4, fill=AMBER)
save(og.convert("RGB"), W + "og-image.png")

# ---- Android launcher (copied into the generated project by scripts/patch-icons.sh) ----
A = "brand/android/res/"
dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for k, s in dens.items():
    save(png(s), f"{A}mipmap-{k}/ic_launcher.png")
    save(png(s, bg="circle", scale=0.95), f"{A}mipmap-{k}/ic_launcher_round.png")
    fg = int(s * 108 / 48)   # adaptive foreground: 108dp canvas, the E stays inside the 66dp safe zone
    save(png(fg, bg=None, scale=1.0), f"{A}mipmap-{k}/ic_launcher_foreground.png")
os.makedirs(A + "values", exist_ok=True)
open(A + "values/ic_launcher_background.xml", "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">%s</color>\n</resources>\n' % PRIMARY)
# launch screen images (same file names and sizes as Capacitor's template): navy with the logo in the middle
splash = {"drawable": (480, 320)}
for k, (pw, ph) in {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}.items():
    splash[f"drawable-port-{k}"] = (pw, ph); splash[f"drawable-land-{k}"] = (ph, pw)
splash["drawable-land-mdpi"] = (480, 320); splash["drawable-land-hdpi"] = (800, 480)
for folder, (w, h) in splash.items():
    im = Image.new("RGBA", (w, h), NAVY); m = int(min(w, h) * 0.30)
    im.alpha_composite(png(m), ((w - m) // 2, (h - m) // 2))
    save(im.convert("RGB"), f"{A}{folder}/splash.png")
print("icons written")
