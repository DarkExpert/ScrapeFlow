# Backend setup and API use

Requires Python 3.12+. Install with `python -m pip install -e '.[test]'`, run tests with `python -m pytest`, and start the API with `uvicorn scrapeflow.api:app --reload`. The default SQLite file is `scrapeflow.db`; set `SCRAPEFLOW_DATABASE_URL` to change it. Tables are created on startup. Schema changes require a manual migration in this MVP.

Create a JSON source with `POST /api/v1/sources` and body `{"name":"Example","kind":"json","url":"https://example.com/feed","config":{"kind":"json","items_path":"data.items","fields":{"external_id":"id","title":"name","url":"url"}}}`. Trigger a synchronous run with `POST /api/v1/sources/{id}/runs`. Read `/api/v1/runs/{id}/logs`, `/api/v1/records`, and `/api/v1/stats` for results. HTML sources use `item_selector` and per-field `selector`/`attribute` objects as described in [ARCHITECTURE.md](ARCHITECTURE.md).

Only public HTTP(S) sources on ports 80 and 443 are accepted. The fetcher rejects internal IP destinations, does not follow redirects, uses a 10-second timeout and a 2 MB response limit. Use this tool only on resources you are permitted to access; respect site terms and rate limits. DNS resolution happens at validation and fetch time; deployments on untrusted networks should additionally enforce outbound network policy to prevent DNS rebinding. Authentication, scheduling, migrations, and a frontend are outside this phase. Sources with run or record history cannot be deleted, preserving their audit trail.

