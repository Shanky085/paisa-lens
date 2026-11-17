from calendar import monthrange
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.transaction import Transaction
from app.schemas.transaction import (
    TransactionCreate,
    TransactionImportRequest,
    TransactionImportResult,
    TransactionRead,
    TransactionUpdate,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    start_date: date | None = None,
    end_date: date | None = None,
    kind: str | None = Query(default=None, pattern="^(income|expense)$"),
    category: str | None = Query(default=None, min_length=1, max_length=60),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date")

    statement = select(Transaction)
    if start_date:
        statement = statement.where(Transaction.transaction_date >= start_date)
    if end_date:
        statement = statement.where(Transaction.transaction_date <= end_date)
    if kind:
        statement = statement.where(Transaction.kind == kind)
    if category:
        statement = statement.where(Transaction.category == category)

    statement = statement.order_by(
        Transaction.transaction_date.desc(), Transaction.id.desc()
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    item = Transaction(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _transaction_signature(item):
    """Conservative duplicate candidate: date, amount, kind and normalized title."""
    return (
        item.transaction_date,
        Decimal(item.amount).quantize(Decimal("0.01")),
        item.kind,
        " ".join(item.title.casefold().split()),
    )


@router.post("/import", response_model=TransactionImportResult)
def import_transactions(
    payload: TransactionImportRequest,
    db: Session = Depends(get_db),
):
    dates = [item.transaction_date for item in payload.transactions]
    existing_statement = select(Transaction).where(
        Transaction.transaction_date >= min(dates),
        Transaction.transaction_date <= max(dates),
    )
    existing = db.scalars(existing_statement).all()
    known_signatures = {_transaction_signature(item) for item in existing}

    duplicate_rows = []
    batch_signatures = set()
    for row_number, item in enumerate(payload.transactions, start=1):
        signature = _transaction_signature(item)
        if signature in known_signatures or signature in batch_signatures:
            duplicate_rows.append(row_number)
        batch_signatures.add(signature)

    if duplicate_rows and not payload.allow_duplicates:
        return TransactionImportResult(
            imported_count=0,
            duplicate_count=len(duplicate_rows),
            duplicate_rows=duplicate_rows,
            requires_confirmation=True,
        )

    records = [Transaction(**item.model_dump()) for item in payload.transactions]
    db.add_all(records)
    db.commit()
    return TransactionImportResult(
        imported_count=len(records),
        duplicate_count=len(duplicate_rows),
        duplicate_rows=duplicate_rows,
        requires_confirmation=False,
    )


FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r", "\n")


def sanitize_csv_cell(value: object | None) -> str:
    """
    Prevents CSV formula injection / macro execution.
    Checks raw and leading-whitespace-stripped text for formula triggers (=, +, -, @, tab, newline).
    Neutralizes formula triggers by prepending a single quote.
    Escapes embedded double quotes per RFC 4180.
    """
    if value is None:
        return '""'
    text = str(value)
    stripped = text.lstrip(" \t\r\n")
    is_formula = False
    if stripped and stripped[0] in FORMULA_TRIGGERS:
        is_formula = True
    elif text and text[0] in FORMULA_TRIGGERS:
        is_formula = True

    escaped = text.replace('"', '""')
    if is_formula:
        return f'"\'{escaped}"'
    return f'"{escaped}"'


@router.get("/export")
def export_transactions(
    start_date: date | None = None,
    end_date: date | None = None,
    all_time: bool = Query(default=False),
    kind: str | None = Query(default=None, pattern="^(income|expense)$"),
    category: str | None = Query(default=None, min_length=1, max_length=60),
    db: Session = Depends(get_db),
):
    if all_time and (start_date is not None or end_date is not None):
        raise HTTPException(
            status_code=422,
            detail="Cannot specify date filters when all_time is True.",
        )

    if (start_date is None) != (end_date is None):
        raise HTTPException(
            status_code=422,
            detail="Both start_date and end_date must be provided together.",
        )

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="start_date must be on or before end_date.",
        )

    today = date.today()
    if not all_time and start_date is None and end_date is None:
        filter_start = date(today.year, today.month, 1)
        filter_end = date(today.year, today.month, monthrange(today.year, today.month)[1])
    else:
        filter_start = start_date
        filter_end = end_date

    statement = select(Transaction)
    if not all_time:
        assert filter_start is not None and filter_end is not None
        statement = statement.where(
            Transaction.transaction_date >= filter_start,
            Transaction.transaction_date <= filter_end,
        )
    if kind:
        statement = statement.where(Transaction.kind == kind)
    if category:
        statement = statement.where(Transaction.category == category)

    statement = statement.order_by(
        Transaction.transaction_date.desc(), Transaction.id.desc()
    )

    def generate_csv():
        yield "Date,Type,Title,Category,Amount,Note\r\n"
        for item in db.scalars(statement.execution_options(yield_per=100)):
            amount_str = f"{Decimal(str(item.amount)):.2f}"
            row = [
                item.transaction_date.isoformat(),
                item.kind,
                sanitize_csv_cell(item.title),
                sanitize_csv_cell(item.category),
                amount_str,
                sanitize_csv_cell(item.note),
            ]
            yield f"{row[0]},{row[1]},{row[2]},{row[3]},{row[4]},{row[5]}\r\n"

    filename = f"paisalens-transactions-{today.isoformat()}.csv"
    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(Transaction, transaction_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int, db: Session = Depends(get_db)
):
    item = db.get(Transaction, transaction_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(item)
    db.commit()
    return Response(status_code=204)
