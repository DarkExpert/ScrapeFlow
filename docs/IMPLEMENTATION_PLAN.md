# Implementation plan

## Phase 0 — repository foundation

Establish public `main` with a README, MIT license, ignore rules, architecture, and this plan. No application code is part of this phase.

## Phase 1 — `feat/scraping-engine`, PR #1

Implement the backend and offline tests:

1. Python 3.12+ project setup, FastAPI app, configuration, SQLite engine, SQLAlchemy models, and schema creation/migrations appropriate to the MVP.
2. Validated HTML and JSON source configurations and source CRUD API.
3. HTTPX fetcher with timeouts and bounded responses; BeautifulSoup HTML extraction and JSON path extraction.
4. Shared normalization, identity/deduplication, content hashing, version persistence, and transactional run accounting.
5. Manual run endpoint, persistent run logs, record/version reads, statistics API, and health endpoint.
6. Offline fixtures and automated tests for successful runs, repeated unchanged runs, changed content, malformed configuration, fetch errors, and API responses.
7. Backend setup and API usage documentation.

Open PR #1 against `main`; do not merge it automatically.

## Phase 2 — `feat/dashboard`, PR #2

Implement a Vite/React/TypeScript/Tailwind dashboard for sources, records and version history, runs and logs, and statistics. Include source creation/editing, manual execution, loading/error states, API integration, and offline frontend tests. Branch from the appropriate current base after PR #1 is reviewed; open PR #2 without automatic merge.

## Phase 3 — `chore/public-release`, PR #3

Polish public documentation and examples, add a reproducible local setup, verify offline tests, and review accessibility and repository hygiene. Open PR #3 without automatic merge.

## Explicit exclusions

Authentication, AI/RAG, distributed queues, scheduling, proxy rotation, CAPTCHA bypass, advanced browser scraping, and production cloud deployment are outside the MVP.
