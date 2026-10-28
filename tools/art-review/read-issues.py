#!/usr/bin/env python3
"""Read saved image checks and notes, keeping old-version feedback separate."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--state-dir', type=Path, required=True,
                    help='private review state directory (registry.json + structure-issues.json)')
args = parser.parse_args()
registry = json.loads((args.state_dir / 'registry.json').read_text())
by_id = {item['id']: item for item in registry['images']}
path = args.state_dir / 'structure-issues.json'
saved = json.loads(path.read_text()) if path.exists() else []
issues = saved if isinstance(saved, list) else saved['issues']
active, previous = [], []
for issue in issues:
    if issue.get('needs_revision') is not True:
        continue
    current = by_id.get(issue['id'])
    entry = dict(issue)
    entry['note'] = issue.get('note', '')
    if current and current['sha256'] == issue['sha256']:
        original = Path(current['working_original'])
        entry['working_original_matches'] = original.is_file() and hashlib.sha256(original.read_bytes()).hexdigest() == issue['sha256']
        active.append(entry)
    else:
        previous.append(entry)
print(json.dumps({'meaning': 'checked_means_structure_needs_revision', 'active_count': len(active),
                  'active': active, 'previous_versions': previous}, ensure_ascii=False, indent=2))
