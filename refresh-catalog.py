"""Bundle all audited lessons with AST-extracted local source (no strategy imports)."""
import ast
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
BASE = ROOT / 'sources' / 'strategies'
WEB = ROOT


def source_value(node, source):
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError):
        return {'expression': ast.get_source_segment(source, node)}


def extract(path):
    source = path.read_bytes().decode("utf-8")
    tree = ast.parse(source)
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef))
    attrs, params, methods = {}, [], []
    for n in cls.body:
        if isinstance(n, (ast.Assign, ast.AnnAssign)):
            target = n.targets[0] if isinstance(n, ast.Assign) else n.target
            if not isinstance(target, ast.Name) or n.value is None:
                continue
            value = source_value(n.value, source)
            attrs[target.id] = value
            param = {'name': target.id, 'value': value, 'line': n.lineno,
                     'code': ast.get_source_segment(source, n.value)}
            if isinstance(n.value, ast.Call) and isinstance(n.value.func, ast.Name) and n.value.func.id.endswith('Parameter'):
                param['type'] = n.value.func.id
                param['arguments'] = [source_value(a, source) for a in n.value.args]
                param['options'] = {k.arg: source_value(k.value, source) for k in n.value.keywords}
            params.append(param)
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            methods.append({'name': n.name, 'line': n.lineno,
                            'code': ast.get_source_segment(source, n)})
    for p in params:
        for space in ['buy_params', 'sell_params']:
            saved = attrs.get(space, {})
            if isinstance(saved, dict) and p['name'] in saved:
                p['saved'] = saved[p['name']]
                p['savedFrom'] = space
    return {'id': str(path.relative_to(BASE).with_suffix('')), 'name': cls.name,
            'group': str(path.parent.relative_to(BASE)), 'path': str(path.relative_to(ROOT)),
            'source': source, 'sha256': hashlib.sha256(source.encode()).hexdigest(),
            'attributes': attrs, 'parameters': params, 'methods': methods}


def build():
    help_catalog = json.loads((ROOT / 'indicator-help.json').read_text())
    entry_guides = json.loads((ROOT / 'entry-guides.json').read_text())
    primers = json.loads((ROOT / 'indicator-primers.json').read_text())
    used_primers = set()
    lessons = {}
    for path in sorted((WEB / 'lessons').glob('*.json')):
        for lesson in json.loads(path.read_text()):
            if lesson['id'] in lessons:
                raise ValueError(f'Duplicate lesson: {lesson["id"]}')
            for indicator in lesson['indicators']:
                key = indicator['key']
                if not isinstance(primers.get(key), str) or len(primers[key]) < 20:
                    raise ValueError(f'Missing plain-language indicator primer: {key}')
                indicator['plain'] = primers[key]
                used_primers.add(key)
                if key not in help_catalog['indicators']:
                    raise ValueError(f'Missing indicator help review: {lesson["id"]}/{key}')
                reference = {
                    **help_catalog['indicators'][key],
                    **help_catalog['overrides'].get(lesson['id'], {}).get(key, {}),
                    **indicator.get('tradingView', {}),
                }
                for link in [reference, *reference.get('additionalLinks', [])]:
                    url = urlparse(link['url'])
                    if (url.scheme != 'https' or url.netloc != 'cn.tradingview.com'
                            or not url.path.startswith('/support/') or not link['label']):
                        raise ValueError(f'Invalid Chinese help link: {lesson["id"]}/{key}')
                indicator['tradingView'] = reference
            lessons[lesson['id']] = lesson
    entries = [extract(path) for path in sorted(BASE.rglob('*.py'))]
    missing = [entry['id'] for entry in entries if entry['id'] not in lessons]
    if missing:
        raise ValueError(f'Missing audited lessons: {missing}')
    if set(entry_guides) != {entry['id'] for entry in entries}:
        raise ValueError('Entry guides must cover exactly the current strategy set')
    if set(primers) != used_primers:
        raise ValueError('Indicator primers must match the indicators used by lessons')
    for entry in entries:
        guide = entry_guides[entry['id']]
        if guide.get('sourceHash') != entry['sha256']:
            raise ValueError(f'Stale entry guide; review against source: {entry["id"]}')
        if not guide.get('intro') or not guide.get('trap') or not guide.get('steps'):
            raise ValueError(f'Incomplete entry guide: {entry["id"]}')
        if any(not step.get('title') or not step.get('text') for step in guide['steps']):
            raise ValueError(f'Incomplete entry step: {entry["id"]}')
        if not all(guide.get('example', {}).get(key) for key in ('passes', 'blocked')):
            raise ValueError(f'Missing entry examples: {entry["id"]}')
        entry['lesson'] = lessons[entry['id']]
        entry['lesson']['entryGuide'] = guide
    provenance = json.loads((ROOT / 'sources' / 'manifest.json').read_text())
    data = {'strategies': [e['id'] for e in entries], 'entries': entries,
            'source': (BASE / 'Strategy001.py').read_text(),
            'revision': provenance['revision'][:7], 'provenance': provenance}
    (WEB / 'catalog.js').write_text('// Generated by refresh-catalog.py. Edit lessons/*.json, entry-guides.json and indicator-primers.json, not this bundle.\nwindow.StrategyCatalog = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'Bundled {len(entries)} audited strategies, including subdirectories.')


if __name__ == '__main__':
    build()
