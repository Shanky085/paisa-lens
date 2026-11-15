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
