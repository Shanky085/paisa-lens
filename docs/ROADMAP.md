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
- [x] Add dedicated transaction history UI with search, filters, edit and delete controls
- [x] Implement browser-side CSV parsing, column mapping, row preview and validation
- [x] Add review-gated bulk import with possible-duplicate confirmation
- [x] Highlight likely own-account transfers and leave them unchecked by default
- [ ] Add Excel import and broader bank-specific format handling
- [x] Explicitly exclude direct UPI sync without a suitable public official read-only API

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
- [x] Verify frontend type-check, lint and production build in GitHub Actions (Node 24 LTS)
- [ ] Provision frontend and backend hosting
- [ ] Test deployed experience on mobile
- [ ] Add demo screenshots and record under-five-minute walkthrough

## Production readiness (before real financial accounts)
- [ ] Authentication and per-user data isolation
- [ ] PostgreSQL and Alembic migrations
- [ ] Backup/restore and retention policy
- [ ] Rate limiting, secure headers and operational monitoring
- [ ] Security review and privacy notice

## Reconsider only if the ecosystem changes
Direct UPI sync may be researched again only if an official documented public read-only API becomes available for independent third-party apps without restricted participant status or a private partnership.
