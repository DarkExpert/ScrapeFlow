# MVP architecture and API contracts

## Boundaries

ScrapeFlow is a modular monolith: one FastAPI process owns the HTTP API, scraping pipeline, and SQLite persistence. A React single-page app calls the API. No background worker is required for the MVP; manual runs execute through an API request, with a run record and logs persisted even when a stage fails.

Backend modules will separate API schemas/routes, source configuration, fetching, extraction, normalization, deduplication, persistence, and reporting. Pipeline stages exchange typed values so HTML and JSON sources share the same downstream path.

## Data flow

1. A user creates an enabled source with `kind` (`html` or `json`), URL, and an extraction configuration.
2. Manual execution creates a `run` with `running` status, fetches the source with HTTPX and bounded timeouts, then extracts candidate items. HTML selectors use BeautifulSoup; JSON extraction traverses configured object paths.
3. Normalization maps configured fields to a canonical record (`external_id`, `title`, `url`, `payload`) and validates required values.
4. Deduplication uses `(source_id, external_id)` when configured, otherwise a stable hash of normalized identity fields. The system stores a new version only when the canonical content hash changes.
5. The run stores counts, status, timestamps, and stage-level log entries. Reporting reads persisted data; it does not scrape.

Source configurations are data, never executable Python or JavaScript. URL schemes are limited to HTTP(S); fetch safety limits and redirect policy will be defined with the implementation. The MVP targets publicly accessible resources and does not bypass access controls.

## Planned SQLite entities

| Entity | Core fields | Constraint |
| --- | --- | --- |
| `sources` | id, name, kind, url, config_json, enabled, created_at, updated_at | Unique source name |
| `records` | id, source_id, identity_key, external_id, title, url, current_version_id, first_seen_at, last_seen_at | Unique `(source_id, identity_key)` |
| `record_versions` | id, record_id, content_hash, payload_json, captured_at, run_id | Append only when content changes |
| `runs` | id, source_id, status, started_at, finished_at, fetched_count, extracted_count, created_count, updated_count, unchanged_count, error_count | Status: running, succeeded, failed |
| `run_logs` | id, run_id, timestamp, stage, level, message | Ordered by id |

SQLAlchemy manages transactions and relationships. SQLite foreign keys must be enabled. Each record/version update is transactional; failures are reflected in the run rather than hiding partial progress.

## Source configuration contract

`config` is a discriminated JSON object validated per `kind`:

```json
{
  "kind": "html",
  "item_selector": "article.product",
  "fields": {
    "external_id": {"selector": "[data-id]", "attribute": "data-id"},
    "title": {"selector": "h2", "attribute": "text"},
    "url": {"selector": "a", "attribute": "href"}
  }
}
```

```json
{
  "kind": "json",
  "items_path": "data.items",
  "fields": {
    "external_id": "id",
    "title": "name",
    "url": "url"
  }
}
```

Dot paths address object keys; arrays are traversed only by `items_path`. HTML relative URLs become absolute against the final response URL. An absent `external_id` uses a hash derived from normalized URL and title. Extra extracted fields go in `payload`.

## HTTP API contract (planned)

Base path: `/api/v1`. JSON uses UTF-8 and ISO 8601 UTC timestamps. IDs are integers. List endpoints support `limit` (default 50, max 100) and `offset` (default 0), returning `{ "items": [...], "total": 0, "limit": 50, "offset": 0 }`. Invalid input returns 422; unknown IDs return 404; fetch or extraction failures are represented on the run and do not erase it.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health |
| GET, POST | `/sources` | List and create sources |
| GET, PATCH, DELETE | `/sources/{source_id}` | Inspect, update, delete source configuration |
| POST | `/sources/{source_id}/runs` | Start a manual run; return run summary when complete |
| GET | `/runs` | List runs, optionally filtered by `source_id` and `status` |
| GET | `/runs/{run_id}` | Run summary and counts |
| GET | `/runs/{run_id}/logs` | Ordered run logs |
| GET | `/records` | List latest records, optionally filtered by `source_id` |
| GET | `/records/{record_id}` | Latest record and metadata |
| GET | `/records/{record_id}/versions` | Version history, newest first |
| GET | `/stats` | Source, record, version, and run totals; recent run outcomes |

Source POST body: `{ "name": "Example", "kind": "html", "url": "https://example.org/items", "config": { ... }, "enabled": true }`. PATCH accepts a subset of these fields and revalidates the combined configuration. DELETE returns 204; the implementation plan will define whether dependent historical records are retained or removed before exposing deletion in the UI.

## Constraints and testing

Runs are synchronous for the MVP; the client should show progress as pending until the response returns, then read the persisted run. Offline tests use HTTPX mock transports or fixtures, temporary SQLite databases, and static HTML/JSON samples. Tests cover both extractors, normalization, deduplication, version changes, run failures, and API contracts without network access.
