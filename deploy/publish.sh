#!/bin/sh
# Run on the Linux web server: sudo sh deploy/publish.sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo 'Run with sudo: sudo sh deploy/publish.sh' >&2
    exit 1
fi

repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
site=/var/www/quant-learn
releases=/var/www/quant-learn-releases
if [ -e "$site" ] && [ ! -L "$site" ]; then
    echo "$site exists and is not a managed symlink; leaving it unchanged." >&2
    exit 1
fi

umask 022
mkdir -p "$releases"
release=$(mktemp -d "$releases/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
python3 "$repo/build-site.py" --output "$release"
find "$release" -type d -exec chmod 755 {} \;
find "$release" -type f -exec chmod 644 {} \;
next=/var/www/.quant-learn-next-$$
trap 'rm -f "$next"' EXIT HUP INT TERM
ln -s "$release" "$next"
mv -Tf "$next" "$site"
echo "Active release: $release"
echo 'Existing releases are retained for rollback.'
