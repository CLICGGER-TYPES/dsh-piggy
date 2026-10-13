"""打包已审 fix4 原稿；等比缩小、WebP 压缩、按美术矩形拆悬停尾巴。
原稿目录作为参数；保留旧物理文件，只更新声明清单。预算不满足则拒绝写入。
"""
import hashlib
import io
import json
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
manifest_path = root / 'extensions/farm/manifest.json'
manifest = json.loads(manifest_path.read_text())
specs = json.loads((source / 'manifest.json').read_text())['assets']
output = root / 'extensions/farm/assets'
layout = manifest['assetLayout']
packed = {}
records = []
for name, spec in specs.items():
    path = source / spec['export']
    image = Image.open(path).convert('RGBA')
    if name == 'card-frame':
        tail = image.crop(spec['tail']['source_rect'])
        buf = io.BytesIO()
        tail.save(buf, 'WEBP', lossless=True, method=6)
        packed['card-tail.webp'] = buf.getvalue()
        records.append({'asset': 'card-tail.webp', 'source': spec['source'], 'source_rect': spec['tail']['source_rect'], 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'packed_size': list(tail.size), 'packed_bytes': len(packed['card-tail.webp']), 'packed_sha256': hashlib.sha256(packed['card-tail.webp']).hexdigest()})
        layout['card-tail.webp'] = {'size': list(tail.size), 'render_mode': 'contain'}
        body = image.crop(spec['nine_slice']['source_rect'])
        # 下边只铺直边样本，尾巴独立绘制一次，不进入九宫格边缘。
        strip = image.crop(spec['nine_slice']['edge_source_rects']['bottom'])
        inset = spec['nine_slice']['insets'][3]
        end = body.width - spec['nine_slice']['insets'][1]
        for x in range(inset, end, strip.width):
            part = strip.crop((0, 0, min(strip.width, end - x), strip.height))
            body.paste(part, (x, body.height - strip.height))
        image = body
    original = image.size
    limit = 1152 if name.startswith('bg-big-') else 560 if name.startswith('bg-small-') else 512 if spec.get('nine_slice') else 320 if 'plot' in name else 256
    scale = min(1, limit / max(image.size))
    size = tuple(round(n * scale) for n in image.size)
    if size != image.size:
        image = image.resize(size, Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, 'WEBP', quality=72 if name.startswith('bg-') else 86, method=6)
    filename = name + '.webp'
    packed[filename] = buf.getvalue()
    info = {'size': list(size), 'render_mode': spec.get('render_mode', 'cover' if name.startswith('bg-') else 'contain')}
    if spec.get('nine_slice'):
        info['nine_slice'] = {'insets': [round(n * size[0] / original[0]) for n in spec['nine_slice']['insets']], 'edge_mode': spec['nine_slice']['edge_mode']}
    if 'inner_insets' in spec:
        info['inner_insets'] = [n * size[0] / original[0] for n in spec['inner_insets']]
    if 'content_padding' in spec:
        info['content_padding'] = spec['content_padding']
    layout[filename] = info
    records.append({'asset': filename, 'source': spec['source'], 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'packed_size': list(size), 'packed_bytes': len(packed[filename]), 'packed_sha256': hashlib.sha256(packed[filename]).hexdigest()})
assets = (set(manifest['assets']) - {'bg-big.webp', 'bg-small.webp'}) | set(packed)
total = sum(len(packed[n]) if n in packed else (output / n).stat().st_size for n in assets)
assert len(assets) <= 256, len(assets)
assert total <= 4 * 1024 * 1024, total
assert all(len(v) <= 512 * 1024 for v in packed.values())
for name, data in packed.items():
    (output / name).write_bytes(data)
layout.update(json.loads((output.parent / 'asset-layout-measurements.json').read_text()))
manifest['assets'] = sorted(assets)
manifest['assetLayout'] = {n: layout[n] for n in sorted(assets)}
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(output.parent / 'fix4-art-pack.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print(len(assets), 'assets;', total, 'bytes;', len(packed), 'approved replacements/additions')
