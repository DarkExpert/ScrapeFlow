# Local setup

ScrapeFlow runs as two local processes: FastAPI on `127.0.0.1:8000` and Vite on `127.0.0.1:5173`. Use Python 3.12+, Node.js (current LTS), and npm. Run backend commands from the repository root so the default SQLite file is `scrapeflow.db` there. Vite proxies `/api` to port 8000; no CORS setup is needed.

## Windows PowerShell

```powershell
python --version # confirm Python 3.12 or newer
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[test]"
.\.venv\Scripts\python -m uvicorn scrapeflow.api:app --host 127.0.0.1 --port 8000
```

In a second PowerShell window at the repository root:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`. If PowerShell blocks activation scripts, use the `.venv\Scripts\python` executable as shown; activation is not required.

## Linux and macOS

```sh
python3.12 -m venv .venv
./.venv/bin/python -m pip install -e '.[test]'
./.venv/bin/python -m uvicorn scrapeflow.api:app --host 127.0.0.1 --port 8000
```

In a second terminal at the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`; check the API at `http://127.0.0.1:8000/api/v1/health`.

## Data and examples

The default database URL is `sqlite:///scrapeflow.db`, relative to the backend process's working directory. Tables are created at startup. To use another SQLite file, set `SCRAPEFLOW_DATABASE_URL` before starting FastAPI:

```powershell
$env:SCRAPEFLOW_DATABASE_URL = 'sqlite:///E:/path/to/scrapeflow.db'
```

```sh
export SCRAPEFLOW_DATABASE_URL='sqlite:////absolute/path/to/scrapeflow.db'
```

Database files and `.env` files are ignored by Git. No schema migration tool is included in this MVP.

With FastAPI running on port 8000, register and run both public examples once:

```powershell
.\.venv\Scripts\python examples/run_examples.py
```

On Linux/macOS, use `./.venv/bin/python examples/run_examples.py`. The script defaults to `http://127.0.0.1:8000/api/v1`; set `SCRAPEFLOW_API_BASE_URL` to use another local API port. It registers each source, so rerunning it against the same database exits on a duplicate name. Repeat collections from the dashboard's **Sources** page. The public requests require internet access and should be run only where scraping is permitted.

## Checks

At the repository root, run `.venv\Scripts\python -m pytest -q` on Windows or `./.venv/bin/python -m pytest -q` on Linux/macOS. In `frontend/`, run `npm run typecheck`, `npm test`, and `npm run build`. Automated tests use offline fixtures and do not contact public example sites.
