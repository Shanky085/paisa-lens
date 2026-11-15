from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.budget import MonthlyBudget
from app.schemas.budget import BudgetRead, BudgetUpsert

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/{year}/{month}", response_model=BudgetRead)
def get_monthly_budget(
    year: int = Path(ge=2000, le=2100),
    month: int = Path(ge=1, le=12),
    db: Session = Depends(get_db),
):
    budget = db.scalar(
        select(MonthlyBudget).where(
            MonthlyBudget.year == year, MonthlyBudget.month == month
        )
    )
    if budget is None:
        raise HTTPException(status_code=404, detail="No budget configured for this month")
    return {"year": budget.year, "month": budget.month, "amount": budget.amount}


@router.put("/{year}/{month}", response_model=BudgetRead)
def set_monthly_budget(
    payload: BudgetUpsert,
    year: int = Path(ge=2000, le=2100),
    month: int = Path(ge=1, le=12),
    db: Session = Depends(get_db),
):
    budget = db.scalar(
        select(MonthlyBudget).where(
            MonthlyBudget.year == year, MonthlyBudget.month == month
        )
    )
    if budget is None:
        budget = MonthlyBudget(year=year, month=month, amount=payload.amount)
        db.add(budget)
    else:
        budget.amount = payload.amount

    db.commit()
    db.refresh(budget)
    return {"year": budget.year, "month": budget.month, "amount": budget.amount}
