# PaisaLens — Product Specification

## Audience
Indian college students and young adults, typically 18–25, managing allowance, scholarship, stipend or part-time income in INR.

## Product promise
Turn transaction history into understandable explanations and realistic next actions. PaisaLens is more than an expense log: it explains what happened, why it happened and what action may help.

## MVP capabilities
1. Dashboard: monthly income, expense, net cash flow, budget utilisation, spending pace, category mix and recent activity.
2. Transaction management: manual entries, editing/deletion, filters and correction of categories.
3. Statement import/export: CSV and supported bank/UPI statement files, column mapping, validation, debit/credit distinction, duplicate detection and transfer exclusion.
4. Budget management: monthly budget and category-level limits.
5. Analytics: spending trends, category breakdowns and conservative end-of-period projections.
6. Purchase simulator: show how a proposed purchase changes the remaining budget and goal feasibility.
7. Goal Mode: target, current saved amount, deadline, priority, explicit allocations and an explainable spending plan.
8. AI Financial Coach: explain backend-computed facts, identify trade-offs and suggest feasible actions.
9. Demo mode: synthetic transactions for judges and first-time users.

## UPI data access decision

Direct UPI synchronisation is **out of scope** for the current product.

PaisaLens will not:
- Integrate with unofficial or reverse-engineered UPI endpoints.
- Read SMS messages or payment-app notifications.
- Request UPI PINs, OTPs, bank passwords or other payment credentials.
- Build an Android notification-listener companion solely to capture UPI transactions.
- Claim that NPCI MyUPI provides a public read-only developer API.

Users may still bring their own transaction data through statement files that the relevant bank or payment app makes available for download. This is a user-initiated import, not an automatic account connection.

Direct integration may be reconsidered only if a suitable official, documented, public read-only API becomes available to an independent application on clear and lawful terms, with user consent and no restricted participant access.

## Out of MVP scope
Direct bank integrations, direct UPI synchronisation, SMS scraping, notification capture, collection of UPI credentials, investment execution, tax filing, credit scoring and native mobile apps.

## Goal Mode invariants
- The user explicitly records savings and explicitly allocates them to a goal.
- Unspent money is not automatically considered saved.
- Goal allocations are virtual earmarks; PaisaLens does not transfer or hold money.
- Daily spending limits do not roll over. Spending less today does not increase tomorrow's limit.
- When a plan falls behind, calculate a new feasible plan from the remaining amount, remaining days, committed essentials and available cash flow.
- Multiple goals must be checked for conflicts against the same savings capacity.
- If infeasible, show the shortfall and options such as lowering the target or extending the deadline; do not imply the target is achievable when it is not.

## Trust and safety
- All money values are INR and use decimal-safe arithmetic.
- Imported records are untrusted until validated and reviewed.
- Transfers between a user's own accounts must not be counted as income or expense when identified as transfers.
- AI does not decide transaction totals, budget balances or forecasts. Backend calculations are authoritative.
- AI explanations must be limited to a minimised summary and must not expose raw transaction descriptions unnecessarily.
