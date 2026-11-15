from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BudgetUpsert(BaseModel):
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class BudgetRead(BaseModel):
    year: int
    month: int
    amount: Decimal

    model_config = ConfigDict(from_attributes=True)
