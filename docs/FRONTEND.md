# Operations dashboard

The Phase 2 dashboard lives in `frontend/`. It uses React, TypeScript, Vite, Tailwind CSS and Lucide icons. All metrics and tables come from the FastAPI `/api/v1` endpoints; no demonstration data is bundled into production UI state.

## Run locally

In one terminal at the repository root, install the backend with `python -m pip install -e ".[test]"` and start it with `python -m uvicorn scrapeflow.api:app --host 127.0.0.1 --port 8000`. In another terminal, run `cd frontend`, `npm ci`, then `npm run dev`. Open `http://127.0.0.1:5173/`. Vite proxies `/api` to FastAPI on port 8000; no CORS configuration is needed for local development. The backend stores data in `scrapeflow.db` unless `SCRAPEFLOW_DATABASE_URL` is set.

The Sources page can register the bundled Quotes to Scrape and JSONPlaceholder Photos configurations. Creating a source does not run it. Use **Run** to collect records. Invalid configurations and run failures show errors; execution logs are available under **Executions**. The Records page searches only the current loaded page, while source filtering and page navigation use the backend API.

## Verify

Run `npm run typecheck`, `npm run build`, and `npm test` in `frontend/`. The backend suite remains `python -m pytest -q` at the repository root. The frontend API client has focused offline tests; browser smoke testing requires both local servers and live network access for the example sources.

## Scope

Runs are synchronous, so the Run button remains pending until FastAPI returns. The dashboard has no authentication, scheduling, background workers or frontend persistence. The source and run lists load all backend pages for workspace-wide status; very large histories would need a future pagination design.

