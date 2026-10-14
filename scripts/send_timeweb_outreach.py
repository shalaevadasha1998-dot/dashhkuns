import json
import os
import smtplib
import ssl
import sys
import time
from email.message import EmailMessage
from pathlib import Path

SMTP_HOST = os.getenv("TIMEWEB_SMTP_HOST", "smtp.timeweb.ru")
SMTP_PORT = int(os.getenv("TIMEWEB_SMTP_PORT", "465"))
SMTP_USER = os.getenv("TIMEWEB_SMTP_USER", "create@dashhkuns.com")
SMTP_PASSWORD = os.getenv("TIMEWEB_SMTP_PASSWORD", "")
FROM_NAME = os.getenv("OUTREACH_FROM_NAME", "дарья шалаева | dashhkuns")

def load_batch(path: str):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("batch must be a JSON array")
    if len(data) > 25:
        raise ValueError("max 25 emails per batch")
    return data

def send_one(smtp, item):
    to = str(item.get("to", "")).strip()
    subject = str(item.get("subject", "")).strip()
    body = str(item.get("body", "")).strip()

    if not to or "@" not in to or not subject or not body:
        raise ValueError(f"invalid item: {item.get('company') or to or 'unknown'}")

    msg = EmailMessage()
    msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to
    msg["Reply-To"] = SMTP_USER
    msg["Subject"] = subject
    msg.set_content(body)

    smtp.send_message(msg)
    print(f"sent: {item.get('company', '')} <{to}>")

def main():
    if not SMTP_PASSWORD:
        raise RuntimeError("TIMEWEB_SMTP_PASSWORD secret is not configured")

    paths = sys.argv[1:]
    if not paths:
        raise RuntimeError("no batch files supplied")

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30) as smtp:
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        for path in paths:
            for item in load_batch(path):
                send_one(smtp, item)
                time.sleep(4)

if __name__ == "__main__":
    main()
