"""Apply the approved free font pair to portfolio pages only.
Run from repository root. Never edits application routes, copy, forms or SEO data.
"""
from pathlib import Path
from urllib.parse import urlsplit
import hashlib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path.cwd()
VERSION = 'alumni-literata-20261014'
FONT_URL = 'https://fonts.googleapis.com/css2?family=Alumni+Sans:wght@400..800&family=Literata:ital,opsz,wght@1,7..72,400..500&display=swap'


def body_digest(source):
    body = re.search(r'<body\b[\s\S]*', source, re.I)
    if not body:
        raise RuntimeError('HTML body not found')
    return hashlib.sha256(body.group(0).encode()).hexdigest()


pages = []
for loc in ET.parse(ROOT / 'sitemap.xml').getroot().iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc'):
    path = urlsplit(loc.text).path.rstrip('/')
    candidate = ROOT / ('index.html' if not path else path.lstrip('/') + '.html')
    if not candidate.exists():
        candidate = ROOT / path.lstrip('/') / 'index.html'
    if not candidate.exists():
        raise RuntimeError('Missing sitemap page: ' + str(loc.text))
    source = candidate.read_text()
    if 'styles-v2.css' not in source:
        continue  # Separate apps keep their own design system.
    pages.append((loc.text, candidate))
if (ROOT / '404.html').exists():
    pages.append(('https://dashhkuns.com/404.html', ROOT / '404.html'))
if len(pages) < 17:
    raise RuntimeError(f'Expected all 16 portfolio URLs plus 404, found {len(pages)}')

css_path = ROOT / 'styles-v2.css'
css = css_path.read_text()
css = re.sub(r'@import\s+url\([^;]*fonts\.googleapis\.com[\s\S]*?\);\s*', '', css)
css = re.sub(r'--sans\s*:[^;\n}]+', '--sans:"Alumni Sans",Arial,sans-serif', css)
css = re.sub(r'--serif\s*:[^;\n}]+', '--serif:"Literata",Georgia,serif', css)
# Alumni has a smaller lowercase height. Correct small text without changing layout.
# An explicit version marker makes this one-time migration idempotent.
if 'alumni-small-text-adjustment' not in css:
    def scale_small(match):
        n = float(match.group(2))
        if n > 23:
            return match.group(0)
        scaled = max(12, round(n * 1.22))
        return match.group(1) + str(scaled) + 'px'
    css = re.sub(r'(font-size\s*:\s*)(\d+(?:\.\d+)?)px', scale_small, css)
    css += '\n/* alumni-small-text-adjustment: 2026-10-14 */\n'
css_path.write_text(css)

results = []
for url, file in pages:
    old = file.read_text()
    new = old
    # Remove obsolete font CSS requests, not other links or metadata.
    new = re.sub(r'<link\b(?=[^>]*fonts\.googleapis\.com/css)[^>]*>\s*', '', new, flags=re.I)
    new = re.sub(r'<link\b(?=[^>]*portfolio-typography\.css)[^>]*>\s*', '', new, flags=re.I)
    new = re.sub(r'(styles-v2\.css)(?:\?[^"\s>]+)?', r'\1?v=' + VERSION, new)
    head = []
    if 'rel="preconnect" href="https://fonts.googleapis.com"' not in new:
        head.append('<link rel="preconnect" href="https://fonts.googleapis.com">')
    if 'rel="preconnect" href="https://fonts.gstatic.com"' not in new:
        head.append('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
    head.append('<link rel="stylesheet" href="' + FONT_URL.replace('&', '&amp;') + '">')
    head.append('<link rel="stylesheet" href="/assets/portfolio-typography.css?v=' + VERSION + '">')
    new = re.sub(r'</head>', ''.join(head) + '</head>', new, count=1, flags=re.I)
    if body_digest(old) != body_digest(new):
        raise RuntimeError('Visible copy or page body changed: ' + str(file))
    file.write_text(new)
    results.append({'url': url, 'file': str(file.relative_to(ROOT)), 'bodyUnchanged': True})

out = ROOT / 'typography-evidence'
out.mkdir(exist_ok=True)
(out / 'scope.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps({'pages': len(results), 'files': [r['file'] for r in results], 'bodiesUnchanged': True}, ensure_ascii=False))
