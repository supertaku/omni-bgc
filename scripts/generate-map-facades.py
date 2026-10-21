"""Draw original, seamless 128px facade tiles using only Python's standard library.

These are illustrative material treatments. Building footprints, heights, and
their source-derived family assignments remain in the reviewed map archive.
"""

import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/map-facades"
SIZE = 96
OUTPUT_SIZE = 128  # MapLibre seamless patterns require power-of-two dimensions.

PALETTES = {
    "glass-blue": ("#254E66", "#5085A2", "#9AC3D0", "#17354A", "#C9D3CF"),
    "glass-teal": ("#205D62", "#5C9EA0", "#AAD5C8", "#174249", "#D0D8CF"),
    "residential-warm": ("#C8B7A6", "#52788A", "#9DC3CC", "#705F58", "#E5D7C4"),
    "residential-cool": ("#B1BFC0", "#496C7A", "#8DB5C5", "#58656A", "#D4DDDA"),
    "mixed-sand": ("#C8B496", "#496B7D", "#A8C9CB", "#695B4B", "#E9D5AF"),
    "retail-bronze": ("#9B8975", "#355B68", "#8AB1B8", "#514439", "#D3B284"),
    "masonry-light": ("#D2C8B8", "#5B7480", "#A9C5C9", "#83796A", "#EAE0CD"),
    "hotel-slate": ("#8D989B", "#304D62", "#7DA6BA", "#4B5A60", "#C4CDD0"),
    "neutral-slate": ("#AAB6B5", "#4A6D7B", "#9ABBC5", "#657476", "#D2D9D3"),
    "neutral-sand": ("#C4BEB0", "#59717C", "#AFC4C6", "#817D70", "#E0D9C9"),
}


def rgb(value):
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


def tile(name, colors):
    wall, pane, shine, dark, trim = map(rgb, colors)
    pixels = bytearray(bytes(wall) * SIZE * SIZE)

    def rect(x0, y0, x1, y1, color):
        for y in range(max(0, y0), min(SIZE, y1)):
            for x in range(max(0, x0), min(SIZE, x1)):
                pixels[(y * SIZE + x) * 3:(y * SIZE + x) * 3 + 3] = bytes(color)

    for row in range(0, SIZE, 24):
        rect(0, row, SIZE, row + 2, dark)
        rect(0, row + 21, SIZE, row + 24, trim)
        for col in range(0, SIZE, 16):
            rect(col, row, col + 2, row + 24, dark)
            rect(col + 3, row + 4, col + 14, row + 19, pane)
            rect(col + 4, row + 5, col + 6, row + 16, shine)
            rect(col + 10, row + 6, col + 12, row + 17, dark)
            rect(col + 3, row + 18, col + 14, row + 20, dark)
    if name.startswith("glass"):
        for col in range(0, SIZE, 16):
            rect(col + 7, 2, col + 8, SIZE, shine)
        if name.endswith("teal"):
            for row in range(0, SIZE, 24):
                rect(0, row + 11, SIZE, row + 12, trim)
    elif name.startswith("residential"):
        for row in range(0, SIZE, 24):
            rect(0, row + 18, SIZE, row + 20, dark)
            rect(0, row + 20, SIZE, row + 23, trim)
            for col in range(0, SIZE, 16):
                rect(col + 12, row + 18, col + 13, row + 23, dark)
    elif name == "retail-bronze":
        for row in range(0, SIZE, 24):
            rect(0, row + 2, SIZE, row + 4, trim)
            rect(0, row + 20, SIZE, row + 22, dark)
    elif name == "masonry-light":
        for row in range(0, SIZE, 24):
            for col in range(0, SIZE, 16):
                rect(col + 2, row + 3, col + 14, row + 4, trim)
                rect(col + 2, row + 19, col + 14, row + 21, dark)
    elif name == "mixed-sand":
        for row in range(0, SIZE, 24):
            rect(0, row + 19, SIZE, row + 21, dark)
            rect(0, row + 21, SIZE, row + 23, trim)
    elif name == "hotel-slate":
        for row in range(0, SIZE, 24):
            for col in range(0, SIZE, 16):
                rect(col + 8, row + 4, col + 10, row + 19, dark)
    else:
        for row in range(0, SIZE, 24):
            rect(0, row + 2, SIZE, row + 3, trim)

    raw = b"".join(
        b"\0" + b"".join(
            pixels[((y * SIZE // OUTPUT_SIZE) * SIZE + x * SIZE // OUTPUT_SIZE) * 3:
                   ((y * SIZE // OUTPUT_SIZE) * SIZE + x * SIZE // OUTPUT_SIZE) * 3 + 3]
            for x in range(OUTPUT_SIZE)
        ) for y in range(OUTPUT_SIZE)
    )

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">2I5B", OUTPUT_SIZE, OUTPUT_SIZE, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    path = OUT / f"{name}.png"
    path.write_bytes(png)
    return {"path": path.name, "bytes": len(png), "sha256": hashlib.sha256(png).hexdigest()}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    images = [tile(name, colors) for name, colors in PALETTES.items()]
    (OUT / "manifest.json").write_text(json.dumps({
        "author": "Omni-BGC project",
        "license": "MIT",
        "source": "scripts/generate-map-facades.py",
        "generatorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "use": "Illustrative map facade textures only; no physical facade claim",
        "images": images,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(images)} original facade tiles")


if __name__ == "__main__":
    main()
