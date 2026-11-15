from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import extract, select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.transaction import Transaction

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    today = date.today()
    rows = db.scalars(select(Transaction).where(extract("year", Transaction.transaction_date) == today.year, extract("month", Transaction.transaction_date) == today.month)).all()
    income = sum((x.amount for x in rows if x.kind == "income"), Decimal("0.00"))
    expenses = sum((x.amount for x in rows if x.kind == "expense"), Decimal("0.00"))
    return {"period": today.strftime("%Y-%m"), "income": str(income), "expenses": str(expenses), "net_cash_flow": str(income - expenses), "transaction_count": len(rows)}
