#!/usr/bin/env python3
"""Rewrite the search.paths list in index.html from the .md files on disk.

Docsify's search plugin indexes only the pages it is told about. With
paths: 'auto' that list is whatever the current sidebar links to, so pages
missing from a sidebar could never be found. A fixed list fixes that, but then
a page added later is invisible until this script is run again:

    python3 tools/update-search-paths.py && git add -A && git commit -m "..."

The list is also the order results come back in, so it is written in reading
order rather than alphabetically:

    1. the columns, in the order of the top <nav> in index.html
    2. inside a column, the order of that column's sidebar (_sidebar.md)
    3. pages the sidebar does not list, at the end of their column, by name

So a new note shows up at the end of its column until it is put in the
sidebar, and moving a line in the sidebar moves it in the search results too.
"""

import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', 'node_modules', 'plugins', 'img', 'tools'}
INDEX = os.path.join(ROOT, 'index.html')


def read(path):
    with io.open(path, encoding='utf-8') as fh:
        return fh.read()


def columns(html):
    """The top nav links, in order: #/FootPrint/ -> FootPrint."""
    nav = re.search(r'<nav>(.*?)</nav>', html, re.S)
    if not nav:
        sys.exit('could not find the top <nav> in index.html')

    found = re.findall(r'href="#/([^/"]+)/?"', nav.group(1))
    if not found:
        sys.exit('the top <nav> has no #/<column>/ links')
    return found


def sidebar_paths(column):
    """Links of a column's sidebar. The first column uses the root sidebar."""
    sidebar = os.path.join(ROOT, column, '_sidebar.md')
    if not os.path.exists(sidebar):
        sidebar = os.path.join(ROOT, '_sidebar.md')
    if not os.path.exists(sidebar):
        return []

    pages = []
    for link in re.findall(r'\]\(([^)]+)\)', read(sidebar)):
        link = link.split('#')[0].strip().rstrip('/')
        if link.endswith('.md'):
            link = link[:-3]
        if not link or link.startswith(('http:', 'https:', '/')):
            continue
        page = '/' + link
        if page.startswith('/' + column + '/') and page not in pages:
            pages.append(page)
    return pages


def pages_in(column):
    """Every markdown page of a column, alphabetically."""
    found = []
    for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, column)):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if not name.lower().endswith('.md') or name.startswith('_'):
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT)
            found.append('/' + rel.replace(os.sep, '/')[:-3])
    return sorted(found)


def collect(html):
    paths = []
    for column in columns(html):
        listed = sidebar_paths(column)
        rest = [p for p in pages_in(column) if p not in listed]
        paths.extend(listed)
        paths.extend(rest)
    return paths


def main():
    with io.open(INDEX, encoding='utf-8', newline='') as fh:
        html = fh.read()

    paths = collect(html)
    if not paths:
        sys.exit('no markdown pages found')

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
