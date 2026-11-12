"""Export only public website assets; requires Python 3, no third-party packages."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = (
    'index.html', 'styles.css', 'theme.js', 'app.js', 'catalog.js',
    'model.js', 'learning-model.js', 'signal-lab.js', 'library.js', 'LICENSE',
)


def build(output):
    output = output.resolve()
    if output == ROOT or ROOT in output.parents and output != ROOT / 'dist':
        raise ValueError('Use dist/ or a separate directory outside the repository.')
    output.mkdir(parents=True, exist_ok=True)
    fixtures = []
    for source in sorted((ROOT / 'sources' / 'strategies').rglob('*.py')):
        strategy_id = source.relative_to(ROOT / 'sources' / 'strategies').with_suffix('').as_posix()
        name = 'chart-data/' + strategy_id.replace('/', '--') + '.js'
        text = (ROOT / name).read_text()
        payload = json.loads(text.split(',', 1)[1].removesuffix(');\n'))
        if payload['sourceHash'] != hashlib.sha256(source.read_bytes()).hexdigest() or payload.get('error'):
            raise ValueError(f'Stale or failed signal fixture: {strategy_id}')
        fixtures.append(name)
    unexpected = {p.name for p in output.iterdir()} - set(PUBLIC_FILES) - {'version.json', 'chart-data'}
    if unexpected:
        raise ValueError(f'Output contains unexpected files: {sorted(unexpected)}')
    hashes = {}
    for name in (*PUBLIC_FILES, *fixtures):
        (output / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, output / name)
        hashes[name] = hashlib.sha256((output / name).read_bytes()).hexdigest()
    provenance = json.loads((ROOT / 'sources' / 'manifest.json').read_text())
    (output / 'version.json').write_text(json.dumps({
        'source': provenance, 'files': hashes,
    }, ensure_ascii=False, indent=2) + '\n')
    print(f'Published {len(hashes)} public assets to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    build(parser.parse_args().output)
