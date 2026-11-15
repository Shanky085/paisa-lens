from calendar import monthrange
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.budget import MonthlyBudget
from app.models.transaction import Transaction

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary(
    year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    month: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    db: Session = Depends(get_db),
):
    period_start = date(year, month, 1)
    period_end = date(year, month, monthrange(year, month)[1])
    rows = db.scalars(
        select(Transaction)
        .where(
            Transaction.transaction_date >= period_start,
            Transaction.transaction_date <= period_end,
        )
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    ).all()

    income = sum((row.amount for row in rows if row.kind == "income"), Decimal("0.00"))
    expenses = sum((row.amount for row in rows if row.kind == "expense"), Decimal("0.00"))
    budget = db.scalar(
        select(MonthlyBudget).where(
            MonthlyBudget.year == year, MonthlyBudget.month == month
        )
    )
    budget_amount = budget.amount if budget else None
    budget_remaining = budget_amount - expenses if budget_amount is not None else None
    budget_utilization = (
        round(float((expenses / budget_amount) * 100), 1)
        if budget_amount is not None and budget_amount > 0
        else None
    )

    daily_totals: dict[date, Decimal] = {}
    category_totals: dict[str, Decimal] = {}
    for row in rows:
        if row.kind != "expense":
            continue
        daily_totals[row.transaction_date] = (
            daily_totals.get(row.transaction_date, Decimal("0.00")) + row.amount
        )
        category_totals[row.category] = (
            category_totals.get(row.category, Decimal("0.00")) + row.amount
        )

    daily_spending = [
        {"date": day.isoformat(), "day": day.day, "amount": str(amount)}
        for day, amount in sorted(daily_totals.items())
    ]
    category_breakdown = [
        {"category": category, "amount": str(amount)}
        for category, amount in sorted(
            category_totals.items(), key=lambda item: item[1], reverse=True
        )
    ]

    recent_transactions = [
        {
            "id": row.id,
            "title": row.title,
            "amount": str(row.amount),
            "kind": row.kind,
            "category": row.category,
            "transaction_date": row.transaction_date.isoformat(),
        }
        for row in rows[:8]
    ]

    return {
        "period": f"{year:04d}-{month:02d}",
        "income": str(income),
        "expenses": str(expenses),
        "net_cash_flow": str(income - expenses),
        "transaction_count": len(rows),
        "monthly_budget": str(budget_amount) if budget_amount is not None else None,
        "budget_remaining": str(budget_remaining) if budget_remaining is not None else None,
        "budget_utilization": budget_utilization,
        "daily_spending": daily_spending,
        "category_breakdown": category_breakdown,
        "recent_transactions": recent_transactions,
    }
