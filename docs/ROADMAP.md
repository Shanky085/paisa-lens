# Build Roadmap

## Sprint 0 — Foundation
- [x] Establish repository layout and product rules
- [x] Build responsive glassmorphism dashboard shell
- [x] Add FastAPI service, SQLAlchemy transaction model and SQLite setup
- [x] Add local environment examples and basic test configuration

## Sprint 1 — Financial data workflow
- [x] Connect dashboard to FastAPI
- [x] Add transaction create/list/delete endpoints
- [x] Add transaction update endpoint
- [x] Add date, type and category filters to transaction listing
- [x] Add monthly budget storage and manual budget entry
- [x] Add deterministic synthetic student demo data
- [x] Add monthly totals, daily spending and category breakdown API data
- [ ] Add transaction edit/delete controls to the dashboard UI
- [ ] Implement CSV column mapping, import preview and row validation
- [ ] Add duplicate detection and own-account transfer handling

## Sprint 2 — Decision support
- [x] Monthly spending overview and category totals
- [ ] Spending trend comparisons across periods
- [ ] Conservative end-of-period forecast
- [ ] What-if purchase simulator
- [ ] Budget alerts and recurring-payment detection

## Sprint 3 — Signature intelligence
- [ ] Goal creation, feasibility and explicit savings allocations
- [ ] Fixed daily spending plan with no rollover
- [ ] Multiple-goal conflict detection
- [ ] Replanning when the user falls behind
- [ ] AI Coach grounded in validated structured metrics

## Sprint 4 — Hackathon hardening
- [x] Backend API tests in GitHub Actions
- [x] Frontend type-check, lint and build workflow
- [x] Backend Dockerfile and deployment instructions
- [ ] Verify latest frontend production build is green
- [ ] Provision frontend and backend hosting
- [ ] Test deployed experience on mobile
- [ ] Add demo screenshots and record under-five-minute walkthrough

## Production readiness (before real financial accounts)
- [ ] Authentication and per-user data isolation
- [ ] PostgreSQL and Alembic migrations
- [ ] Backup/restore and retention policy
- [ ] Rate limiting, secure headers and operational monitoring
- [ ] Security review and privacy notice
