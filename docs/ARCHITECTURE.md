# Architecture

## Shape
A modular monolith with two independently runnable applications:
- `frontend/`: Next.js UI and browser-side presentation state.
- `backend/`: FastAPI REST API, domain calculations, persistence and server-side AI integration (planned).

The frontend calls the backend over HTTPS using JSON. The backend owns validation, persistence and deterministic financial calculations.

## Backend modules
- `api/routes`: HTTP endpoints only; keep business rules out of route handlers.
- `schemas`: request/response validation contracts.
- `models`: SQLAlchemy persistence models.
- `services`: transaction, analytics, import, budget and goal domain logic.
- `core`: settings and cross-cutting configuration.
- `db`: engine, session and declarative base.

## Initial API surface
| Method | Path | Purpose | Status |
|---|---|---|---|
| GET | `/health` | Service health | Implemented |
| GET | `/api/v1/transactions` | List transactions | Implemented in starter |
| POST | `/api/v1/transactions` | Create transaction | Implemented in starter |
| DELETE | `/api/v1/transactions/{id}` | Delete transaction | Implemented in starter |
| GET | `/api/v1/dashboard/summary` | Current-month totals | Implemented in starter |
| POST | `/api/v1/transactions/import` | Validated CSV import | Planned |
| GET/POST | `/api/v1/budgets` | Budget management | Planned |
| POST | `/api/v1/simulator/purchase` | Purchase impact | Planned |
| POST | `/api/v1/ai/insights` | Grounded AI insights | Planned |
| POST | `/api/v1/ai/chat` | Finance assistant | Planned |
| GET/POST | `/api/v1/goals` | Goal Mode | Planned |

## Persistence
SQLite is the local development default. Before multi-user deployment, move to PostgreSQL and introduce migrations (Alembic). Do not treat local SQLite as a production multi-user database.

## Security baseline
- Keep secrets server-side; never expose Gemini keys to the browser.
- Configure allowed CORS origins explicitly in deployment.
- Add authentication and per-user data isolation before storing real users' financial data.
- Validate file size, MIME type, encoding and row count before parsing uploads.
- Do not log raw financial transaction content or credentials.
