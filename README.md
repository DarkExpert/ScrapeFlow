# ScrapeFlow

ScrapeFlow is a planned local-first web scraping dashboard. Its MVP will collect records from configured HTML pages and JSON APIs, retain changes over time, and show sources, runs, records, and basic statistics.

## Status

Phase 0 defines the architecture and implementation plan. The application has not been implemented.

## Planned stack

- Backend: Python 3.12+, FastAPI, HTTPX, BeautifulSoup, SQLAlchemy, SQLite
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Tests: offline automated backend and frontend tests

See [architecture](docs/ARCHITECTURE.md) and [implementation plan](docs/IMPLEMENTATION_PLAN.md).

## License

MIT. See [LICENSE](LICENSE).
