from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.budget import MonthlyBudget
from app.models.transaction import Transaction
from app.schemas.dashboard import (
    CategoryMetric,
    DailyMetric,
    DashboardRecentTransaction,
    DashboardSummary,
    PeriodComparison,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    start_date: date | None = None,
    end_date: date | None = None,
    today_mode: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    # 1. Parameter validation
    has_date_range = start_date is not None or end_date is not None
    has_year_month = year is not None or month is not None

    if (start_date is None) != (end_date is None):
        raise HTTPException(
            status_code=422,
            detail="Both start_date and end_date must be provided together.",
        )

    if has_date_range and has_year_month:
        raise HTTPException(
            status_code=422,
            detail="Cannot specify both year/month and start_date/end_date.",
        )

    today = date.today()

    if has_date_range:
        assert start_date is not None and end_date is not None
        if start_date > end_date:
            raise HTTPException(
                status_code=422,
                detail="start_date cannot be after end_date.",
            )
        days_span = (end_date - start_date).days + 1
        if days_span < 1:
            raise HTTPException(
                status_code=422,
                detail="Date range must contain at least 1 day.",
            )
        if days_span > 366:
            raise HTTPException(
                status_code=422,
                detail="Date range cannot exceed 366 days.",
            )

        period_start = start_date
        period_end = end_date
        period_label = f"{start_date.isoformat()} to {end_date.isoformat()}"
        is_custom_range = True

        # Check if custom range happens to align with an exact single full month
        is_single_full_month = (
            period_start.day == 1
            and period_end.day == monthrange(period_start.year, period_start.month)[1]
            and period_start.year == period_end.year
            and period_start.month == period_end.month
        )
        if is_single_full_month:
            budget_applicable = True
            budget_year = period_start.year
            budget_month = period_start.month
        else:
            budget_applicable = False
            budget_year = None
            budget_month = None

    else:
        is_custom_range = False
        if today_mode:
            period_start = today
            period_end = today
            period_label = "today"
            budget_applicable = True
            budget_year = today.year
            budget_month = today.month
        else:
            target_year = year if year is not None else today.year
            target_month = month if month is not None else today.month
            period_start = date(target_year, target_month, 1)
            period_end = date(
                target_year, target_month, monthrange(target_year, target_month)[1]
            )
            period_label = f"{target_year:04d}-{target_month:02d}"
            budget_applicable = True
            budget_year = target_year
            budget_month = target_month

    # 2. Query transactions for selected period
    rows = db.scalars(
        select(Transaction)
        .where(
            Transaction.transaction_date >= period_start,
            Transaction.transaction_date <= period_end,
        )
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    ).all()

    income = Decimal("0.00")
    expenses = Decimal("0.00")
    daily_expenses_map: dict[date, Decimal] = {}
    daily_income_map: dict[date, Decimal] = {}
    category_expenses_map: dict[str, Decimal] = {}
    category_income_map: dict[str, Decimal] = {}

    for row in rows:
        amount = Decimal(str(row.amount))
        if row.kind == "expense":
            expenses += amount
            daily_expenses_map[row.transaction_date] = (
                daily_expenses_map.get(row.transaction_date, Decimal("0.00")) + amount
            )
            category_expenses_map[row.category] = (
                category_expenses_map.get(row.category, Decimal("0.00")) + amount
            )
        elif row.kind == "income":
            income += amount
            daily_income_map[row.transaction_date] = (
                daily_income_map.get(row.transaction_date, Decimal("0.00")) + amount
            )
            category_income_map[row.category] = (
                category_income_map.get(row.category, Decimal("0.00")) + amount
            )

    daily_spending = [
        DailyMetric(date=day, day=day.day, amount=amount)
        for day, amount in sorted(daily_expenses_map.items())
    ]
    daily_income = [
        DailyMetric(date=day, day=day.day, amount=amount)
        for day, amount in sorted(daily_income_map.items())
    ]
    category_breakdown = [
        CategoryMetric(category=category, amount=amount)
        for category, amount in sorted(
            category_expenses_map.items(), key=lambda item: item[1], reverse=True
        )
    ]
    category_income = [
        CategoryMetric(category=category, amount=amount)
        for category, amount in sorted(
            category_income_map.items(), key=lambda item: item[1], reverse=True
        )
    ]
    recent_transactions = [
        DashboardRecentTransaction.model_validate(row) for row in rows[:8]
    ]

    # 3. Budget context calculation
    if budget_applicable and budget_year is not None and budget_month is not None:
        budget_record = db.scalar(
            select(MonthlyBudget).where(
                MonthlyBudget.year == budget_year, MonthlyBudget.month == budget_month
            )
        )
        monthly_budget = Decimal(str(budget_record.amount)) if budget_record else None

        if today_mode:
            # Safeguard: For Today mode, use current month's cumulative expenses
            month_start = date(budget_year, budget_month, 1)
            month_end = date(
                budget_year, budget_month, monthrange(budget_year, budget_month)[1]
            )
            cumulative_rows = db.scalars(
                select(Transaction.amount).where(
                    Transaction.transaction_date >= month_start,
                    Transaction.transaction_date <= month_end,
                    Transaction.kind == "expense",
                )
            ).all()
            cumulative_expenses = sum(
                (Decimal(str(a)) for a in cumulative_rows), Decimal("0.00")
            )
            budget_remaining = (
                monthly_budget - cumulative_expenses if monthly_budget is not None else None
            )
            budget_utilization = (
                round(float((cumulative_expenses / monthly_budget) * 100), 1)
                if monthly_budget is not None and monthly_budget > Decimal("0.00")
                else None
            )
        else:
            budget_remaining = (
                monthly_budget - expenses if monthly_budget is not None else None
            )
            budget_utilization = (
                round(float((expenses / monthly_budget) * 100), 1)
                if monthly_budget is not None and monthly_budget > Decimal("0.00")
                else None
            )
    else:
        monthly_budget = None
        budget_remaining = None
        budget_utilization = None

    # 4. Period comparison calculation
    current_comp_income = income
    current_comp_expenses = expenses

    if is_custom_range:
        days_span = (period_end - period_start).days + 1
        prev_end = period_start - timedelta(days=1)
        prev_start = period_start - timedelta(days=days_span)
        comp_label = (
            f"{period_start.strftime('%d %b %Y')}–{period_end.strftime('%d %b %Y')} vs "
            f"{prev_start.strftime('%d %b %Y')}–{prev_end.strftime('%d %b %Y')}"
        )
    elif today_mode:
        prev_start = today - timedelta(days=1)
        prev_end = prev_start
        comp_label = "Today vs Yesterday"
    else:
        assert budget_year is not None and budget_month is not None
        is_current_month = budget_year == today.year and budget_month == today.month
        if is_current_month:
            # Safeguard: Compare month-to-date against equivalent elapsed days of previous month
            elapsed_days = min(today.day, monthrange(budget_year, budget_month)[1])
            if budget_month == 1:
                prev_y, prev_m = budget_year - 1, 12
            else:
                prev_y, prev_m = budget_year, budget_month - 1
            prev_max_days = monthrange(prev_y, prev_m)[1]
            prev_elapsed = min(elapsed_days, prev_max_days)

            prev_start = date(prev_y, prev_m, 1)
            prev_end = date(prev_y, prev_m, prev_elapsed)

            mtd_rows = db.scalars(
                select(Transaction).where(
                    Transaction.transaction_date >= date(budget_year, budget_month, 1),
                    Transaction.transaction_date
                    <= date(budget_year, budget_month, elapsed_days),
                )
            ).all()
            current_comp_income = sum(
                (Decimal(str(r.amount)) for r in mtd_rows if r.kind == "income"),
                Decimal("0.00"),
            )
            current_comp_expenses = sum(
                (Decimal(str(r.amount)) for r in mtd_rows if r.kind == "expense"),
                Decimal("0.00"),
            )
            comp_label = (
                f"1–{elapsed_days} {period_start.strftime('%b')} vs "
                f"1–{prev_elapsed} {prev_start.strftime('%b')}"
            )
        else:
            # Completed historical full month
            if budget_month == 1:
                prev_y, prev_m = budget_year - 1, 12
            else:
                prev_y, prev_m = budget_year, budget_month - 1
            prev_start = date(prev_y, prev_m, 1)
            prev_end = date(prev_y, prev_m, monthrange(prev_y, prev_m)[1])
            comp_label = (
                f"{period_start.strftime('%b %Y')} vs {prev_start.strftime('%b %Y')}"
            )

    prev_rows = db.scalars(
        select(Transaction).where(
            Transaction.transaction_date >= prev_start,
            Transaction.transaction_date <= prev_end,
        )
    ).all()
    prev_income = sum(
        (Decimal(str(r.amount)) for r in prev_rows if r.kind == "income"),
        Decimal("0.00"),
    )
    prev_expenses = sum(
        (Decimal(str(r.amount)) for r in prev_rows if r.kind == "expense"),
        Decimal("0.00"),
    )

    if prev_income > Decimal("0.00"):
        income_delta_percent = round(
            float(((current_comp_income - prev_income) / prev_income) * 100), 1
        )
    else:
        income_delta_percent = None

    if prev_expenses > Decimal("0.00"):
        expenses_delta_percent = round(
            float(((current_comp_expenses - prev_expenses) / prev_expenses) * 100), 1
        )
    else:
        expenses_delta_percent = None

    comparison = PeriodComparison(
        previous_income=prev_income if prev_rows else None,
        previous_expenses=prev_expenses if prev_rows else None,
        income_delta_percent=income_delta_percent,
        expenses_delta_percent=expenses_delta_percent,
        comparison_period_label=comp_label,
    )

    return DashboardSummary(
        period=period_label,
        is_custom_range=is_custom_range,
        budget_applicable=budget_applicable,
        income=income,
        expenses=expenses,
        net_cash_flow=income - expenses,
        transaction_count=len(rows),
        monthly_budget=monthly_budget,
        budget_remaining=budget_remaining,
        budget_utilization=budget_utilization,
        daily_spending=daily_spending,
        category_breakdown=category_breakdown,
        daily_income=daily_income,
        category_income=category_income,
        recent_transactions=recent_transactions,
        comparison=comparison,
    )
