"""把已批准的木托盘素材缩到显示尺寸约两倍；仅缩放和转格式，不修改像素内容。
用法：python scripts/pack-farm-ui.py <farm-v4-ui 素材目录>
九宫格使用原图 border-image，保留 manifest 的 inset；不另打包九块图。
"""
import json
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
output = Path(__file__).resolve().parents[1] / 'extensions/farm/assets'
skip = {'pack-title-text', 'shop-title-text', 'seed-packet-cursor', 'card-frame-body', 'card-tail'}
frames = {'pack-bar', 'shop-frame', 'buy-frame', 'card-frame', 'tip-card'}
large = {'seed-packet', 'shop-item', 'shop-item-locked', 'buy-title', 'shop-title', 'info-row', 'btn-confirm', 'btn-cancel', 'progress-track', 'progress-fill'}
for path in sorted((source / 'export').glob('*.png')):
    if path.stem in skip:
        continue
    image = Image.open(path)
    limit = 512 if path.stem in frames else 320 if 'plot-hover' in path.stem else 256 if path.stem in large else 192 if path.stem.startswith(('pack-slot', 'pack-title')) else 128
    if max(image.size) > limit:
        scale = limit / max(image.size)
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    image.save(output / (path.stem + '.webp'), 'WEBP', quality=86, method=6)
manifest_path = output.parent / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['assets'] = sorted(path.name for path in output.glob('*.webp'))
art_manifest = json.loads((source / 'manifest.json').read_text())
manifest['assetLayout'] = {}
for path in output.glob('*.webp'):
    packed_size = Image.open(path).size
    spec = art_manifest.get(path.stem, {})
    scale = packed_size[0] / spec.get('size', packed_size)[0]
    info = {'size': list(packed_size)}
    if spec.get('nine_slice', {}).get('insets'):
        info['nine_slice'] = {'insets': [round(n * scale) for n in spec['nine_slice']['insets']]}
    if 'inner_insets' in spec:
        info['inner_insets'] = [n * scale for n in spec['inner_insets']]
    if 'content_padding' in spec:
        info['content_padding'] = spec['content_padding']
    manifest['assetLayout'][path.name] = info
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(len(manifest['assets']), 'assets,', sum(path.stat().st_size for path in output.glob('*.webp')), 'bytes')
