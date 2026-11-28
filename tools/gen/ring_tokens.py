"""Round map tokens for the actors that stand on the map as a portrait: assets/art/ring/<slug>.webp.

Run: python3 -I tools/gen/ring_tokens.py <Neon Hub root>
Foundry's dynamic token ring doesn't clip its picture, so a cut-out portrait (or a square painting) spills over the
ring. These are the picture cropped to a disc with the ring painted on: mooks from assets/art/mooks in magenta, framed
on the head and shoulders; cyberpets from assets/art/rides in cyan. Actors with a top-down token (assets/art/tokens)
keep it and get none. Needs Pillow.
"""
import functools, glob, math, os, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SIZE, SS = 512, 3  # output size; supersampling for smooth edges
RING, GAP = 0.105, 0.008  # ring width and the dark line inside it, as fractions of the token
BACK = (7, 7, 11)
MAGENTA, CYAN = (255, 42, 109), (5, 217, 232)


def frame(im):
    """Square crop on the head and shoulders of a cut-out bust: 80% of the picture, hung from the top of the figure."""
    w, h = im.size
    box = im.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, w, h)
    side = round(w * 0.86)
    head = im.split()[3].crop((0, box[1], w, box[1] + round(h * 0.3))).point(lambda v: 255 if v > 24 else 0)
    hb = head.getbbox() or (0, 0, w, 1)
    cx = (hb[0] + hb[2]) / 2 * 0.6 + w / 2 * 0.4  # between the head and the picture's middle
    left = min(max(0, round(cx - side / 2)), w - side)
    top = min(box[1] - round(side * 0.13), h - side)  # above the picture when the head touches its top: the ring needs the room
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(im.crop((left, max(0, top), left + side, top + side)), (0, max(0, -top)))
    return out


STEEL = (58, 50, 66)  # the band: dark gunmetal with a violet cast
SEAMS = (20, 80, 140, 200, 260, 320)  # degrees: where the band's plates meet


def profile(t):
    """Brightness across the steel band (0 inner edge, 1 outer): a chamfer on each side of a flat face."""
    if t < 0.16:
        return 0.55 + 0.6 * (t / 0.16)
    if t < 0.24:
        return 1.5                            # the inner corner catches the light
    if t < 0.78:
        return 1.0
    if t < 0.85:
        return 1.3
    return 1.0 - 0.6 * ((t - 0.85) / 0.15)    # outer chamfer, falling away


@functools.lru_cache(maxsize=None)
def sweep(n):
    """Reflections around a turned metal ring: brighter at the top left and bottom right, as an L image."""
    m = 384
    c = (m - 1) / 2
    px = []
    for y in range(m):
        for x in range(m):
            a = math.atan2(y - c, x - c)
            v = 0.55 + 0.45 * abs(math.cos(a - math.radians(225))) ** 2.4
            px.append(max(0, min(255, round(v * 255))))
    im = Image.new("L", (m, m))
    im.putdata(px)
    return im.resize((n, n), Image.BICUBIC)


@functools.lru_cache(maxsize=None)
def bevel(n, color):
    """The ring, in the look of Foundry's own dynamic token ring: a dark gunmetal band in plates, and inside it two thin
    lit lines in the token's color, a heavier one and a hairline. One circle per pixel of its width."""
    width = round(n * RING)
    steel = round(width * 0.60)                     # the band, from the token's edge
    lines = ((0.68, 0.82), (0.89, 0.95))            # the two lit lines, as fractions of the ring's width
    band = Image.new("RGB", (n, n), BACK)
    d = ImageDraw.Draw(band)
    edge = max(2, round(steel * 0.06))
    for k in range(steel):
        t = 1 - k / (steel - 1)
        dark = min(1, min(k, steel - 1 - k) / edge)
        p = profile(t)
        d.ellipse((k, k, n - 1 - k, n - 1 - k), outline=tuple(round(min(255, v * p) * dark + BACK[i] * (1 - dark)) for i, v in enumerate(STEEL)), width=2)
    band = ImageChops.multiply(band, Image.merge("RGB", [sweep(n).point(lambda v: min(255, 40 + v))] * 3))
    c = (n - 1) / 2
    d = ImageDraw.Draw(band)
    for deg in SEAMS:  # the joints between plates
        a = math.radians(deg)
        d.line((c + math.cos(a) * (c - steel), c + math.sin(a) * (c - steel), c + math.cos(a) * c, c + math.sin(a) * c), fill=BACK, width=max(2, n // 300))
    glow = Image.new("RGB", (n, n), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    for lo, hi in lines:
        for k in range(round(width * lo), round(width * hi)):
            g.ellipse((k, k, n - 1 - k, n - 1 - k), outline=color, width=2)
    band = ImageChops.screen(band, glow.filter(ImageFilter.GaussianBlur(n / 220)))  # a little bloom
    band = ImageChops.lighter(band, glow)
    mask = Image.new("L", (n, n), 0)
    m = ImageDraw.Draw(mask)
    m.ellipse((0, 0, n - 1, n - 1), fill=255)
    inner = round(n * (RING + GAP))
    m.ellipse((inner, inner, n - 1 - inner, n - 1 - inner), fill=0)
    band.putalpha(mask)
    return band


def token(im, color, crop=True):
    im = im.convert("RGBA")
    if crop:
        im = frame(im)
    n = SIZE * SS
    im = im.resize((n, n), Image.LANCZOS)
    disc = Image.new("L", (n, n), 0)
    inner = round(n * (RING + GAP))
    ImageDraw.Draw(disc).ellipse((inner, inner, n - inner - 1, n - inner - 1), fill=255)
    out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    back = Image.new("RGBA", (n, n), BACK + (255,))
    # a faint glow of the ring's color behind the figure, so a dark figure reads against the dark disc
    glow = Image.new("RGBA", (n, n), color + (0,))
    g = Image.new("L", (n, n), 0)
    ImageDraw.Draw(g).ellipse((n * 0.12, n * 0.3, n * 0.88, n * 1.2), fill=70)
    glow.putalpha(g.filter(ImageFilter.GaussianBlur(n * 0.09)))
    back = Image.alpha_composite(back, glow)
    back = Image.alpha_composite(back, im)
    out.paste(back, (0, 0), disc)
    out = Image.alpha_composite(out, bevel(n, color))
    return out.resize((SIZE, SIZE), Image.LANCZOS)


def main(root):
    out_dir = os.path.join(root, "assets/art/ring")
    os.makedirs(out_dir, exist_ok=True)
    made = set()
    for folder, color, crop in (("mooks", MAGENTA, True), ("rides", CYAN, False)):
        for f in sorted(glob.glob(os.path.join(root, "assets/art", folder, "*.webp"))):
            slug = os.path.basename(f)
            if os.path.exists(os.path.join(root, "assets/art/tokens", slug)):
                continue
            token(Image.open(f), color, crop).save(os.path.join(out_dir, slug), "WEBP", quality=88, method=6)
            made.add(slug)
    for f in glob.glob(os.path.join(out_dir, "*.webp")):
        if os.path.basename(f) not in made:
            os.remove(f)
    print(f"ring tokens: {len(made)}")


if __name__ == "__main__":
    main(sys.argv[1])
