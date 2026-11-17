def test_csv_export_endpoint_and_headers(client):
    client.post(
        "/api/v1/transactions",
        json={
            "title": "Grocery run",
            "amount": "450.50",
            "kind": "expense",
            "category": "Essentials",
            "transaction_date": "2026-11-05",
            "note": "Weekly milk and vegetables",
        },
    )

    response = client.get("/api/v1/transactions/export?all_time=true")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment; filename=" in response.headers["content-disposition"]

    content = response.text
    lines = content.strip().split("\r\n")
    assert lines[0] == "Date,Type,Title,Category,Amount,Note"
    assert '2026-11-05,expense,"Grocery run","Essentials",450.50,"Weekly milk and vegetables"' in lines[1]


def test_csv_export_formula_injection_sanitization(client):
    """
    Safeguard 4: Strengthen CSV formula-injection sanitization to handle leading
    whitespace and newline characters.
    """
    dangerous_inputs = [
        ("=1+1", "Formula with equal"),
        ("  +cmd|' /C calc'!A0", "Leading spaces with plus"),
        ("\t-2+3", "Leading tab with minus"),
        ("\n@SUM(1,2)", "Leading newline with at"),
    ]

    for title, note in dangerous_inputs:
        client.post(
            "/api/v1/transactions",
            json={
                "title": title,
                "amount": "100.00",
                "kind": "expense",
                "category": "SecurityTest",
                "transaction_date": "2026-11-10",
                "note": note,
            },
        )

    response = client.get("/api/v1/transactions/export?all_time=true")
    assert response.status_code == 200
    content = response.text

    # All dangerous cells must start with single quote inside quotes
    assert '"\'=1+1"' in content
    assert '"\'  +cmd|\' /C calc\'!A0"' in content
    assert '"\'\t-2+3"' in content
    assert '"\'\n@SUM(1,2)"' in content


def test_csv_export_validation_conflicts(client):
    # all_time with date filter must fail
    res1 = client.get("/api/v1/transactions/export?all_time=true&start_date=2026-11-01")
    assert res1.status_code == 422
    assert "Cannot specify date filters when all_time is True" in res1.json()["detail"]

    # Incomplete date filter must fail
    res2 = client.get("/api/v1/transactions/export?start_date=2026-11-01")
    assert res2.status_code == 422
    assert "Both start_date and end_date must be provided together" in res2.json()["detail"]

    # start_date > end_date must fail
    res3 = client.get("/api/v1/transactions/export?start_date=2026-11-10&end_date=2026-11-01")
    assert res3.status_code == 422
    assert "start_date must be on or before end_date" in res3.json()["detail"]
