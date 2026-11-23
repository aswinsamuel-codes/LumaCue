"""Render the LumaCue app icon (icon.png 512 px, icon.ico multi-size) from the logo geometry.

Run with any Python that has Pillow:  python desktop/make_icons.py
The shapes match public/lumacue-logo.svg.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
S = 1024                      # draw big, then downsample for smooth edges
K = S / 128.0
STOPS = [(0.0, (0x22, 0xD3, 0xEE)), (0.5, (0xA8, 0x55, 0xF7)), (1.0, (0xEC, 0x48, 0x99))]


def grad(t: float):
    t = max(0.0, min(1.0, t))
    for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
        if t <= t1:
            f = (t - t0) / (t1 - t0)
            return tuple(int(a + (b - a) * f) for a, b in zip(c0, c1)) + (255,)
    return STOPS[-1][1] + (255,)


def g_at(x: float, y: float):
    return grad((x + y) / 256.0)       # diagonal gradient across the 128-unit tile


def main():
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(28 * K), fill=255)
    bg = Image.new("RGBA", (S, S))
    px = bg.load()
    cx, cy, r = 0.3 * S, 0.25 * S, 0.9 * S * 1.2
    for y in range(S):
        for x in range(S):
            d = min(math.hypot(x - cx, y - cy) / r, 1.0)
            px[x, y] = tuple(int(a + (b - a) * d) for a, b in zip((0x1B, 0x15, 0x30), (0x08, 0x07, 0x0C))) + (255,)
    tile.paste(bg, (0, 0), mask)

    light = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(light)
    # Sweep arc: centre (44, 94), radius 64, from 12 o'clock to 3 o'clock.
    steps = 400
    for i in range(steps):
        a = -math.pi / 2 + (math.pi / 2) * i / steps
        x, y = 44 + 64 * math.cos(a), 94 + 64 * math.sin(a)
        rr = 2 * K
        d.ellipse([x * K - rr, y * K - rr, x * K + rr, y * K + rr], fill=g_at(x, y))
    for (x, y) in [(44, 30), (44, 46), (44, 62), (44, 78), (44, 94), (60, 94), (76, 94), (92, 94)]:
        d.ellipse([(x - 6) * K, (y - 6) * K, (x + 6) * K, (y + 6) * K], fill=g_at(x, y))
    d.ellipse([(89.25 - 5) * K, (48.75 - 5) * K, (89.25 + 5) * K, (48.75 + 5) * K], fill=(255, 255, 255, 255))

    glow = light.filter(ImageFilter.GaussianBlur(2.2 * K))
    out = Image.alpha_composite(tile, glow)
    out = Image.alpha_composite(out, glow)
    out = Image.alpha_composite(out, light)
    out.putalpha(Image.composite(out.getchannel("A"), Image.new("L", (S, S), 0), mask))

    png = out.resize((512, 512), Image.LANCZOS)
    png.save(os.path.join(HERE, "icon.png"))
    png.save(os.path.join(HERE, "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("wrote desktop/icon.png and desktop/icon.ico")


if __name__ == "__main__":
    main()
