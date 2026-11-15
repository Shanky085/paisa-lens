def test_budget_upsert_and_dashboard_summary(client):
    created = client.post(
        "/api/v1/transactions",
        json={
            "title": "Allowance",
            "amount": "5000.00",
            "kind": "income",
            "category": "Allowance",
            "transaction_date": "2026-11-01",
        },
    )
    assert created.status_code == 201

    expense = client.post(
        "/api/v1/transactions",
        json={
            "title": "Books",
            "amount": "1200.00",
            "kind": "expense",
            "category": "Education",
            "transaction_date": "2026-11-02",
        },
    )
    assert expense.status_code == 201

    budget = client.put("/api/v1/budgets/2026/11", json={"amount": "4000.00"})
    assert budget.status_code == 200
    assert budget.json()["amount"] == "4000.00"

    summary = client.get("/api/v1/dashboard/summary?year=2026&month=11")
    assert summary.status_code == 200
    data = summary.json()
    assert data["income"] == "5000.00"
    assert data["expenses"] == "1200.00"
    assert data["net_cash_flow"] == "3800.00"
    assert data["budget_remaining"] == "2800.00"
    assert data["budget_utilization"] == 30.0
    assert data["daily_spending"] == [
        {"date": "2026-11-02", "day": 2, "amount": "1200.00"}
    ]


def test_budget_rejects_invalid_month(client):
    response = client.put("/api/v1/budgets/2026/13", json={"amount": "1000"})
    assert response.status_code == 422
