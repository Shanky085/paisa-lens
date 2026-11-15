# Architecture

## Shape

A modular monolith with two independently runnable applications:

- `frontend/`: Next.js UI and browser-side presentation state.
- `backend/`: FastAPI REST API, domain calculations and persistence.

The frontend calls the backend over JSON. The backend owns validation, persistence and deterministic financial calculations. The current implementation is a **single-workspace prototype**: there is no authentication or per-user data isolation yet.

## Backend modules

- `api/routes`: HTTP endpoints; keep business rules out of route handlers.
- `schemas`: request/response validation contracts.
- `models`: SQLAlchemy persistence models.
- `services`: future transaction, analytics, import, budget and goal domain logic.
- `core`: settings and cross-cutting configuration.
- `db`: engine, session and declarative base.

## API surface

| Method | Path | Purpose | Status |
|---|---|---|---|
| GET | `/health` | Service health | Implemented |
| GET | `/api/v1/transactions` | List/filter transactions | Implemented |
| POST | `/api/v1/transactions` | Create transaction | Implemented |
| PATCH | `/api/v1/transactions/{id}` | Edit transaction | Implemented |
| DELETE | `/api/v1/transactions/{id}` | Delete transaction | Implemented |
| GET | `/api/v1/dashboard/summary` | Period totals, budget, daily/category aggregates and recent records | Implemented |
| GET | `/api/v1/budgets/{year}/{month}` | Read monthly budget | Implemented |
| PUT | `/api/v1/budgets/{year}/{month}` | Create/update monthly budget | Implemented |
| POST | `/api/v1/transactions/import` | Validated CSV import | Planned |
| POST | `/api/v1/simulator/purchase` | Purchase impact | Planned |
| POST | `/api/v1/ai/insights` | Grounded AI insights | Planned |
| POST | `/api/v1/ai/chat` | Finance assistant | Planned |
| GET/POST | `/api/v1/goals` | Goal Mode | Planned |

## Data model

- `Transaction`: positive `Numeric(12,2)` amount, separate `income`/`expense` kind, category and transaction date.
- `MonthlyBudget`: one budget amount per calendar year/month, unique on `(year, month)`.

Currency input is validated through Pydantic Decimal fields and stored in SQLAlchemy Numeric columns. The API serializes monetary totals as decimal strings.

## Persistence

SQLite is the local development default. `Base.metadata.create_all` creates missing tables during application startup; it does not perform schema migrations. Before a multi-user release, move to PostgreSQL and introduce Alembic migrations. Configure persistent storage for SQLite if used in a container.

## Frontend data flow

- Dashboard requests `GET /dashboard/summary?year=YYYY&month=MM`.
- Transaction form posts to `POST /transactions`.
- Budget form writes to `PUT /budgets/{year}/{month}`.
- The frontend uses `NEXT_PUBLIC_API_URL` as the API base URL.
- API failures are surfaced in the UI; financial summary values are not fabricated as fallback data.

## Security baseline and known gaps

- Keep secrets server-side; never expose Gemini keys to the browser.
- Configure one explicit CORS origin for the deployed frontend.
- Authentication, user isolation, request rate limiting and account-level access control are not implemented.
- Do not import or store real user financial records in a public deployment.
- Validate file size, MIME type, encoding and row count before future CSV parsing.
- Do not log raw financial transaction content or credentials.
