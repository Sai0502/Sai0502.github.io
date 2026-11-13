#!/usr/bin/env python3
"""Rewrite the search.paths list in index.html from the .md files on disk.

Docsify's search plugin indexes only the pages it is told about. With
paths: 'auto' that list is whatever the current sidebar links to, so pages
missing from a sidebar could never be found. A fixed list fixes that, but then
a page added later is invisible until this script is run again:

    python3 tools/update-search-paths.py && git add -A && git commit -m "..."
"""

import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', 'node_modules', 'plugins', 'img', 'tools'}
INDEX = os.path.join(ROOT, 'index.html')


def collect():
    paths = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if not name.lower().endswith('.md') or name.startswith('_'):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT).replace(os.sep, '/')[:-3]
            paths.append('/' + rel)
    return sorted(paths)


def main():
    paths = collect()
    if not paths:
        sys.exit('no markdown pages found')

    with io.open(INDEX, encoding='utf-8', newline='') as fh:
        html = fh.read()

    nl = '\r\n' if '\r\n' in html else '\n'
    indent = ' ' * 20
    body = ''.join(indent + json.dumps(p, ensure_ascii=False) + ',' + nl for p in paths)
    block = 'paths: [' + nl + body + ' ' * 16 + '],'

    pattern = re.compile(r"paths: (?:'auto'|\[.*?\n *\],)", re.S)
    if not pattern.search(html):
        sys.exit('could not find the search paths setting in index.html')
    html = pattern.sub(lambda _: block, html, count=1)

    with io.open(INDEX, 'w', encoding='utf-8', newline='') as fh:
        fh.write(html)

    print('%d pages written to index.html' % len(paths))


if __name__ == '__main__':
    main()
