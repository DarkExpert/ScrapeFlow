# ScrapeFlow

ScrapeFlow is a local-first web scraping dashboard. It collects records from configured HTML pages and JSON APIs, retains changes over time, and shows sources, runs, records, and statistics.

## Status

The FastAPI scraping engine and React operations dashboard are implemented. Scraping runs are started manually; the dashboard reads and writes the real local API.

## Planned stack

- Backend: Python 3.12+, FastAPI, HTTPX, BeautifulSoup, SQLAlchemy, SQLite
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Tests: offline automated backend and frontend tests

See [backend setup](docs/BACKEND.md), [dashboard setup](docs/FRONTEND.md), [architecture](docs/ARCHITECTURE.md), and [implementation plan](docs/IMPLEMENTATION_PLAN.md).

## License

MIT. See [LICENSE](LICENSE).

