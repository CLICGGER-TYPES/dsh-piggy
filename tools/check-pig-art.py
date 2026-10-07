#!/usr/bin/env python3
"""检查新画的猪图合不合规范（docs/design/pig-kitchen-art.md 第 4 节的「机器能查的部分」）。

用法：uv run --with pillow python tools/check-pig-art.py 文件或目录…
需要本机有 rsvg-convert（librsvg）来渲染。每个文件打印一行结论，有不合格的就以非 0 退出。

查什么：
  1. 文件：≤ 6KB，根节点 viewBox="0 0 64 64" width/height 64，文件头注释写明基于 piglet.svg（Noto Emoji 衍生，Apache 2.0）。
  2. 元素：只用 path / circle / ellipse / rect / polygon / polyline / line / g（以及 title、desc、defs、clipPath），
     不许位图、文字、渐变、滤镜、图案填充、样式表、脚本、外部引用。
  3. 颜色：不同的 fill/stroke 颜色 ≤ 24 种（现有皮肤约 20 种）。
  4. 画面（渲染成 256px 量）：透明底；不出界（最外一圈像素是空的）；脚底和 piglet.svg 同一高度（±1.5 单位）；
     身体水平中心和 piglet.svg 差 ≤ 4 单位（帽子、道具伸出去不算，所以只比中间那一段的横向中心）。
"""
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'assets' / 'piglet.svg'
MAX_BYTES = 6 * 1024
MAX_COLORS = 24
ALLOWED = {'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line', 'title', 'desc', 'defs', 'clipPath'}
PX = 256
UNIT = PX / 64


def render(path):
    png = subprocess.run(['rsvg-convert', '-w', str(PX), '-h', str(PX), str(path)], capture_output=True, check=True).stdout
    return Image.open(BytesIO(png)).convert('RGBA')


def geometry(img):
    """返回 (左, 上, 右, 下, 中段横向中心)，按不透明像素算；中段 = 竖向 40%～80% 那一截（身子）。"""
    alpha = img.getchannel('A')
    box = alpha.point(lambda a: 255 if a > 32 else 0).getbbox()
    if box is None:
        return None
    left, top, right, bottom = box
    band = alpha.crop((0, int(top + (bottom - top) * 0.4), PX, int(top + (bottom - top) * 0.8))).point(lambda a: 255 if a > 32 else 0).getbbox()
    center = (band[0] + band[2]) / 2 if band else (left + right) / 2
    return left, top, right, bottom, center


def check(path, base: tuple):
    problems = []
    raw = path.read_bytes()
    text = raw.decode('utf-8', 'replace')
    if len(raw) > MAX_BYTES:
        problems.append(f'文件 {len(raw)} 字节，超过 6KB')
    if not re.search(r'piglet\.svg', text) or not re.search(r'Noto', text):
        problems.append('文件头注释要写明「基于 assets/piglet.svg（Noto Emoji 衍生，Apache 2.0）」')
    try:
        tree = ET.fromstring(raw)
    except ET.ParseError as error:
        return [f'不是合法的 XML：{error}']
    tag = lambda el: el.tag.split('}')[-1]
    if tag(tree) != 'svg' or tree.get('viewBox') != '0 0 64 64' or tree.get('width') != '64' or tree.get('height') != '64':
        problems.append('根节点要是 <svg viewBox="0 0 64 64" width="64" height="64">')
    bad = sorted({tag(el) for el in tree.iter() if tag(el) not in ALLOWED})
    if bad:
        problems.append('不许用的元素：' + ', '.join(bad))
    if re.search(r'(href\s*=|url\(\s*["\']?(https?:|data:))', text):
        problems.append('有外部引用（href / url(http…) / data:）')
    if re.search(r'url\(#', text) and 'clipPath' not in text:
        problems.append('url(#…) 只能用来引用 clipPath')
    colors = {c.lower() for c in re.findall(r'(?:fill|stroke)\s*[=:]\s*"?\s*(#[0-9a-fA-F]{3,8})', text)}
    if len(colors) > MAX_COLORS:
        problems.append(f'用了 {len(colors)} 种颜色，最多 {MAX_COLORS} 种')
    try:
        img = render(path)
    except subprocess.CalledProcessError as error:
        return problems + ['渲染失败：' + error.stderr.decode('utf-8', 'replace')[:120]]
    corners = [img.getpixel(p)[3] for p in [(0, 0), (PX - 1, 0), (0, PX - 1), (PX - 1, PX - 1)]]
    if max(corners) > 0:
        problems.append('背景不透明（四个角有颜色）')
    g = geometry(img)
    if g is None:
        return problems + ['画面是空的']
    left, top, right, bottom, center = g
    if min(left, top) < 1 or max(right, bottom) > PX - 1:
        problems.append('画出界了（贴到视框边上被裁掉）')
    if abs(bottom - base[3]) > 1.5 * UNIT:
        problems.append(f'脚底高度和 piglet 差 {abs(bottom - base[3]) / UNIT:.1f} 单位（要 ≤ 1.5）')
    if abs(center - base[4]) > 4 * UNIT:
        problems.append(f'身体横向中心和 piglet 差 {abs(center - base[4]) / UNIT:.1f} 单位（要 ≤ 4）')
    return problems


def main():
    files = []
    for arg in sys.argv[1:]:
        p = Path(arg)
        files += sorted(p.glob('*.svg')) if p.is_dir() else [p]
    if not files:
        print(__doc__)
        sys.exit(2)
    base = geometry(render(BASE))
    assert base is not None, 'piglet.svg 渲染不出来'
    failed = 0
    for f in files:
        problems = check(f, base)
        failed += 1 if problems else 0
        print(('✗ ' if problems else '✓ ') + f.name + ('：' + '；'.join(problems) if problems else ''))
    print(f'{len(files) - failed}/{len(files)} 合格')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
