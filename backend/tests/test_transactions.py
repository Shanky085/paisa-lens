def test_create_list_update_and_delete_transaction(client):
    payload = {
        "title": "Hostel mess",
        "amount": "850.00",
        "kind": "expense",
        "category": "Food & dining",
        "transaction_date": "2026-11-10",
    }

    created = client.post("/api/v1/transactions", json=payload)
    assert created.status_code == 201
    transaction_id = created.json()["id"]
    assert created.json()["amount"] == "850.00"

    listed = client.get("/api/v1/transactions?kind=expense&category=Food%20%26%20dining")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    updated = client.patch(
        f"/api/v1/transactions/{transaction_id}",
        json={"amount": "900.00", "title": "Updated hostel mess"},
    )
    assert updated.status_code == 200
    assert updated.json()["amount"] == "900.00"
    assert updated.json()["title"] == "Updated hostel mess"

    deleted = client.delete(f"/api/v1/transactions/{transaction_id}")
    assert deleted.status_code == 204
    assert client.get("/api/v1/transactions").json() == []


def test_transaction_validation_rejects_zero_amount(client):
    response = client.post(
        "/api/v1/transactions",
        json={
            "title": "Invalid",
            "amount": "0",
            "kind": "expense",
            "category": "Other",
            "transaction_date": "2026-11-10",
        },
    )
    assert response.status_code == 422



def test_bulk_import_creates_transactions(client):
    payload = {
        "transactions": [
            {
                "title": "Hostel mess",
                "amount": "850.00",
                "kind": "expense",
                "category": "Food & dining",
                "transaction_date": "2026-11-10",
            },
            {
                "title": "Monthly allowance",
                "amount": "12000.00",
                "kind": "income",
                "category": "Allowance",
                "transaction_date": "2026-11-01",
            },
        ]
    }

    response = client.post("/api/v1/transactions/import", json=payload)

    assert response.status_code == 200
    assert response.json()["imported_count"] == 2
    assert response.json()["duplicate_count"] == 0
    assert response.json()["requires_confirmation"] is False
    assert len(client.get("/api/v1/transactions").json()) == 2


def test_bulk_import_requires_confirmation_for_possible_duplicates(client):
    transaction = {
        "title": "Hostel mess",
        "amount": "850.00",
        "kind": "expense",
        "category": "Food & dining",
        "transaction_date": "2026-11-10",
    }

    first = client.post(
        "/api/v1/transactions/import",
        json={"transactions": [transaction]},
    )
    assert first.status_code == 200
    assert first.json()["imported_count"] == 1

    second = client.post(
        "/api/v1/transactions/import",
        json={"transactions": [transaction]},
    )
    assert second.status_code == 200
    assert second.json()["imported_count"] == 0
    assert second.json()["duplicate_count"] == 1
    assert second.json()["duplicate_rows"] == [1]
    assert second.json()["requires_confirmation"] is True

    confirmed = client.post(
        "/api/v1/transactions/import",
        json={"transactions": [transaction], "allow_duplicates": True},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["imported_count"] == 1
    assert confirmed.json()["requires_confirmation"] is False


def test_bulk_import_detects_duplicates_inside_same_file(client):
    transaction = {
        "title": "Bus ticket",
        "amount": "45.00",
        "kind": "expense",
        "category": "Transport",
        "transaction_date": "2026-11-12",
    }

    response = client.post(
        "/api/v1/transactions/import",
        json={"transactions": [transaction, transaction]},
    )

    assert response.status_code == 200
    assert response.json()["imported_count"] == 0
    assert response.json()["duplicate_rows"] == [2]
    assert response.json()["requires_confirmation"] is True
    assert client.get("/api/v1/transactions").json() == []
