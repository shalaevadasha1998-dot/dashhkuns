from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ROUTES = [
    "/", "/experience", "/marketing-strategy", "/marketing-audit",
    "/marketing-outsourcing", "/context-advertising", "/seo-promotion",
    "/smm-content", "/business-websites", "/guides",
    "/marketing-strategy-brief", "/marketing-audit-checklist", "/privacy",
]
DOMAIN = "https://ebi.dashhkuns.com"

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.h1 = 0
        self.assets = []
        self.links = []
        self.ids = []
        self.canonical = []
        self.images_missing_alt = 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "h1": self.h1 += 1
        if a.get("id"): self.ids.append(a["id"])
        if tag == "img":
            if "alt" not in a: self.images_missing_alt += 1
            if a.get("src"): self.assets.append(a["src"])
        if tag == "script" and a.get("src"): self.assets.append(a["src"])
        if tag == "link":
            if a.get("rel") == "canonical": self.canonical.append(a.get("href"))
            if a.get("rel") in ("stylesheet", "icon", "apple-touch-icon") and a.get("href"): self.assets.append(a["href"])
        if tag == "a" and a.get("href"): self.links.append(a["href"])

def expected_file(route):
    return ROOT / ("index.html" if route == "/" else route.lstrip("/") + ".html")

def verify():
    problems = []
    for route in ROUTES:
        path = expected_file(route)
        if not path.is_file():
            problems.append(f"{route}: missing page")
            continue
        page = Page()
        page.feed(path.read_text(encoding="utf-8"))
        if page.h1 != 1: problems.append(f"{route}: H1 count {page.h1}")
        if page.canonical != [DOMAIN + route]: problems.append(f"{route}: canonical mismatch {page.canonical}")
        if page.images_missing_alt: problems.append(f"{route}: images without alt {page.images_missing_alt}")
        if len(page.ids) != len(set(page.ids)): problems.append(f"{route}: duplicate ids")
        for url in page.assets:
            u = urlparse(url)
            if u.scheme or u.netloc: continue
            local = u.path.lstrip("/")
            if not (ROOT / local).is_file(): problems.append(f"{route}: missing asset {local}")
        for url in page.links:
            u = urlparse(url)
            if u.scheme or u.netloc: continue
            if not u.path or u.path in ("/", ".", "./"): continue
            target = expected_file(u.path)
            if not target.is_file() and not (ROOT / u.path.lstrip("/")).is_file():
                problems.append(f"{route}: missing linked page {u.path}")
    for name in ["robots.txt", "sitemap.xml"]:
        if not (ROOT / name).is_file(): problems.append("missing " + name)
    style = ROOT / "assets/styles.css"
    if style.is_file():
        css = style.read_text(encoding="utf-8")
        if "padding-block: 5px" not in css: problems.append("missing mobile tap-target fix")
        for name in re.findall(r"url\(\s*['\"]?([^)'\"]+)", css):
            if name.startswith(("data:", "https:", "http:")): continue
            p = (style.parent / name.split("?")[0]).resolve()
            if not p.is_file(): problems.append("missing CSS resource " + name)
    return problems

if __name__ == "__main__":
    failures = verify()
    if failures:
        print("\n".join("ERROR " + x for x in failures), file=sys.stderr)
        raise SystemExit(1)
    print(f"PASS: {len(ROUTES)} routes, assets, links, canonicals, CSS")
