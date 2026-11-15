# PaisaLens

> Understand your spending. Predict your balance. Make smarter money decisions.

PaisaLens is an AI-powered personal finance intelligence platform designed for Indian students and young adults. It turns everyday transaction data into clear, practical financial decisions.

**Core questions**
1. What happened to my money?
2. Why did it happen?
3. What should I do next?

The project is a modular monolith: a Next.js web application backed by a Python FastAPI service. Financial calculations remain deterministic Python logic; AI explains calculated results rather than inventing financial facts.

## Product principles

- INR-first, designed around student cash flow: allowance, scholarships, stipends and part-time income.
- Privacy-first: no UPI PINs, OTPs, bank passwords, Aadhaar or PAN collection.
- User-initiated statement imports and manual transaction entry; no direct bank or UPI account connection in the MVP.
- No SMS reading, payment-app notification access or unofficial transaction endpoints.
- Distinguish unspent money, money actually saved, and money earmarked for a goal.
- No daily allowance rollover in Goal Mode. Unused allowance does not silently become savings or increase a later day's allowance.
- AI insights must be grounded in backend-calculated metrics and disclose uncertainty.

## UPI integration decision

Direct UPI synchronisation is deliberately **not part of PaisaLens**. No suitable official, publicly accessible, read-only UPI transaction-history API has been verified for an independent application. NPCI MyUPI is a consumer-facing activity service; it is not being treated as a developer API.

Users can still import supported statement files downloaded from their bank or payment apps. This is a manual, user-initiated import—not an automatic connection.

We will reconsider direct integration only if an official, documented public read-only API becomes available to independent applications on clear terms.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS v4, custom glassmorphism design system |
| Charts / icons | Recharts, Lucide React |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy |
| Local database | SQLite |
| Tests | Pytest, FastAPI TestClient, GitHub Actions |
| AI (planned) | Gemini API, server-side only |

## Current implementation

- Live dashboard reads monthly totals, daily spending, category breakdown and recent transactions from FastAPI.
- Transactions can be created, listed with filters, edited and deleted.
- A monthly spending budget can be created or updated manually.
- A deterministic synthetic-data script seeds the current month with student-style income and expenses.
- Backend tests and frontend type/lint/build checks are configured in GitHub Actions.

Not yet implemented: statement import, authentication, multi-user persistence, AI integration, forecasting and Goal Mode workflows.

## Repository layout

```text
paisa-lens/
├── frontend/              # Next.js application
├── backend/               # FastAPI service
├── docs/                  # Product, architecture and financial rules
├── .github/workflows/     # Automated checks
├── .env.example
└── README.md
```

## Run locally

### Prerequisites
- Node.js 20.9+ and npm (or pnpm)
- Python 3.11+

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
python -m app.seed_demo_data
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

The seed script only inserts synthetic data when the transactions table is empty. It does not overwrite existing transactions.

### Frontend
In a second terminal:
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
Open http://localhost:3000.

The `NEXT_PUBLIC_API_URL` variable should point to the FastAPI `/api/v1` base URL. For local development, the example uses `http://localhost:8000/api/v1`.

## Deployment preparation

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the Vercel frontend and containerized backend deployment setup. The backend can optionally seed synthetic transactions on first startup with `SEED_DEMO_DATA=true`; keep this enabled only for a disposable public demo. The current app has no authentication or per-user data isolation, so never connect real financial accounts or import real personal statements into a public deployment.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v1/transactions` | List/filter transactions |
| POST | `/api/v1/transactions` | Create a transaction |
| PATCH | `/api/v1/transactions/{id}` | Edit a transaction |
| DELETE | `/api/v1/transactions/{id}` | Delete a transaction |
| GET | `/api/v1/dashboard/summary?year=YYYY&month=MM` | Monthly metrics |
| GET | `/api/v1/budgets/{year}/{month}` | Read monthly budget |
| PUT | `/api/v1/budgets/{year}/{month}` | Create/update monthly budget |

## MVP roadmap

- [x] Establish project structure and product rules
- [x] Create responsive premium dashboard shell
- [x] Add FastAPI health, transaction CRUD and monthly summary
- [x] Add monthly budgets and deterministic demo data
- [x] Connect dashboard to live API data
- [x] Add transaction creation and manual budget entry
- [x] Configure automated backend/frontend checks
- [ ] Statement import, column mapping and duplicate detection
- [ ] Transaction editing UI and category correction workflow
- [ ] Deterministic forecasts and purchase simulator
- [ ] Goal Mode with no-rollover spending limits
- [ ] Grounded AI Financial Coach
- [ ] Deployment and demo walkthrough

## Financial integrity and privacy

Income and expense calculations are performed by the backend. Own-account transfers should not be counted as income or expenses when identified. Unspent allowance is not automatically saved, and goal allocations are virtual earmarks—not bank transfers. Never commit real credentials or expose Gemini keys to the browser.

The current starter is a single-workspace prototype without authentication. Do not use it to store real financial records until authentication, access controls, backup and deployment security are added.

PaisaLens is an educational budgeting and decision-support tool, not a bank, investment adviser, tax adviser or credit provider.

## License
MIT. See [LICENSE](LICENSE).
