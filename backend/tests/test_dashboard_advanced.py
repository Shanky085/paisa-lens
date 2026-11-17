from datetime import date
from decimal import Decimal
import pytest


def test_independent_income_and_expense_aggregations(client):
    """
    Verify daily_spending and category_breakdown contain ONLY expenses,
    while daily_income and category_income contain ONLY income.
    """
    # Create income transactions
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Scholarship",
            "amount": "10000.00",
            "kind": "income",
            "category": "Scholarship",
            "transaction_date": "2026-11-01",
        },
    )
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Freelance project",
            "amount": "3000.00",
            "kind": "income",
            "category": "Freelance",
            "transaction_date": "2026-11-05",
        },
    )

    # Create expense transactions
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Textbooks",
            "amount": "1500.00",
            "kind": "expense",
            "category": "Education",
            "transaction_date": "2026-11-01",
        },
    )
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Cafeteria lunch",
            "amount": "250.00",
            "kind": "expense",
            "category": "Food & dining",
            "transaction_date": "2026-11-03",
        },
    )

    summary = client.get("/api/v1/dashboard/summary?year=2026&month=11").json()

    # Expenses: 1500 + 250 = 1750
    assert summary["expenses"] == "1750.00"
    # Income: 10000 + 3000 = 13000
    assert summary["income"] == "13000.00"
    assert summary["net_cash_flow"] == "11250.00"

    # Verify daily_spending has only expenses (Nov 1: 1500, Nov 3: 250)
    assert len(summary["daily_spending"]) == 2
    assert summary["daily_spending"][0] == {"date": "2026-11-01", "day": 1, "amount": "1500.00"}
    assert summary["daily_spending"][1] == {"date": "2026-11-03", "day": 3, "amount": "250.00"}

    # Verify daily_income has only income (Nov 1: 10000, Nov 5: 3000)
    assert len(summary["daily_income"]) == 2
    assert summary["daily_income"][0] == {"date": "2026-11-01", "day": 1, "amount": "10000.00"}
    assert summary["daily_income"][1] == {"date": "2026-11-05", "day": 5, "amount": "3000.00"}

    # Verify category_breakdown has only expense categories
    expense_categories = {c["category"] for c in summary["category_breakdown"]}
    assert expense_categories == {"Education", "Food & dining"}

    # Verify category_income has only income categories
    income_categories = {c["category"] for c in summary["category_income"]}
    assert income_categories == {"Scholarship", "Freelance"}


def test_custom_date_range_validation(client):
    # Missing end_date
    res1 = client.get("/api/v1/dashboard/summary?start_date=2026-11-01")
    assert res1.status_code == 422
    assert "Both start_date and end_date must be provided together" in res1.json()["detail"]

    # Conflicting year/month and date range
    res2 = client.get("/api/v1/dashboard/summary?year=2026&month=11&start_date=2026-11-01&end_date=2026-11-10")
    assert res2.status_code == 422
    assert "Cannot specify both year/month and start_date/end_date" in res2.json()["detail"]

    # start_date > end_date
    res3 = client.get("/api/v1/dashboard/summary?start_date=2026-11-15&end_date=2026-11-05")
    assert res3.status_code == 422
    assert "start_date cannot be after end_date" in res3.json()["detail"]

    # Date range > 366 days
    res4 = client.get("/api/v1/dashboard/summary?start_date=2025-01-01&end_date=2026-02-01")
    assert res4.status_code == 422
    assert "Date range cannot exceed 366 days" in res4.json()["detail"]


def test_multi_month_custom_range_disables_budget(client):
    """
    Multi-month custom ranges must set budget_applicable=False and null budget fields.
    """
    client.put("/api/v1/budgets/2026/11", json={"amount": "5000.00"})

    res = client.get("/api/v1/dashboard/summary?start_date=2026-10-15&end_date=2026-11-15")
    assert res.status_code == 200
    data = res.json()
    assert data["is_custom_range"] is True
    assert data["budget_applicable"] is False
    assert data["monthly_budget"] is None
    assert data["budget_remaining"] is None
    assert data["budget_utilization"] is None


def test_today_mode_budget_semantics(client):
    """
    Safeguard 1: For Today mode, calculate budget remaining using the current
    month's cumulative expenses, not just today's expenses.
    """
    today_str = date.today().isoformat()
    # Month budget: 10000.00
    client.put(f"/api/v1/budgets/{date.today().year}/{date.today().month}", json={"amount": "10000.00"})

    # Prior expense earlier this month (day 1)
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Earlier expense",
            "amount": "2000.00",
            "kind": "expense",
            "category": "Essentials",
            "transaction_date": f"{date.today().year:04d}-{date.today().month:02d}-01",
        },
    )

    # Today's expense: 500.00
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Today's lunch",
            "amount": "500.00",
            "kind": "expense",
            "category": "Food & dining",
            "transaction_date": today_str,
        },
    )

    summary = client.get("/api/v1/dashboard/summary?today_mode=true").json()

    # Today analytics must show ONLY today's expenses
    assert summary["expenses"] == "500.00"

    # Monthly budget context must use CUMULATIVE month expenses (2000 + 500 = 2500)
    assert summary["monthly_budget"] == "10000.00"
    assert summary["budget_remaining"] == "7500.00"  # 10000 - 2500 = 7500
    assert summary["budget_utilization"] == 25.0      # 2500 / 10000 = 25%


def test_previous_period_comparison(client):
    """
    Safeguard 2: Verify previous-period comparisons.
    """
    # Transaction in previous month (October 2026)
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Oct income",
            "amount": "4000.00",
            "kind": "income",
            "category": "Allowance",
            "transaction_date": "2026-10-01",
        },
    )
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Oct expense",
            "amount": "2000.00",
            "kind": "expense",
            "category": "Food & dining",
            "transaction_date": "2026-10-02",
        },
    )

    # Current month (November 2026)
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Nov income",
            "amount": "6000.00",
            "kind": "income",
            "category": "Allowance",
            "transaction_date": "2026-11-01",
        },
    )
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Nov expense",
            "amount": "3000.00",
            "kind": "expense",
            "category": "Food & dining",
            "transaction_date": "2026-11-02",
        },
    )

    summary = client.get("/api/v1/dashboard/summary?year=2026&month=11").json()
    comp = summary["comparison"]

    assert comp["comparison_period_label"] is not None
    assert comp["previous_income"] == "4000.00"
    assert comp["previous_expenses"] == "2000.00"

    # Income changed from 4000 to 6000 -> +50.0%
    assert comp["income_delta_percent"] == 50.0
    # Expenses changed from 2000 to 3000 -> +50.0%
    assert comp["expenses_delta_percent"] == 50.0
