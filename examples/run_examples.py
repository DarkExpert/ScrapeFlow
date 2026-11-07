"""Register and execute the two bundled examples against a running local API."""
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


API = os.getenv("SCRAPEFLOW_API_BASE_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")


def post(path, payload=None):
    body = json.dumps(payload).encode() if payload is not None else b""
    request = Request(API + path, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=60) as response:
        return json.load(response)


for filename in ("quotes.json", "photos.json"):
    source = json.loads((Path(__file__).parent / filename).read_text(encoding="utf-8"))
    try:
        created = post("/sources", source)
    except HTTPError as exc:
        if exc.code == 409:
            raise SystemExit(f"{source['name']} already exists; remove it before rerunning this one-time script") from exc
        raise
    run = post(f"/sources/{created['id']}/runs")
    print(f"{source['name']}: run {run['id']} {run['status']} ({run['extracted_count']} extracted)")
