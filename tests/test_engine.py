import json
import socket
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from scrapeflow.api import create_app
from scrapeflow.pipeline import extract, fetch, public_url


@pytest.fixture(autouse=True)
def offline_dns(monkeypatch):
    real = socket.getaddrinfo

    def resolve(host, *args, **kwargs):
        if host == "example.com":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.215.14", 443))]
        return real(host, *args, **kwargs)

    monkeypatch.setattr(socket, "getaddrinfo", resolve)


HTML = b'<article><span class="id" data-id="1"></span><h2>First</h2><a href="/one">View</a></article>'
HTML_CONFIG = {"kind": "html", "item_selector": "article", "fields": {"external_id": {"selector": ".id", "attribute": "data-id"}, "title": {"selector": "h2", "attribute": "text"}, "url": {"selector": "a", "attribute": "href"}}}
JSON_CONFIG = {"kind": "json", "items_path": "data.items", "fields": {"external_id": "id", "title": "name", "url": "url"}}


def test_extractors():
    assert extract("html", HTML_CONFIG, HTML)[0]["title"] == "First"
    assert extract("json", JSON_CONFIG, b'{"data":{"items":[{"id":"1","name":"First","url":"/one"}]}}')[0]["title"] == "First"


def test_example_configs_match_extractors():
    root = Path(__file__).resolve().parents[1] / "examples"
    quotes = json.loads((root / "quotes.json").read_text(encoding="utf-8"))
    photos = json.loads((root / "photos.json").read_text(encoding="utf-8"))
    quote_html = b'<div class="quote"><span class="text">A quote</span><small class="author">A Writer</small><a href="/author/A-Writer">(about)</a></div>'
    assert extract("html", quotes["config"], quote_html)[0] == {"external_id": "A quote", "title": "A quote", "url": "/author/A-Writer", "author": "A Writer"}
    photo_json = b'[{"id":1,"title":"Photo","url":"https://picsum.photos/seed/1/600","thumbnailUrl":"https://picsum.photos/seed/1/150"}]'
    assert extract("json", photos["config"], photo_json)[0]["title"] == "Photo"


def test_url_restrictions():
    for url in ("http://127.0.0.1/x", "http://localhost/x", "file:///tmp/x", "http://10.0.0.1/x", "http://169.254.169.254/x", "http://user:pass@example.com/x", "http://example.com:8080/x"):
        with pytest.raises(ValueError):
            public_url(url)


def test_redirect_is_rejected():
    requested = []

    def handler(request):
        requested.append(str(request.url))
        return httpx.Response(302, headers={"Location": "http://127.0.0.1/private"})

    with pytest.raises(ValueError, match="Redirects are disabled"):
        fetch("https://example.com/feed", httpx.MockTransport(handler))
    assert requested == ["https://example.com/feed"]


def test_title_change_without_external_id_keeps_record(tmp_path):
    title = ["First"]

    def fetcher(url):
        return json.dumps({"data": {"items": [{"name": title[0], "url": "/one#fragment"}]}}).encode(), url

    config = {"kind": "json", "items_path": "data.items", "fields": {"title": "name", "url": "url"}}
    client = TestClient(create_app(f"sqlite:///{tmp_path / 'identity.db'}", fetcher))
    source = client.post("/api/v1/sources", json={"name": "Identity", "kind": "json", "url": "https://example.com/feed", "config": config}).json()
    endpoint = f"/api/v1/sources/{source['id']}/runs"
    assert client.post(endpoint).json()["created_count"] == 1
    title[0] = "Changed"
    assert client.post(endpoint).json()["updated_count"] == 1
    assert client.get("/api/v1/records").json()["total"] == 1
    record = client.get("/api/v1/records").json()["items"][0]
    assert record["url"] == "https://example.com/one"
    assert len(client.get(f"/api/v1/records/{record['id']}/versions").json()) == 2


def test_empty_extraction_fails_unless_configured(tmp_path):
    client = TestClient(create_app(f"sqlite:///{tmp_path / 'empty.db'}", lambda url: (b'{"data":{"items":[]}}', url)))
    source = client.post("/api/v1/sources", json={"name": "Empty", "kind": "json", "url": "https://example.com/feed", "config": JSON_CONFIG}).json()
    endpoint = f"/api/v1/sources/{source['id']}/runs"
    failed = client.post(endpoint).json()
    assert failed["status"] == "failed" and failed["fetched_count"] == 1 and failed["extracted_count"] == 0
    assert client.get(f"/api/v1/runs/{failed['id']}/logs").json()[0]["stage"] == "extract"
    assert client.patch(f"/api/v1/sources/{source['id']}", json={"config": {**JSON_CONFIG, "allow_empty": True}}).status_code == 200
    assert client.post(endpoint).json()["status"] == "succeeded"


def test_duplicate_identity_fails_atomically(tmp_path):
    def fetcher(url):
        return b'{"data":{"items":[{"id":"1","name":"A","url":"/one"},{"id":"1","name":"B","url":"/two"}]}}', url

    client = TestClient(create_app(f"sqlite:///{tmp_path / 'duplicate.db'}", fetcher))
    source = client.post("/api/v1/sources", json={"name": "Duplicate", "kind": "json", "url": "https://example.com/feed", "config": JSON_CONFIG}).json()
    run = client.post(f"/api/v1/sources/{source['id']}/runs").json()
    assert run["status"] == "failed" and run["extracted_count"] == 2
    assert client.get("/api/v1/records").json()["total"] == 0


def test_runs_versioning_and_api(tmp_path):
    state = {"title": "First", "fail": False}

    def fetcher(url):
        if state["fail"]:
            raise httpx.ConnectError("offline fixture failure")
        return json.dumps({"data": {"items": [{"id": "1", "name": state["title"], "url": "/one"}]}}).encode(), url

    client = TestClient(create_app(f"sqlite:///{tmp_path / 'test.db'}", fetcher))
    body = {"name": "Example", "kind": "json", "url": "https://example.com/feed", "config": JSON_CONFIG}
    response = client.post("/api/v1/sources", json=body)
    assert response.status_code == 201
    source_id = response.json()["id"]
    assert client.post("/api/v1/sources", json=body).status_code == 409
    assert client.post("/api/v1/sources", json={**body, "name": "Bad", "config": {"kind": "json"}}).status_code == 422
    assert client.patch(f"/api/v1/sources/{source_id}", json={"kind": "html"}).status_code == 422
    assert client.patch(f"/api/v1/sources/{source_id}", json={"name": "Updated"}).json()["name"] == "Updated"
    endpoint = f"/api/v1/sources/{source_id}/runs"
    assert client.post(endpoint).json()["created_count"] == 1
    assert client.post(endpoint).json()["unchanged_count"] == 1
    state["title"] = "Changed"
    assert client.post(endpoint).json()["updated_count"] == 1
    record = client.get("/api/v1/records").json()["items"][0]
    assert record["title"] == "Changed"
    assert len(client.get(f"/api/v1/records/{record['id']}/versions").json()) == 2
    state["fail"] = True
    failure = client.post(endpoint).json()
    assert failure["status"] == "failed" and failure["error_count"] == 1
    logs = client.get(f"/api/v1/runs/{failure['id']}/logs").json()
    assert logs[0]["stage"] == "fetch" and "ConnectError" in logs[0]["message"]
    assert client.get("/api/v1/stats").json()["versions"] == 2
    assert client.delete(f"/api/v1/sources/{source_id}").status_code == 409


def test_failed_normalization_is_atomic(tmp_path):
    def fetcher(url):
        return b'{"data":{"items":[{"id":"1","name":"Good","url":"/one"},{"id":"2","name":"","url":"/two"}]}}', url

    client = TestClient(create_app(f"sqlite:///{tmp_path / 'atomic.db'}", fetcher))
    source = client.post("/api/v1/sources", json={"name": "A", "kind": "json", "url": "https://example.com/feed", "config": JSON_CONFIG}).json()
    run = client.post(f"/api/v1/sources/{source['id']}/runs").json()
    assert run["status"] == "failed"
    assert client.get("/api/v1/records").json()["total"] == 0

