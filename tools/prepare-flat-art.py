#!/usr/bin/env python3
"""Export the approved flat (no-outline) redraws as the game's only pig artwork.

uv run --with pillow python tools/prepare-flat-art.py /zyx/codex/dsh-piggy-artwork/face-restore/2026-10-12
2026-10-13: the user kept only the no-outline style (redrawn 1:1 from the pre-0.35 art) and dropped the outlined set.
Originals, every version and the review records stay outside the repository.
"""
import hashlib
import importlib.util
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prepare_pig_art", ROOT / "tools/prepare-pig-art.py")
prepare_pig_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare_pig_art)

BASE = Path(sys.argv[1]).resolve()
jobs = json.loads((BASE / "jobs.json").read_text())
prompt_dir = ROOT / "docs/art-prompts/flat-pigs"
shutil.rmtree(prompt_dir, ignore_errors=True)
prompt_dir.mkdir(parents=True)
entries = []
for job in jobs:
    flat = job["flat_no_outline"]
    if flat.get("status") not in ("claude-approved", "user-approved"):
        raise ValueError(f"{job['key']} is not approved: {flat.get('status')}")
    source = BASE / flat["draft"]
    path = job["runtime_outlined"]
    dimensions, bounds, output_bounds, size = prepare_pig_art.prepare(source, ROOT / "assets" / path)
    prompt = BASE / flat["prompt"] if flat.get("prompt") else None
    prompt_rel = None
    if prompt and prompt.exists():
        target = prompt_dir / (job["key"].replace("/", "__") + ".txt")
        shutil.copyfile(prompt, target)
        prompt_rel = str(target.relative_to(ROOT))
    entries.append({
        "key": job["key"], "path": path, "actor": job["actor"], "action": job["action"],
        "version": f"{job['key']}-flat-v{flat['version']}", "tool": "image_gen", "prompt": prompt_rel,
        "reference": job.get("old_reference_source") or "piglet face (old idle)",
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "sourceDimensions": dimensions, "sourceBounds": bounds, "bounds": output_bounds,
        "sha256": hashlib.sha256((ROOT / "assets" / path).read_bytes()).hexdigest(), "bytes": size,
    })
(ROOT / "assets/pigs/manifest.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")
print(f"{len(entries)} images, {sum(e['bytes'] for e in entries):,} bytes")
