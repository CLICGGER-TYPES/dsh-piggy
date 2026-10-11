"""Export generated transparent PNGs into an external artwork directory.

uv run --with pillow python tools/prepare-no-outline-art.py /absolute/artwork/root
User approval is required before copying exports into assets/.
"""
import json, hashlib, sys
from pathlib import Path
from PIL import Image

BASE=Path(sys.argv[1]).resolve()
jobs=json.loads((BASE/'jobs.json').read_text())
rows=[]
for j in jobs:
    source=Path(j['review'])
    if not source.exists():
        continue
    image=Image.open(source).convert('RGBA')
    alpha=image.getchannel('A').point(lambda a: 0 if a<=8 else 255 if a>=248 else round((a-8)*255/240))
    image.putalpha(alpha)
    box=alpha.point(lambda a: 255 if a>16 else 0).getbbox()
    if not box:
        raise ValueError('Empty image: '+j['key'])
    image=image.crop(box)
    # Premultiplied resize prevents transparent RGB from creating white edges.
    fit=224/max(image.size)
    size=(max(1,round(image.width*fit)),max(1,round(image.height*fit)))
    image=image.convert('RGBa').resize(size,Image.Resampling.LANCZOS).convert('RGBA')
    frame=Image.new('RGBA',(256,256),(0,0,0,0))
    frame.alpha_composite(image,((256-image.width)//2,(256-image.height)//2))
    clear=frame.getchannel('A').point(lambda a: 255 if a==0 else 0)
    frame.paste((0,0,0,0),(0,0),clear)
    bounds=frame.getchannel('A').point(lambda a: 255 if a>16 else 0).getbbox()
    rel=j['runtime_path'].removeprefix('pigs/no-outline/')
    output=BASE/'exports'/rel
    output.parent.mkdir(parents=True,exist_ok=True)
    frame.quantize(colors=256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(output,optimize=True)
    rows.append({'key':j['key'],'path':rel,'actor':j['actor'],'action':j['action'],
                 'version':j['version'],'bounds':bounds,'bytes':output.stat().st_size,
                 'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
                 'native_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                 'reference_version':j['reference_version'],'reference_sha256':j['reference_sha256'],
                 'prompt':str(Path(j['prompt']).relative_to(BASE)),
                 'status':'candidate-awaiting-user-review' if j['status']!='user-approved' else 'user-approved'})
(BASE/'exports/manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(f'{len(rows)}/{len(jobs)} candidates; {sum(r["bytes"] for r in rows):,} bytes')
