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
- CSV-led imports; no direct bank or UPI account connection in the MVP.
- Distinguish unspent money, money actually saved, and money earmarked for a goal.
- No daily allowance rollover in Goal Mode. Unused allowance does not silently become savings or increase a later day's allowance.
- AI insights must be grounded in backend-calculated metrics and disclose uncertainty.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS v4, custom glassmorphism design system |
| Charts / icons | Recharts, Lucide React |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy |
| Local database | SQLite |
| Tests | Pytest, FastAPI TestClient |
| AI (planned) | Gemini API, server-side only |

## Current status

The initial starter contains a responsive dashboard with synthetic demo data and a FastAPI service with health, transaction CRUD and monthly summary endpoints. CSV import, authentication, multi-user persistence, Gemini integration and Goal Mode workflows are planned—not yet implemented.

## Repository layout

```text
paisa-lens/
├── frontend/              # Next.js application
├── backend/               # FastAPI service
├── docs/                  # Product, architecture and financial rules
├── .env.example
├── .gitignore
└── README.md
```

## Run locally

### Prerequisites
- Node.js 20.9+ and pnpm (or npm)
- Python 3.11+

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### Frontend
In a second terminal:
```bash
cd frontend
cp .env.local.example .env.local
pnpm install
pnpm dev
```
Open http://localhost:3000.

The dashboard currently uses synthetic demo data. Live API integration is the next implementation task.

## MVP roadmap
- [x] Establish project structure and product rules
- [x] Create responsive premium dashboard shell with synthetic data
- [x] Add FastAPI health, transaction CRUD and monthly summary
- [ ] Connect dashboard to live API data
- [ ] Validated CSV import, column mapping and duplicate detection
- [ ] Budget management and transaction categorisation corrections
- [ ] Deterministic analytics, forecasts and purchase simulator
- [ ] Goal Mode with no-rollover spending limits
- [ ] Grounded AI Financial Coach with safe fallback
- [ ] Automated tests, deployment and demo walkthrough

## Financial integrity and privacy

Income and expense calculations are performed by the backend. Own-account transfers should not count as income or expenses when identified. Unspent allowance is not automatically saved, and goal allocations are virtual earmarks—not bank transfers. Never commit real credentials or expose Gemini keys to the browser.

PaisaLens is an educational budgeting and decision-support tool, not a bank, investment adviser, tax adviser or credit provider.

## License
MIT. See [LICENSE](LICENSE).
