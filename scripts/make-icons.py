"""
Build the app icons from the falcon head.

The home-screen icon is the one place the logo gets 60 pixels and no caption, so
it is cropped to the bird and laid on white — iOS flattens transparency onto
black, which turns a transparent logo into a smear. Maskable icons keep a wider
margin because Android crops them to a circle on some launchers.

One-off tool, run by hand when the mark changes:
    pip install pillow && python3 scripts/make-icons.py
"""

from PIL import Image

SRC = "public/logos/falcon-head.png"
WHITE = (255, 255, 255, 255)


def tile(size: int, fill: float, background=WHITE) -> Image.Image:
    """The falcon head centred on a square, taking `fill` of the width."""
    logo = Image.open(SRC).convert("RGBA")
    logo = logo.crop(logo.getbbox())
    w = int(size * fill)
    h = max(1, round(w * logo.height / logo.width))
    logo = logo.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), background)
    out.alpha_composite(logo, ((size - w) // 2, (size - h) // 2))
    return out


def transparent(size: int, fill: float) -> Image.Image:
    return tile(size, fill, background=(0, 0, 0, 0))


if __name__ == "__main__":
    # iOS home screen. 180 is what Safari asks for; white, because it has to be.
    tile(180, 0.92).save("src/app/apple-icon.png")
    # Browser tab. Transparent so it sits on a light or a dark tab bar.
    transparent(512, 0.94).save("src/app/icon.png")
    # Android / installed web app.
    tile(192, 0.92).save("public/icons/icon-192.png")
    tile(512, 0.92).save("public/icons/icon-512.png")
    # Maskable: launchers crop to a circle, so the bird stays inside the middle.
    tile(512, 0.66).save("public/icons/icon-maskable-512.png")
    print("icons written")
