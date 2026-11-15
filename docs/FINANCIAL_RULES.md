# Financial Rules and Definitions

## Core definitions
- **Income:** money received, excluding identified own-account transfers and reversals.
- **Expense:** money spent, excluding identified own-account transfers and reversals.
- **Net cash flow:** income minus expenses for the selected period. This is not necessarily the user's actual bank balance.
- **Budget remaining:** configured budget minus counted expenses. It can be negative.
- **Unspent allowance:** the part of a spending limit not used. It is not automatically savings.
- **Saved amount:** money the user explicitly records as saved.
- **Goal allocation:** a virtual earmark of explicitly saved funds toward one goal. It is not a bank transfer.

## Arithmetic requirements
- Use `Decimal` (or integer paise) for currency calculations; do not use binary floating point for stored money.
- Store positive transaction amounts and keep transaction direction in a separate `income` / `expense` field.
- Round only at presentation or at a clearly specified currency boundary.
- Validate that dates, amounts and transaction types are valid before persistence.

## Goal Mode planning
At minimum:

`required_daily_saving = max(target_amount - explicitly_allocated_amount, 0) / remaining_days`

The daily spending limit must be derived from available period funds after essential commitments and planned goal contributions. The exact calculation must account for pay dates, deadlines and period boundaries; it must not divide a monthly budget blindly by 30.

No-rollover invariant: each day's spending cap is independently fixed by the current plan. Underspending does not add to a later day's allowance. The unused amount remains unspent unless the user explicitly records it as saved and allocates it.

## Forecasting
Forecasts are estimates, not guarantees. Display the assumptions, the history window and a confidence/uncertainty indicator. Do not extrapolate aggressively from sparse history.
