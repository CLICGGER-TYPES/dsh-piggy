"""从工作区的审定原图离线制作透明、缩小的反馈立绘。

用法：uv run --with pillow python tools/prepare-feedback-art.py SOURCE_DIR OUTPUT_DIR
SOURCE_DIR 是 selected-png，内有 single/ 与 collection/；不会修改原图。
"""

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


MAX_SIDE = 256
WHITE_MIN = 242


def remove_connected_white(image, clear_enclosed=False):
    """只去掉从画布边缘连通的近白区域，保留眼白和衣服里的白色。"""
    red, green, blue = image.convert("RGB").split()
    white = ImageChops.multiply(
        ImageChops.multiply(red.point(lambda value: 255 if value >= WHITE_MIN else 0),
                            green.point(lambda value: 255 if value >= WHITE_MIN else 0)),
        blue.point(lambda value: 255 if value >= WHITE_MIN else 0),
    )
    width, height = image.size
    for x in range(width):
        if white.getpixel((x, 0)) == 255:
            ImageDraw.floodfill(white, (x, 0), 128)
        if white.getpixel((x, height - 1)) == 255:
            ImageDraw.floodfill(white, (x, height - 1), 128)
    for y in range(height):
        if white.getpixel((0, y)) == 255:
            ImageDraw.floodfill(white, (0, y), 128)
        if white.getpixel((width - 1, y)) == 255:
            ImageDraw.floodfill(white, (width - 1, y), 128)

    # 白底噪点和主体外缘的白色混合像素一起向内去掉两像素，再轻微柔化。
    # 圆章的白色圆心被红圈封住，仍是背景；其余图的封闭白区属于眼白、衣服等。
    background = white.point(lambda value: 255 if value == 128 or (clear_enclosed and value == 255) else 0)
    alpha = ImageOps.invert(background.filter(ImageFilter.MaxFilter(5)))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7))
    result = image.convert("RGBA")
    result.putalpha(alpha)
    return result


def prepare(source, output):
    with Image.open(source) as original:
        image = original.convert("RGBA")
        if original.mode != "RGBA" or original.getchannel("A").getextrema() == (255, 255):
            image = remove_connected_white(image, source.name == "badge.png")
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        output.parent.mkdir(parents=True, exist_ok=True)
        image.save(output, optimize=True, compress_level=9)
        print(f"{output.name}: {original.width}x{original.height} -> "
              f"{image.width}x{image.height}, {output.stat().st_size} bytes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    inputs = sorted(args.source_dir.joinpath("single").glob("*.png"))
    inputs += sorted(args.source_dir.joinpath("collection").glob("*.png"))
    if len(inputs) != 38:
        parser.error(f"expected 38 selected images, found {len(inputs)}")
    for source in inputs:
        name = source.name if source.parent.name == "single" else f"collection-{source.name}"
        prepare(source, args.output_dir / name)


if __name__ == "__main__":
    main()
