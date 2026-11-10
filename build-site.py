"""Export only public website assets; requires Python 3, no third-party packages."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = (
    'index.html', 'styles.css', 'app.js', 'catalog.js',
    'model.js', 'learning-model.js', 'library.js', 'LICENSE',
)


def build(output):
    output = output.resolve()
    if output == ROOT or ROOT in output.parents and output != ROOT / 'dist':
        raise ValueError('Use dist/ or a separate directory outside the repository.')
    output.mkdir(parents=True, exist_ok=True)
    unexpected = {p.name for p in output.iterdir()} - set(PUBLIC_FILES) - {'version.json'}
    if unexpected:
        raise ValueError(f'Output contains unexpected files: {sorted(unexpected)}')
    hashes = {}
    for name in PUBLIC_FILES:
        shutil.copyfile(ROOT / name, output / name)
        hashes[name] = hashlib.sha256((output / name).read_bytes()).hexdigest()
    provenance = json.loads((ROOT / 'sources' / 'manifest.json').read_text())
    (output / 'version.json').write_text(json.dumps({
        'source': provenance, 'files': hashes,
    }, ensure_ascii=False, indent=2) + '\n')
    print(f'Published {len(PUBLIC_FILES)} public assets to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    build(parser.parse_args().output)
