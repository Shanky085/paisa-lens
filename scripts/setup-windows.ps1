$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "PaisaLens local setup" -ForegroundColor Magenta
Write-Host "Project folder: $root"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git was not found. Install Git for Windows, open a new terminal and retry."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm was not found. Install Node.js 24 LTS, open a new terminal and retry."
}
if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "The Python launcher (py) was not found. Install Python 3.12 for your user account and retry."
}

$nodeVersion = node --version
if ($nodeVersion -notmatch '^v(24|26)\.') {
    throw "PaisaLens supports Node.js 24 LTS or 26 LTS. Detected $nodeVersion. Install either supported LTS release and reopen the terminal."
}

Invoke-Checked "Verify Python 3.12" { py -3.12 --version }

$pythonEnv = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonEnv)) {
    Invoke-Checked "Create isolated Python environment" {
        Push-Location $backend
        try { py -3.12 -m venv .venv } finally { Pop-Location }
    }
}

Invoke-Checked "Install backend dependencies" {
    & $pythonEnv -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed with exit code $LASTEXITCODE." }
    Push-Location $backend
    try { & $pythonEnv -m pip install -e ".[dev]" } finally { Pop-Location }
}

# SQLAlchemy's Cython extensions are optional. Some managed Windows PCs block
# native DLLs through Application Control, so fall back to SQLAlchemy's
# supported pure-Python installation when its native import is blocked.
Write-Host ""
Write-Host ""
Write-Host "==> Check SQLAlchemy native extension availability" -ForegroundColor Cyan
$sqlalchemyProbe = & $pythonEnv -c "import subprocess,sys; p=subprocess.run([sys.executable,'-c','import sqlalchemy; from sqlalchemy.engine import result'],capture_output=True,text=True); print('EXIT_CODE='+str(p.returncode)); print(p.stdout); print(p.stderr)"
if ($LASTEXITCODE -ne 0) {
    throw "Could not start the isolated SQLAlchemy import check (exit code $LASTEXITCODE)."
}
$probeText = $sqlalchemyProbe -join [Environment]::NewLine
$probeExitLine = $sqlalchemyProbe | Where-Object { $_ -like "EXIT_CODE=*" } | Select-Object -First 1
if (-not $probeExitLine) {
    throw "The SQLAlchemy import check returned an unexpected result: $probeText"
}
$sqlalchemyProbeExitCode = [int]$probeExitLine.Substring("EXIT_CODE=".Length)
if ($sqlalchemyProbeExitCode -ne 0) {
    if ($probeText -match "(?i)DLL load failed|_result_cy|Application Control") {
        Write-Host "A Windows policy blocked SQLAlchemy's optional native extension. Installing its pure-Python build..." -ForegroundColor Yellow
        $sqlalchemyVersion = & $pythonEnv -c "from importlib.metadata import version; print(version('SQLAlchemy'))"
        if ($LASTEXITCODE -ne 0 -or -not $sqlalchemyVersion) {
            throw "Could not determine the installed SQLAlchemy version for a safe pure-Python reinstall."
        }
        $env:DISABLE_SQLALCHEMY_CEXT = "1"
        try {
            Invoke-Checked "Reinstall SQLAlchemy $sqlalchemyVersion without native extensions" {
                & $pythonEnv -m pip install --force-reinstall --no-cache-dir --no-binary=SQLAlchemy --no-deps "SQLAlchemy==$sqlalchemyVersion"
            }
        }
        finally {
            Remove-Item Env:DISABLE_SQLALCHEMY_CEXT -ErrorAction SilentlyContinue
        }
        Invoke-Checked "Verify SQLAlchemy pure-Python installation" {
            & $pythonEnv -c "import sqlalchemy; from sqlalchemy.engine import result; print('SQLAlchemy', sqlalchemy.__version__, 'loaded successfully')"
        }
    }
    else {
        throw "SQLAlchemy import check failed for an unexpected reason: $probeText"
    }
}
else {
    Write-Host "SQLAlchemy imported successfully."
}

if (-not (Test-Path (Join-Path $frontend ".env.local"))) {
    Copy-Item (Join-Path $frontend ".env.local.example") (Join-Path $frontend ".env.local")
    Write-Host "Created frontend/.env.local from the example."
}

Invoke-Checked "Install frontend dependencies" {
    Push-Location $frontend
    try { npm install } finally { Pop-Location }
}

Invoke-Checked "Run backend tests" {
    Push-Location $backend
    try { & $pythonEnv -m pytest -q } finally { Pop-Location }
}

Invoke-Checked "Run frontend type-check" {
    Push-Location $frontend
    try { npm run typecheck } finally { Pop-Location }
}

Invoke-Checked "Run frontend lint" {
    Push-Location $frontend
    try { npm run lint } finally { Pop-Location }
}

Invoke-Checked "Build frontend for production" {
    Push-Location $frontend
    try { npm run build } finally { Pop-Location }
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Start the backend in Terminal 1:"
Write-Host ('  cd "' + $backend + '"')
Write-Host '  .\.venv\Scripts\python.exe -m app.seed_demo_data'
Write-Host '  .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000'
Write-Host ""
Write-Host "Start the frontend in Terminal 2:"
Write-Host ('  cd "' + $frontend + '"')
Write-Host '  npm run dev'
Write-Host ""
Write-Host "Open http://localhost:3000 (ledger: /transactions, CSV import: /import)."
)
if (-not $probeExitMatch.Success) {
    throw "The SQLAlchemy import check returned an unexpected result: $probeText"
}
$sqlalchemyProbeExitCode = [int]$probeExitMatch.Groups[1].Value
if ($sqlalchemyProbeExitCode -ne 0) {
    if ($probeText -match "(?i)DLL load failed|_result_cy|Application Control") {
        Write-Host "A Windows policy blocked SQLAlchemy's optional native extension. Installing its pure-Python build..." -ForegroundColor Yellow
        $sqlalchemyVersion = & $pythonEnv -c "from importlib.metadata import version; print(version('SQLAlchemy'))"
        if ($LASTEXITCODE -ne 0 -or -not $sqlalchemyVersion) {
            throw "Could not determine the installed SQLAlchemy version for a safe pure-Python reinstall."
        }
        $env:DISABLE_SQLALCHEMY_CEXT = "1"
        try {
            Invoke-Checked "Reinstall SQLAlchemy $sqlalchemyVersion without native extensions" {
                & $pythonEnv -m pip install --force-reinstall --no-cache-dir --no-binary=SQLAlchemy --no-deps "SQLAlchemy==$sqlalchemyVersion"
            }
        }
        finally {
            Remove-Item Env:DISABLE_SQLALCHEMY_CEXT -ErrorAction SilentlyContinue
        }
        Invoke-Checked "Verify SQLAlchemy pure-Python installation" {
            & $pythonEnv -c "import sqlalchemy; from sqlalchemy.engine import result; print('SQLAlchemy', sqlalchemy.__version__, 'loaded successfully')"
        }
    }
    else {
        throw "SQLAlchemy import check failed for an unexpected reason: $probeText"
    }
}
else {
    Write-Host "SQLAlchemy imported successfully."
}

if (-not (Test-Path (Join-Path $frontend ".env.local"))) {
    Copy-Item (Join-Path $frontend ".env.local.example") (Join-Path $frontend ".env.local")
    Write-Host "Created frontend/.env.local from the example."
}

Invoke-Checked "Install frontend dependencies" {
    Push-Location $frontend
    try { npm install } finally { Pop-Location }
}

Invoke-Checked "Run backend tests" {
    Push-Location $backend
    try { & $pythonEnv -m pytest -q } finally { Pop-Location }
}

Invoke-Checked "Run frontend type-check" {
    Push-Location $frontend
    try { npm run typecheck } finally { Pop-Location }
}

Invoke-Checked "Run frontend lint" {
    Push-Location $frontend
    try { npm run lint } finally { Pop-Location }
}

Invoke-Checked "Build frontend for production" {
    Push-Location $frontend
    try { npm run build } finally { Pop-Location }
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Start the backend in Terminal 1:"
Write-Host ('  cd "' + $backend + '"')
Write-Host '  .\.venv\Scripts\python.exe -m app.seed_demo_data'
Write-Host '  .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000'
Write-Host ""
Write-Host "Start the frontend in Terminal 2:"
Write-Host ('  cd "' + $frontend + '"')
Write-Host '  npm run dev'
Write-Host ""
Write-Host "Open http://localhost:3000 (ledger: /transactions, CSV import: /import)."
