"""Create deterministic, clearly synthetic student-finance records for local demos."""
from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import MonthlyBudget, Transaction

EXPENSES = [
    ("Cafe Coffee Day", "Food & dining", "185.00", 1),
    ("Stationery Hub", "Education", "420.00", 2),
    ("Hostel mess", "Food & dining", "950.00", 3),
    ("Auto fare", "Transport", "650.00", 4),
    ("Printout shop", "Education", "240.00", 5),
    ("Grocery store", "Essentials", "780.00", 6),
    ("Campus canteen", "Food & dining", "320.00", 7),
    ("Course materials", "Education", "1100.00", 8),
    ("Bus pass", "Transport", "560.00", 9),
    ("Online shopping", "Shopping", "890.00", 10),
    ("Snacks", "Food & dining", "430.00", 11),
    ("Laundry", "Essentials", "720.00", 12),
    ("Tea stall", "Food & dining", "300.00", 13),
    ("Hostel mess", "Food & dining", "950.00", 14),
    ("Mobile recharge", "Essentials", "840.00", 15),
    ("Project supplies", "Education", "1085.00", 16),
    ("Movie and outing", "Entertainment", "1000.00", 16),
]


def seed_demo_data() -> None:
    Base.metadata.create_all(bind=engine)
    today = date.today()
    first_day = today.replace(day=1)

    with SessionLocal() as db:
        count = db.scalar(select(func.count()).select_from(Transaction)) or 0
        if count:
            print(f"Found {count} existing transactions; leaving data unchanged.")
            return

        budget = db.scalar(
            select(MonthlyBudget).where(
                MonthlyBudget.year == today.year, MonthlyBudget.month == today.month
            )
        )
        if budget is None:
            db.add(MonthlyBudget(year=today.year, month=today.month, amount=Decimal("16000.00")))

        records = [
            Transaction(
                title="Monthly allowance",
                amount=Decimal("12000.00"),
                kind="income",
                category="Allowance",
                transaction_date=first_day,
                note="Synthetic demo transaction",
            ),
            Transaction(
                title="Campus stipend",
                amount=Decimal("3000.00"),
                kind="income",
                category="Stipend",
                transaction_date=first_day.replace(day=min(5, monthrange(today.year, today.month)[1])),
                note="Synthetic demo transaction",
            ),
        ]

        for title, category, amount, day in EXPENSES:
            records.append(
                Transaction(
                    title=title,
                    amount=Decimal(amount),
                    kind="expense",
                    category=category,
                    transaction_date=first_day.replace(day=min(day, today.day)),
                    note="Synthetic demo transaction",
                )
            )

        db.add_all(records)
        db.commit()
        print(f"Inserted {len(records)} synthetic transactions for {today:%Y-%m}.")


if __name__ == "__main__":
    seed_demo_data()
