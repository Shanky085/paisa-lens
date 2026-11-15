from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

class TransactionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    kind: Literal["income", "expense"]
    category: str = Field(default="Other", max_length=60)
    transaction_date: date
    note: str | None = Field(default=None, max_length=500)

class TransactionRead(TransactionCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
