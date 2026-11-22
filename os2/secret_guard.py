"""Read-only Git diff scanner for newly introduced credential literals.

Never prints credential values; uses no network and does not revoke keys.
More thorough scans (Betterleaks) can be added after an audited runtime setup.
"""
from __future__ import annotations
import argparse
import re
import subprocess
import sys

ASSIGNMENT = re.compile(
    r"""(?ix)(?:["']?[\w.-]*(?:secret|password|token|api[_-]?key|private[_-]?key|notify[_-]?key|service[_-]?role|key)[\w.-]*["']?)\s*[:=]\s*["']([A-Za-z0-9_./+=-]{24,})["']"""
)
KNOWN = re.compile(r"(?i)(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{35,}|xox[baprs]-[A-Za-z0-9-]{18,}|sk-[A-Za-z0-9_-]{24,}|sb_secret_[A-Za-z0-9_-]{20,})")
PRIVATE_KEY = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
TEST_PATHS = ("os2/tests/",)
ALLOWED_SUFFIXES = (".py", ".js", ".mjs", ".ts", ".tsx", ".json", ".yml", ".yaml", ".env", ".md", ".html", ".sh", ".toml", ".css")


def scan_patch(patch: str) -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    path = ""
    for line in patch.splitlines():
        if line.startswith("+++ b/"):
            path = line[6:].strip()
            continue
        if not line.startswith("+") or line.startswith("+++"):
            continue
        if not path or path.startswith(TEST_PATHS) or path == "os2/secret_guard.py":
            continue
        if not path.endswith(ALLOWED_SUFFIXES) and "/.env" not in path:
            continue
        text = line[1:]
        reason = ("private key block" if PRIVATE_KEY.search(text) else
                  "known token format" if KNOWN.search(text) else
                  "credential literal" if ASSIGNMENT.search(text) else None)
        if reason:
            findings.append((path, reason))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Trusted SHA of PR base commit")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-f0-9]{40}", args.base):
        print("Invalid PR base revision", file=sys.stderr)
        return 2
    p = subprocess.run(
        ["git", "diff", "--unified=0", "--no-ext-diff", f"{args.base}...HEAD"],
        text=True, capture_output=True, check=False
    )
    if p.returncode:
        print("Cannot obtain Git diff; scan not passed", file=sys.stderr)
        return 2
    findings = scan_patch(p.stdout)
    if findings:
        print(f"Blocked: {len(findings)} possible secret(s) in changed lines.")
        for path, reason in findings[:50]:
            print(f"  {path}: {reason}; value REDACTED")
        return 1
    print("PASS: no obvious new secret literals in changed lines (heuristic check).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
