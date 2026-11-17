from decimal import Decimal
import pytest


def test_monetary_precision_via_dashboard_endpoint(client):
    """
    Safeguard 3: Test monetary precision using the actual database aggregation
    path used by the dashboard endpoint. Verify 0.10 + 0.20 + 0.70 produces
    exactly 1.00 without floating-point drift.
    """
    cents = ["0.10", "0.20", "0.70"]
    for i, amt in enumerate(cents, start=1):
        res = client.post(
            "/api/v1/transactions",
            json={
                "title": f"Micro expense {i}",
                "amount": amt,
                "kind": "expense",
                "category": "Testing",
                "transaction_date": f"2026-11-{i:02d}",
            },
        )
        assert res.status_code == 201

    # Also add micro incomes
    incomes = ["0.05", "0.25"]
    for i, amt in enumerate(incomes, start=10):
        res = client.post(
            "/api/v1/transactions",
            json={
                "title": f"Micro income {i}",
                "amount": amt,
                "kind": "income",
                "category": "Testing",
                "transaction_date": f"2026-11-{i:02d}",
            },
        )
        assert res.status_code == 201

    summary = client.get("/api/v1/dashboard/summary?year=2026&month=11")
    assert summary.status_code == 200
    data = summary.json()

    # 0.10 + 0.20 + 0.70 = exactly 1.00
    assert data["expenses"] == "1.00"
    # 0.05 + 0.25 = exactly 0.30
    assert data["income"] == "0.30"
    # 0.30 - 1.00 = -0.70
    assert data["net_cash_flow"] == "-0.70"

    # Verify daily breakdown amounts
    day_1 = next(item for item in data["daily_spending"] if item["day"] == 1)
    day_2 = next(item for item in data["daily_spending"] if item["day"] == 2)
    assert day_1["amount"] == "0.10"
    assert day_2["amount"] == "0.20"
