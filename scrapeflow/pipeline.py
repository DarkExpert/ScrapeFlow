"""Validated source configuration, safe fetching, extraction and persistence."""
import hashlib
import ipaddress
import json
import socket
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select

from .db import Record, RecordVersion, RunLog, ScrapeRun, utcnow

MAX_BYTES = 2_000_000


def public_url(value: str) -> str:
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("URL must be a public HTTP(S) URL without embedded credentials")
        if parsed.port not in (None, 80, 443):
            raise ValueError("Only ports 80 and 443 are allowed")
        host = parsed.hostname.rstrip(".").lower()
        if host == "localhost" or host.endswith(".localhost") or host.endswith(".local"):
            raise ValueError("Internal host is blocked")
        try:
            addresses = [ipaddress.ip_address(host)]
        except ValueError:
            addresses = [ipaddress.ip_address(item[4][0]) for item in socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)]
        if not addresses or any(not addr.is_global for addr in addresses):
            raise ValueError("Internal network destination is blocked")
    except (OSError, UnicodeError, ValueError) as exc:
        raise ValueError(f"Unsafe URL: {exc}") from exc
    return value


class HtmlField(BaseModel):
    model_config = ConfigDict(extra="forbid")
    selector: str
    attribute: str = "text"

    @field_validator("selector")
    @classmethod
    def selector_valid(cls, value):
        try:
            BeautifulSoup("<div></div>", "html.parser").select(value)
        except Exception as exc:
            raise ValueError("Invalid CSS selector") from exc
        return value


class HtmlConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: str = "html"
    item_selector: str
    fields: dict[str, HtmlField]

    @model_validator(mode="after")
    def valid(self):
        if self.kind != "html" or not {"title", "url"} <= self.fields.keys():
            raise ValueError("HTML config requires kind=html, title and url fields")
        HtmlField(selector=self.item_selector)
        return self


class JsonConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: str = "json"
    items_path: str
    fields: dict[str, str]

    @model_validator(mode="after")
    def valid(self):
        if self.kind != "json" or not {"title", "url"} <= self.fields.keys() or any(not p for p in self.fields.values()):
            raise ValueError("JSON config requires kind=json, title and url paths")
        return self


class SourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    kind: str
    url: str
    config: dict
    enabled: bool = True

    @model_validator(mode="after")
    def valid(self):
        if self.kind == "html":
            HtmlConfig.model_validate(self.config)
        elif self.kind == "json":
            JsonConfig.model_validate(self.config)
        else:
            raise ValueError("kind must be html or json")
        if self.config.get("kind") != self.kind:
            raise ValueError("config.kind must match kind")
        public_url(self.url)
        return self


def fetch(url: str, transport=None):
    public_url(url)
    with httpx.Client(timeout=10, follow_redirects=False, transport=transport, trust_env=False) as client:
        with client.stream("GET", url, headers={"User-Agent": "ScrapeFlow/0.1 (+public-data-fetcher)"}) as response:
            response.raise_for_status()
            if response.is_redirect:
                raise ValueError("Redirects are disabled")
            chunks = []
            size = 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > MAX_BYTES:
                    raise ValueError("Response exceeds 2 MB limit")
                chunks.append(chunk)
            return b"".join(chunks), str(response.url)


def path_get(value, path):
    for key in path.split("."):
        if not isinstance(value, dict) or key not in value:
            return None
        value = value[key]
    return value


def extract(kind: str, config: dict, content: bytes):
    if kind == "json":
        data = json.loads(content)
        items = path_get(data, config["items_path"])
        if not isinstance(items, list):
            raise ValueError("items_path must resolve to an array")
        return [{name: path_get(item, path) for name, path in config["fields"].items()} for item in items]
    soup = BeautifulSoup(content, "html.parser")
    result = []
    for item in soup.select(config["item_selector"]):
        fields = {}
        for name, spec in config["fields"].items():
            node = item.select_one(spec["selector"])
            fields[name] = (node.get_text(" ", strip=True) if spec["attribute"] == "text" else node.get(spec["attribute"])) if node else None
        result.append(fields)
    return result


def normalize(item: dict, base_url: str):
    title = str(item.get("title") or "").strip()
    raw_url = str(item.get("url") or "").strip()
    if not title or not raw_url:
        raise ValueError("Record requires title and url")
    url = urljoin(base_url, raw_url)
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Record URL must be HTTP(S)")
    external_id = str(item["external_id"]).strip() if item.get("external_id") is not None else None
    payload = {key: value for key, value in item.items() if key not in ("external_id", "title", "url")}
    identity = external_id or hashlib.sha256(json.dumps([url, title]).encode()).hexdigest()
    canonical = {"external_id": external_id, "title": title, "url": url, "payload": payload}
    digest = hashlib.sha256(json.dumps(canonical, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()
    return identity, canonical, digest


def execute(session, source, fetcher=fetch):
    run = ScrapeRun(source_id=source.id)
    session.add(run)
    session.commit()
    stage = "fetch"
    try:
        content, final_url = fetcher(source.url)
        run.fetched_count = 1
        stage = "extract"
        items = extract(source.kind, source.config_json, content)
        run.extracted_count = len(items)
        stage = "normalize"
        normalized = [normalize(item, final_url) for item in items]
        stage = "persist"
        for identity, data, digest in normalized:
            record = session.scalar(select(Record).where(Record.source_id == source.id, Record.identity_key == identity))
            if record is None:
                record = Record(source_id=source.id, identity_key=identity, external_id=data["external_id"], title=data["title"], url=data["url"])
                session.add(record)
                session.flush()
                run.created_count += 1
            else:
                previous = session.get(RecordVersion, record.current_version_id)
                record.last_seen_at = utcnow()
                if previous and previous.content_hash == digest:
                    run.unchanged_count += 1
                    continue
                record.title, record.url = data["title"], data["url"]
                run.updated_count += 1
            version = RecordVersion(record_id=record.id, content_hash=digest, payload_json=data, run_id=run.id)
            session.add(version)
            session.flush()
            record.current_version_id = version.id
        run.status = "succeeded"
        session.add(RunLog(run_id=run.id, stage="complete", level="info", message="Run completed"))
        session.commit()
    except Exception as exc:
        session.rollback()
        run = session.get(ScrapeRun, run.id)
        run.status = "failed"
        run.error_count = 1
        run.finished_at = utcnow()
        session.add(RunLog(run_id=run.id, stage=stage, level="error", message=f"{type(exc).__name__}: {exc}"))
        session.commit()
        return run
    run.finished_at = utcnow()
    session.commit()
    return run

