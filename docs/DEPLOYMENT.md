# Deployment preparation

This document prepares the two deployable parts; it does not provision cloud resources.

## Frontend — Vercel

1. Import `Shanky085/paisa-lens` into Vercel.
2. Set the project root directory to `frontend`.
3. Keep the framework preset as Next.js.
4. Add the environment variable `NEXT_PUBLIC_API_URL` with the deployed backend URL plus `/api/v1`, for example `https://api.example.com/api/v1`.
5. Deploy after the backend is reachable.

## Backend — any Docker-compatible host

The `backend/Dockerfile` builds the FastAPI service. Configure these environment variables:

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | host-provided port | HTTP listening port |
| `DATABASE_URL` | `sqlite:////data/paisa_lens.db` | SQLite database path |
| `FRONTEND_ORIGIN` | `https://your-app.vercel.app` | Exact frontend origin allowed by CORS |
| `SEED_DEMO_DATA` | `true` | Insert synthetic demo records only when no transactions exist |

If using SQLite in a container, mount a persistent volume at `/data` and set `DATABASE_URL=sqlite:////data/paisa_lens.db`. Without persistent storage, transactions and budgets can disappear when the container is replaced or restarted.

For a future multi-user release, use PostgreSQL, migrations, authentication, per-user database filtering and a documented backup/restore procedure. These are not yet implemented.

## Safe demo restrictions

- Keep the service populated only with synthetic data.
- Do not use real bank statements, UPI exports or personal financial records on a public deployment.
- Anyone who can reach the current API can read, add, edit or delete the shared demo records because authentication is not implemented.
- Keep provider credentials in server-side environment variables; never put backend secrets in `NEXT_PUBLIC_*` variables.
- Configure the exact final Vercel URL in `FRONTEND_ORIGIN` to avoid broad CORS access.

## Local container smoke test

From the repository root:

```bash
docker build -t paisa-lens-api ./backend
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=sqlite:////tmp/paisa_lens.db \
  -e SEED_DEMO_DATA=true \
  paisa-lens-api
```

Then open `http://localhost:8000/health` and `http://localhost:8000/docs`.
