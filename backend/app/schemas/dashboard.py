from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class DailyMetric(BaseModel):
    date: date
    day: int
    amount: Decimal = Field(..., max_digits=12, decimal_places=2)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class CategoryMetric(BaseModel):
    category: str
    amount: Decimal = Field(..., max_digits=12, decimal_places=2)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class DashboardRecentTransaction(BaseModel):
    id: int
    title: str
    amount: Decimal = Field(..., max_digits=12, decimal_places=2)
    kind: Literal["income", "expense"]
    category: str
    transaction_date: date

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class PeriodComparison(BaseModel):
    previous_income: Decimal | None = None
    previous_expenses: Decimal | None = None
    income_delta_percent: float | None = None
    expenses_delta_percent: float | None = None
    comparison_period_label: str | None = None

    @field_serializer("previous_income", "previous_expenses")
    def serialize_optional_amount(self, value: Decimal | None) -> str | None:
        return f"{value:.2f}" if value is not None else None


class DashboardSummary(BaseModel):
    period: str
    is_custom_range: bool = False
    budget_applicable: bool = True
    income: Decimal = Field(..., max_digits=12, decimal_places=2)
    expenses: Decimal = Field(..., max_digits=12, decimal_places=2)
    net_cash_flow: Decimal = Field(..., max_digits=12, decimal_places=2)
    transaction_count: int
    monthly_budget: Decimal | None = None
    budget_remaining: Decimal | None = None
    budget_utilization: float | None = None
    daily_spending: list[DailyMetric]
    category_breakdown: list[CategoryMetric]
    daily_income: list[DailyMetric] = Field(default_factory=list)
    category_income: list[CategoryMetric] = Field(default_factory=list)
    recent_transactions: list[DashboardRecentTransaction]
    comparison: PeriodComparison

    @field_serializer("income", "expenses", "net_cash_flow")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"

    @field_serializer("monthly_budget", "budget_remaining")
    def serialize_optional_budget(self, value: Decimal | None) -> str | None:
        return f"{value:.2f}" if value is not None else None
