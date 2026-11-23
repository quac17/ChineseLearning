"""Build the Chinese Learner brand SVG package (round seal: a winding path through the
mountains up to a cloud, 云径, which also reads as a tree of knowledge; plus the
outlined wordmark).

Usage: uv run --with fonttools python build_brand.py <fonts_dir> <out_dir>
"""
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONTS, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

SEAL = "#C2321C"
SEAL_DARK = "#E0553E"
INK = "#1C1D1F"
WHITE = "#FFFFFF"
MUTED = "#6A6F73"
MUTED_DARK = "#A6ABAF"

MOUNTAIN = "#9E2715"
MOUNTAIN_DARK = "#B8402C"

# Scene drawn on a 64-unit seal (circle r=30 at 32,32), clipped to the circle.
MOUNTAINS = "M0 44L13 37L22 41L33 34L46 40L64 33V64H0Z"
ROAD = ("M14 64C22 59 34 57 34 52C34 47.5 27.5 46.5 27.5 43C27.5 40 31.4 38.5 31.6 35.5H33"
        "C33.2 38.5 32.2 40.5 32.2 43C32.2 45.5 44 47.5 44 52.5C44 57.5 40 60 44 64Z")
CLOUD = "M18 30H46A5.5 5.5 0 0 0 44.5 19.6A8 8 0 0 0 29.5 16.5A6.5 6.5 0 0 0 18 30Z"
# Favicon (<= 32px): no mountains, wider path and cloud.
ROAD_SMALL = ("M12 64C22 58 36 57 36 51C36 46 26 46 26.5 42C27 38 31 37 31 34H34"
              "C34 37 31 39 31 42C31 45 46 46 46 52C46 58 42 60 47 64Z")
CLOUD_SMALL = "M17 30H47A6 6 0 0 0 44 19A8.5 8.5 0 0 0 29 16A7 7 0 0 0 17 30Z"


def text_path(font_file, text, size, tracking_em, x, baseline):
    """Return (svg path d, advance width) of text set at size, tracking in em."""
    font = TTFont(os.path.join(FONTS, font_file))
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    scale = size / upm
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    cursor = 0.0
    for i, ch in enumerate(text):
        gname = cmap[ord(ch)]
        tpen = TransformPen(pen, (scale, 0, 0, -scale, x + cursor, baseline))
        gs[gname].draw(tpen)
        cursor += hmtx[gname][0] * scale
        if i < len(text) - 1:
            cursor += tracking_em * size
    return pen.getCommands(), cursor


def cap_height(font_file, size):
    font = TTFont(os.path.join(FONTS, font_file))
    return font["OS/2"].sCapHeight * size / font["head"].unitsPerEm


def seal(cx, cy, d, seal_fill, mountain_fill, knockout, uid, small=False):
    """Seal of diameter d centred at cx,cy.

    knockout=True (mono): one colour, path and cloud cut out, no mountains.
    """
    s = d / 64
    tx, ty = cx - 32 * s, cy - 32 * s
    road, cloud = (ROAD_SMALL, CLOUD_SMALL) if small else (ROAD, CLOUD)
    place = f'transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})"'
    if knockout:
        return (
            f'<mask id="k{uid}" maskUnits="userSpaceOnUse"><g {place}>'
            f'<circle cx="32" cy="32" r="30" fill="#fff"/><path d="{road}" fill="#000"/><path d="{cloud}" fill="#000"/></g></mask>'
            f'<g mask="url(#k{uid})"><g {place}><circle cx="32" cy="32" r="30" fill="{seal_fill}"/></g></g>'
        )
    mountains = "" if small else f'<path d="{MOUNTAINS}" fill="{mountain_fill}"/>'
    return (
        f'<clipPath id="c{uid}"><circle cx="32" cy="32" r="30"/></clipPath>'
        f'<g {place}><g clip-path="url(#c{uid})"><rect width="64" height="64" fill="{seal_fill}"/>'
        f'{mountains}<path d="{road}" fill="{WHITE}"/><path d="{cloud}" fill="{WHITE}"/></g></g>'
    )


VARIANTS = {
    # name: (seal, mountains, text, tagline, knockout)
    "full": (SEAL, MOUNTAIN, INK, MUTED, False),
    "reversed": (SEAL_DARK, MOUNTAIN_DARK, WHITE, MUTED_DARK, False),
    "mono-dark": (INK, None, INK, INK, True),
    "mono-light": (WHITE, None, WHITE, WHITE, True),
}

TITLE = '<title>Chinese Learner</title>'


def svg(w, h, body, label="Logo Chinese Learner"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
        f'width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{label}">{TITLE}{body}</svg>\n'
    )


def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(content)
    print(name, len(content.encode()), "bytes")


WM_FONT = "BeVietnamPro-ExtraBold.ttf"
TAG_FONT = "BeVietnamPro-Medium.ttf"
TRACK = -0.035

for vname, (sf, gf, tf, tagf, ko) in VARIANTS.items():
    # Icon only (64 grid, 2-unit padding already inside the circle radius)
    write(f"chinese-learner-icon-{vname}.svg", svg(64, 64, seal(32, 32, 64, sf, gf, ko, "i")))

    # Horizontal: seal 64, wordmark cap height ~ 0.5 seal, gap 16
    size = 42
    ch = cap_height(WM_FONT, size)
    base = 32 + ch / 2
    d, adv = text_path(WM_FONT, "Chinese Learner", size, TRACK, 64 + 16, base)
    w = 64 + 16 + adv + 2
    write(
        f"chinese-learner-logo-horizontal-{vname}.svg",
        svg(w, 64, seal(32, 32, 64, sf, gf, ko, "h") + f'<path d="{d}" fill="{tf}"/>'),
    )

    # Horizontal with tagline
    size_t = 38
    ch_t = cap_height(WM_FONT, size_t)
    base_t = 30
    d1, adv1 = text_path(WM_FONT, "Chinese Learner", size_t, TRACK, 80, base_t)
    d2, adv2 = text_path(TAG_FONT, "Học tiếng Trung", 15, 0, 81, base_t + 22)
    w = 80 + max(adv1, adv2) + 2
    write(
        f"chinese-learner-logo-horizontal-tagline-{vname}.svg",
        svg(w, 64, seal(32, 32, 64, sf, gf, ko, "t")
            + f'<path d="{d1}" fill="{tf}"/><path d="{d2}" fill="{tagf}"/>'),
    )

    # Vertical: seal 96 on top, wordmark centred under it
    size_v = 40
    _, adv_v = text_path(WM_FONT, "Chinese Learner", size_v, TRACK, 0, 0)
    w = max(96, adv_v) + 8
    dv, _ = text_path(WM_FONT, "Chinese Learner", size_v, TRACK, (w - adv_v) / 2, 96 + 20 + cap_height(WM_FONT, size_v) + 4)
    h = 96 + 20 + cap_height(WM_FONT, size_v) + 4 + 12
    write(
        f"chinese-learner-logo-vertical-{vname}.svg",
        svg(w, h, seal(w / 2, 48, 96, sf, gf, ko, "v") + f'<path d="{dv}" fill="{tf}"/>'),
    )

# Wordmark only
for vname, color in (("full", INK), ("reversed", WHITE)):
    size = 42
    d, adv = text_path(WM_FONT, "Chinese Learner", size, TRACK, 1, cap_height(WM_FONT, size) + 14)
    write(f"chinese-learner-wordmark-{vname}.svg", svg(adv + 2, cap_height(WM_FONT, size) + 26, f'<path d="{d}" fill="{color}"/>'))

# Favicon (simplified: no mountains, wider path and cloud)
write("favicon.svg", svg(64, 64, seal(32, 32, 64, SEAL, None, False, "f", small=True), "Chinese Learner"))

# App icon: white square (the OS applies its own rounding), seal at 72%
write(
    "app-icon.svg",
    svg(1024, 1024, f'<rect width="1024" height="1024" fill="{WHITE}"/>' + seal(512, 512, 740, SEAL, MOUNTAIN, False, "a"), "Chinese Learner"),
)
# Maskable / Android adaptive: the scene fills the square; the launcher crops it
# to its own shape, and the cloud and path top stay inside the 80% safe zone.
write(
    "app-icon-maskable.svg",
    svg(1024, 1024, f'<g transform="scale(16)"><rect width="64" height="64" fill="{SEAL}"/>'
        f'<path d="{MOUNTAINS}" fill="{MOUNTAIN}"/><path d="{ROAD}" fill="{WHITE}"/><path d="{CLOUD}" fill="{WHITE}"/></g>',
        "Chinese Learner"),
)
