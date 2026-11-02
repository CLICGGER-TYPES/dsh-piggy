#!/usr/bin/env python3
"""Publish current review pictures separately from generation work and private feedback."""
import argparse
import html
import json
import os
import re
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from publish_io import (
    ReviewError as PublishError,
    archive_stale,
    commit_staged,
    ensure_disjoint,
    format_failures,
    public_target,
    read_bytes_or_none,
    restore_bytes,
    rollback_files,
    safe_component,
    sha256_file,
    source_file,
    within,
    write_json,
)

HERE = Path(__file__).resolve().parent
LABELS = {'postman': '邮差猪', 'gardener': '园丁猪', 'raincoat': '雨衣猪',
          'painter': '画家猪', 'firefighter': '消防员猪', 'musician': '音乐家猪'}
SCENES = dict(zip('idle eat bathe play pet relaxed work study trip fish sleep'.split(),
                  '待机 吃饭 洗澡 玩耍 摸摸 放松 工作 学习 旅行 钓鱼 睡觉'.split()))
HEX64 = re.compile(r'^[0-9a-fA-F]{64}$')
DESIGNS_LINK = '<p><a href="designs.html">钓鱼与菜园设计样稿</a></p>'


def render(source, registry, css, script, comparison=False):
    by_image = {entry['source_relative']: entry for entry in registry}
    tag = 'article' if comparison else 'figure'
    pattern = rf'<{tag}\s+data-scene="([^"]+)"([^>]*)>(.*?)</{tag}>'

    def attach(match):
        body = match.group(3)
        image = next((value for value in re.findall(r'href="([^"]+\.png)"', body)
                      if value in by_image), None)
        if image is None:
            return match.group(0)
        entry = by_image[image]
        attrs = ' '.join(f'data-review-{key}="{html.escape(entry[field], quote=True)}"'
                         for key, field in [('id', 'id'), ('hash', 'sha256'), ('label', 'label')])
        return f'<{tag} data-scene="{match.group(1)}"{match.group(2)} {attrs}>{body}</{tag}>'

    text = re.sub(pattern, attach, source, flags=re.S)
    text = text.replace('href="review.html"', 'href="index.html"')
    text = text.replace('src="exports/', 'src="images/')
    text = re.sub(r'href="([^"]+\.png)"',
                  lambda m: f'href="originals/{m.group(1)}"' if m.group(1) in by_image else m.group(0), text)
    text = text.replace('<header>', f'<style>{css}</style><header>', 1)
    return text.replace('</html>', f'<script>{script}</script></html>')


def load_manifest(source):
    path = source / 'delivery-manifest.json'
    try:
        manifest = json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError as exc:
        raise PublishError(f'delivery manifest not found: {path}') from exc
    except (OSError, ValueError) as exc:
        raise PublishError(f'delivery manifest is unreadable: {path}') from exc
    if not isinstance(manifest, dict) or not isinstance(manifest.get('records'), list):
        raise PublishError('delivery-manifest.json must contain a records list')
    if not manifest['records']:
        raise PublishError('delivery-manifest.json records must not be empty')
    return manifest['records']


def build_images(records, public, state_dir):
    images, sources, files = [], {}, set()
    ids, relatives = set(), set()
    for index, item in enumerate(records):
        field = f'records[{index}]'
        if not isinstance(item, dict):
            raise PublishError(f'{field} must be an object')
        actor = safe_component(item.get('character'), f'{field}.character')
        scene = safe_component(item.get('scene'), f'{field}.scene')
        ident = f'{actor}/{scene}'
        relative = f'{actor}/{scene}.png'
        if ident in ids:
            raise PublishError(f'duplicate review id: {ident}')
        if relative in relatives:
            raise PublishError(f'duplicate review image path: {relative}')
        expected = item.get('sha256')
        if not isinstance(expected, str) or not HEX64.match(expected):
            raise PublishError(f'{field}.sha256 must be a 64-character hex digest')
        original = source_file(item.get('original'), f'{field}.original', public, state_dir)
        preview = source_file(item.get('export'), f'{field}.export', public, state_dir)
        digest = sha256_file(original)
        if digest != expected.lower():
            raise PublishError(f'original changed since export: {item.get("original")}')
        label = f'{LABELS.get(actor, actor)} · {SCENES.get(scene, scene)}'
        images.append({'id': ident, 'label': label, 'sha256': digest,
                       'image': 'originals/' + relative, 'source_relative': relative,
                       'working_original': str(original)})
        sources['originals/' + relative] = original
        sources['images/' + relative] = preview
        files.update(('originals/' + relative, 'images/' + relative))
        ids.add(ident)
        relatives.add(relative)
    return images, sources, files


def add_before_images(source, sources, files):
    before_dir = source / 'before'
    if not before_dir.is_dir():
        return
    root = before_dir.resolve()
    if not within(root, source):
        raise PublishError('--source/before must not point outside --source')
    for path in sorted(root.rglob('*.png')):
        target = path.resolve()
        if not within(target, root):
            raise PublishError(f'before image escapes --source/before: {path}')
        if not target.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        name = 'before/' + relative
        sources[name] = target
        files.add(name)


def load_extras(state_dir, public, ids, files):
    extra_path = state_dir / 'extra-images.json'
    extras = []
    has_designs = False
    if not extra_path.exists():
        return extras, has_designs
    try:
        payload = json.loads(extra_path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        raise PublishError(f'extra-images.json is unreadable: {extra_path}') from exc
    if not isinstance(payload, dict) or not isinstance(payload.get('images'), list):
        raise PublishError('extra-images.json must contain an images list')
    for index, item in enumerate(payload['images']):
        field = f'extra-images[{index}]'
        if not isinstance(item, dict):
            raise PublishError(f'{field} must be an object')
        ident = item.get('id')
        if not isinstance(ident, str) or not ident or len(ident) > 256:
            raise PublishError(f'{field}.id must be a non-empty string')
        if ident in ids:
            raise PublishError(f'duplicate review id: {ident}')
        image = item.get('image')
        if not isinstance(image, str) or not image or image.startswith('/') or '\\' in image or '\x00' in image:
            raise PublishError(f'{field}.image must be a safe relative path')
        pure = Path(image)
        if pure.is_absolute() or any(part in ('..', '') for part in pure.parts):
            raise PublishError(f'{field}.image must not escape --public')
        target = public_target(public, image, f'{field}.image')
        if not target.is_file():
            raise PublishError(f'{field}.image does not exist in --public: {image}')
        expected = item.get('sha256')
        if not isinstance(expected, str) or not HEX64.match(expected):
            raise PublishError(f'{field}.sha256 must be a 64-character hex digest')
        if sha256_file(target) != expected.lower():
            raise PublishError(f'{field}.image changed since registration: {image}')
        extras.append(dict(item))
        ids.add(ident)
        files.add(image)
    has_designs = (public / 'designs.html').is_file()
    if has_designs:
        for name in ('designs.html', 'farm-review.html', 'farm-navigation.html', 'interaction-proposal.html'):
            if (public / name).is_file():
                files.add(name)
    return extras, has_designs


def publish(source, public, state_dir):
    source, public, state_dir = Path(source).resolve(), Path(public).resolve(), Path(state_dir).resolve()
    ensure_disjoint(source, public, state_dir)
    if not source.is_dir():
        raise PublishError(f'--source is not a directory: {source}')
    public.mkdir(parents=True, exist_ok=True)
    state_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
    registry_path = state_dir / 'registry.json'
    publication_path = state_dir / 'publication.json'
    previous = {}
    previous_bytes = read_bytes_or_none(publication_path)
    if previous_bytes is not None:
        try:
            loaded = json.loads(previous_bytes.decode('utf-8'))
        except (UnicodeDecodeError, ValueError) as exc:
            raise PublishError(f'publication.json is unreadable: {publication_path}') from exc
        if not isinstance(loaded, dict):
            raise PublishError('publication.json must contain an object')
        previous = loaded
    previous_files = previous.get('files') if isinstance(previous.get('files'), list) else []

    records = load_manifest(source)
    images, sources, files = build_images(records, public, state_dir)
    add_before_images(source, sources, files)
    main_images = list(images)
    extras, has_designs = load_extras(state_dir, public, {entry['id'] for entry in images}, files)
    images.extend(extras)

    css = (HERE / 'feedback.css').read_text(encoding='utf-8')
    script = (HERE / 'feedback.js').read_text(encoding='utf-8')
    pages = {}
    for old_name, name in [('review.html', 'index.html'), ('comparison.html', 'comparison.html')]:
        page_source = source / old_name
        if not page_source.is_file():
            continue
        pages[name] = render(page_source.read_text(encoding='utf-8'), main_images,
                             css, script, name == 'comparison.html')
        files.add(name)
    if has_designs:
        for name in ('index.html', 'comparison.html'):
            if name in pages:
                pages[name] = pages[name].replace('</header>', DESIGNS_LINK + '</header>')
            elif (public / name).is_file():
                pages[name] = (public / name).read_text(encoding='utf-8').replace('</header>', DESIGNS_LINK + '</header>')
                files.add(name)

    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    rollback_root = state_dir / 'rollback' / f'{stamp}-{os.getpid()}'
    old_registry_bytes = read_bytes_or_none(registry_path)
    staging = Path(tempfile.mkdtemp(prefix=f'.publish-stage-{os.getpid()}-', dir=str(state_dir)))
    try:
        staged = {}
        for relative, path in sources.items():
            target = staging / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            staged[relative] = target
        for relative, text in pages.items():
            target = staging / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding='utf-8')
            staged[relative] = target
        for relative in staged:
            if not (staging / relative).is_file():
                raise PublishError(f'staged file is missing: {relative}')

        written, backups = commit_staged(public, staged, rollback_root)
        try:
            write_json(registry_path, {'images': images})
            write_json(publication_path, {'source': str(source), 'root': str(public),
                                          'updated_at': stamp, 'files': sorted(files)})
        except BaseException as exc:
            failures = []
            for path, data in ((registry_path, old_registry_bytes), (publication_path, previous_bytes)):
                try:
                    restore_bytes(path, data)
                except Exception as error:
                    failures.append((str(path), '(state file)', str(error)))
            failures.extend(rollback_files(written, backups))
            if failures:
                raise PublishError(format_failures('state rollback incomplete', failures, rollback_root)) from exc
            raise
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    shutil.rmtree(rollback_root, ignore_errors=True)

    warnings = archive_stale(public, state_dir, stamp, previous_files, files)
    result = {'review_root': str(public), 'images': len(images),
              'issue_file': str(state_dir / 'structure-issues.json')}
    if warnings:
        result['warnings'] = warnings
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--public', type=Path, required=True)
    parser.add_argument('--state-dir', type=Path, required=True)
    args = parser.parse_args()
    try:
        publish(args.source, args.public, args.state_dir)
    except PublishError as exc:
        parser.exit(2, f'publish: {exc}\n')
