"""Read-only public site monitoring: HTTP, TLS and expected site identity."""
from __future__ import annotations
import sys
import time
import urllib.request
import urllib.error

TARGETS = {
    "EBI Marketing": ("https://ebi.dashhkuns.com/", "маркетинговое агентство"),
    "dashhkuns": ("https://dashhkuns.com/", "даш"),
}


def validate(status: int, html: str, marker: str) -> bool:
    return status == 200 and marker.casefold() in html.casefold() and "<html" in html.lower()


def probe(title: str, url: str, marker: str) -> bool:
    for attempt in (1, 2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "dashhkuns-os2-health/1.0"})
            with urllib.request.urlopen(req, timeout=14) as res:
                status = res.status
                html = res.read(160_000).decode("utf-8", "replace")
                final_url = res.url
            ok = validate(status, html, marker) and final_url.startswith("https://")
            if ok:
                print(f"PASS {title}: HTTP {status}, TLS, page identity")
                return True
            print(f"FAIL {title}: unexpected status/content/redirect (attempt {attempt})")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"FAIL {title}: {type(exc).__name__} (attempt {attempt})")
        if attempt == 1:
            time.sleep(2)
    return False


def main() -> int:
    failures = [name for name, (url, marker) in TARGETS.items()
                if not probe(name, url, marker)]
    if failures:
        print(f"Health failure count: {len(failures)}")
        return 1
    print("All public health probes passed. API, forms and email delivery are separate tests.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
