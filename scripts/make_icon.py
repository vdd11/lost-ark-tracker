"""Draw the app icon and write every file that uses it.

One design, drawn on a 64-unit grid: a dark tile with a gold rim and a cut
gold gem, lit from the top left. Run after changing it:

    backend/.venv/Scripts/python scripts/make_icon.py

Writes backend/assets/icon.ico (the Windows exe), backend/assets/icon.png
(the tray), and frontend/app/favicon.ico, icon.svg and apple-icon.png.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "backend" / "assets"
APP = ROOT / "frontend" / "app"

TILE_TOP, TILE_BOTTOM = "#2b3242", "#11141b"
RIM, RIM_INNER = "#c9a14e", "#5a4826"
OUTLINE = "#4a3814"
GLOW = "#f2c96b"

# The gem: an outer diamond and its table (the flat top), split into facets.
OUTER = {"t": (32, 9), "r": (55, 32), "b": (32, 55), "l": (9, 32)}
TABLE = {"t": (32, 21), "r": (43, 32), "b": (32, 43), "l": (21, 32)}
C = (32, 32)
# Facets with their shade: light comes from the top left.
FACETS = [
    ([OUTER["l"], OUTER["t"], TABLE["t"], TABLE["l"]], "#fbe7a8"),
    ([OUTER["t"], OUTER["r"], TABLE["r"], TABLE["t"]], "#e9bd5a"),
    ([OUTER["r"], OUTER["b"], TABLE["b"], TABLE["r"]], "#9c6b1e"),
    ([OUTER["b"], OUTER["l"], TABLE["l"], TABLE["b"]], "#c48f33"),
    ([TABLE["l"], TABLE["t"], C], "#fff3cf"),
    ([TABLE["t"], TABLE["r"], C], "#f6d98a"),
    ([TABLE["r"], TABLE["b"], C], "#d9a645"),
    ([TABLE["b"], TABLE["l"], C], "#ecc46b"),
]
GEM = [OUTER["t"], OUTER["r"], OUTER["b"], OUTER["l"]]


def rgb(color: str) -> tuple[int, int, int]:
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def draw(size: int) -> Image.Image:
    """The icon at `size` pixels, drawn 4x larger and scaled down for smooth edges."""
    big = size * 4
    k = big / 64
    pts = lambda points: [(x * k, y * k) for x, y in points]  # noqa: E731

    # The tile: a vertical gradient inside a rounded square.
    gradient = Image.new("RGBA", (1, big))
    top, bottom = rgb(TILE_TOP), rgb(TILE_BOTTOM)
    for y in range(big):
        f = y / (big - 1)
        gradient.putpixel((0, y), tuple(round(a + (b - a) * f) for a, b in zip(top, bottom)) + (255,))
    gradient = gradient.resize((big, big))
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((2 * k, 2 * k, 62 * k, 62 * k), radius=13 * k, fill=255)
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    image.paste(gradient, (0, 0), mask)

    # A soft glow behind the gem.
    glow = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((14 * k, 14 * k, 50 * k, 50 * k), fill=rgb(GLOW) + (110,))
    glow = glow.filter(ImageFilter.GaussianBlur(7 * k))
    image.alpha_composite(Image.composite(glow, Image.new("RGBA", glow.size), mask))

    d = ImageDraw.Draw(image)
    d.rounded_rectangle((2 * k, 2 * k, 62 * k, 62 * k), radius=13 * k, outline=RIM, width=round(2.5 * k))
    d.rounded_rectangle((5.5 * k, 5.5 * k, 58.5 * k, 58.5 * k), radius=10 * k, outline=RIM_INNER, width=max(1, round(0.8 * k)))
    for points, color in FACETS:
        d.polygon(pts(points), fill=color)
    d.line(pts(GEM + GEM[:1]), fill=OUTLINE, width=round(1.6 * k), joint="curve")
    return image.resize((size, size), Image.LANCZOS)


def svg() -> str:
    poly = lambda points: " ".join(f"{x},{y}" for x, y in points)  # noqa: E731
    facets = "\n".join(f'  <polygon points="{poly(p)}" fill="{c}"/>' for p, c in FACETS)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{TILE_TOP}"/>
      <stop offset="1" stop-color="{TILE_BOTTOM}"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="{GLOW}" stop-opacity=".45"/>
      <stop offset="1" stop-color="{GLOW}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="13" fill="url(#tile)"/>
  <circle cx="32" cy="32" r="26" fill="url(#glow)"/>
  <rect x="2" y="2" width="60" height="60" rx="13" fill="none" stroke="{RIM}" stroke-width="2.5"/>
  <rect x="5.5" y="5.5" width="53" height="53" rx="10" fill="none" stroke="{RIM_INNER}" stroke-width=".8"/>
{facets}
  <polygon points="{poly(GEM)}" fill="none" stroke="{OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
</svg>
"""


def main():
    ASSETS.mkdir(exist_ok=True)
    full = draw(256)
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    # Each size drawn on its own, so the small ones stay sharp.
    frames = [draw(s) for s in ico_sizes]
    for path in (ASSETS / "icon.ico", APP / "favicon.ico"):
        frames[-1].save(path, sizes=[(s, s) for s in ico_sizes], append_images=frames[:-1])
    full.save(ASSETS / "icon.png")
    draw(180).save(APP / "apple-icon.png")
    (APP / "icon.svg").write_text(svg(), encoding="utf-8", newline="\n")
    print("wrote", ASSETS / "icon.ico", ASSETS / "icon.png", APP / "favicon.ico", APP / "icon.svg", APP / "apple-icon.png")


if __name__ == "__main__":
    main()
