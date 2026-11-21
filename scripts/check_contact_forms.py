#!/usr/bin/env python3
"""Fail CI if a contact or booking form may fall back to a GET request."""
from html.parser import HTMLParser
from pathlib import Path
import sys

EXPECTED = {
    "contact.html": {"project-form", "booking-form"},
    "en/contact.html": {"project-form", "booking-form"},
}


class FormParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.forms = []

    def handle_starttag(self, tag, attrs):
        if tag == "form":
            self.forms.append(dict(attrs))


def check_forms(root: Path) -> list[str]:
    problems = []
    for relative, expected_ids in EXPECTED.items():
        path = root / relative
        if not path.is_file():
            problems.append(f"{relative}: file missing")
            continue
        parser = FormParser()
        parser.feed(path.read_text(encoding="utf-8"))
        actual_ids = [form.get("id", "") for form in parser.forms]
        if set(actual_ids) != expected_ids or len(actual_ids) != len(expected_ids):
            problems.append(f"{relative}: expected exactly {sorted(expected_ids)}, got {actual_ids}")
        for form in parser.forms:
            form_id = form.get("id")
            if form_id in expected_ids and form.get("method", "").lower() != "post":
                problems.append(f"{relative}#{form_id}: method must be POST (GET can leak contact data in URLs)")
    return problems


if __name__ == "__main__":
    failures = check_forms(Path(__file__).resolve().parents[1])
    if failures:
        print("Contact form regression failed:", *failures, sep="\n- ", file=sys.stderr)
        raise SystemExit(1)
    print("PASS: both languages, four forms, POST fallback explicitly set")
