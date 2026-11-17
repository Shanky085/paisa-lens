# PaisaLens — Local development setup

This guide prepares a local development environment. It does not deploy the app.

## 1. Install the base tools

Recommended versions for this repository:

- **Git** — needed to clone and pull the repository.
- **Node.js 24 LTS or 26 LTS** — runs the Next.js frontend. Both are supported by the local setup script.
- **Python 3.12** — runs the FastAPI backend and matches the backend CI runtime.

Download from the official sites:

- Git: https://git-scm.com/downloads
- Node.js: https://nodejs.org/en/download
- Python: https://www.python.org/downloads/

Use the current patch release offered in each supported release line. On a managed/library computer, choose a per-user installation when available. Do not change machine-wide settings or install global packages unless the administrator permits it.

Open a **new terminal** after installing tools and verify:

~~~powershell
git --version
node --version
npm --version
py --version
~~~

Node should report v24.x or v26.x; Python should report 3.12.x (or another supported Python 3.11+ version). The repository defaults to Node 24 through `.nvmrc`; CI checks both Node 24 and 26, using Python 3.12 for the backend.

## 2. Get the repository

In PowerShell:

~~~powershell
git clone https://github.com/Shanky085/paisa-lens.git
cd paisa-lens
git pull --ff-only
~~~

If the repository is already on this computer, open its folder and run git pull --ff-only instead of cloning again.

For a Windows PC, once the base tools are installed, you can run the project setup script from the repository root:

~~~powershell
.\scripts\setup-windows.ps1
~~~

It creates the Python virtual environment, installs dependencies, checks SQLAlchemy imports and automatically retries with its supported pure-Python build if a managed Windows Application Control policy blocks the optional native extension, then runs backend tests, checks TypeScript and lint, and performs a production build. It does not install packages globally. If the library computer blocks PowerShell scripts, use the manual commands below and do not change machine-wide execution policy.

## 3. Install backend dependencies

Run these commands from the repository root:

~~~powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
~~~

This creates an isolated Python environment inside backend/.venv. It avoids modifying the computer's global Python packages and does not require PowerShell virtual-environment activation.

Start the API in this terminal:

~~~powershell
.\.venv\Scripts\python.exe -m app.seed_demo_data
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
~~~

The seed script inserts synthetic demo records only when the transaction table is empty. It does not overwrite existing rows.

Verify the backend by opening:

- http://localhost:8000/health
- http://localhost:8000/docs

Keep this terminal running.

## 4. Install frontend dependencies

Open a **second terminal** at the repository root:

~~~powershell
cd frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.local.example .env.local }
npm install
npm run typecheck
npm run lint
npm run dev
~~~

If .env.local already exists, do not overwrite it; check that NEXT_PUBLIC_API_URL is set to:

~~~text
http://localhost:8000/api/v1
~~~

Open http://localhost:3000. The overview is at /, the transaction ledger is at /transactions and the CSV importer is at /import. To test the importer without personal data, download the synthetic sample at http://localhost:3000/samples/sample-student-statement.csv.

## 5. Stop the app

Press Ctrl+C in each terminal. Your local SQLite database is stored under the backend folder and is ignored by Git.

## macOS / Linux command equivalents

Create the backend environment and install its dependencies:

~~~bash
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/python -m app.seed_demo_data
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
~~~

In another terminal:

~~~bash
cd frontend
cp .env.local.example .env.local
npm install
npm run typecheck
npm run lint
npm run dev
~~~

## Common issues

- **git, node, npm or py is not recognised:** install that tool for your account, open a new terminal and retry the version command.
- **Python launcher has no 3.12 entry:** install Python 3.12, or use python -m venv .venv if python --version reports Python 3.11 or later.
- **PowerShell blocks scripts:** the commands above invoke the venv's Python executable directly; they do not require running Activate.ps1.
- **Port 8000 or 3000 is already in use:** stop the other process or choose another port and update the API URL accordingly.
- **Frontend shows an API connection error:** keep the backend terminal running and confirm the API URL in frontend/.env.local.
- **Dependency installation fails on a managed PC:** the network or PC policy may block package downloads. Do not try to bypass the library's controls; use an authorised machine or an approved cloud development environment.

## Data safety

The current prototype is a shared single-workspace app with no authentication or per-user isolation. Use only synthetic/demo records while developing. Do not load real bank statements or personal financial data into a public deployment.
