def test_create_and_list_journal_entry(client):
    res = client.post("/api/journal", json={"title": "My Day", "date": "2026-01-01", "body": "Hello"})
    assert res.status_code == 200
    entry = res.json()
    assert entry["title"] == "My Day"
    assert entry["id"] == "2026-01-01-my-day"

    res = client.get("/api/journal")
    assert res.status_code == 200
    assert [e["id"] for e in res.json()] == ["2026-01-01-my-day"]


def test_get_update_delete_journal_entry(client):
    created = client.post(
        "/api/journal", json={"title": "My Day", "date": "2026-01-01", "body": "Hello"}
    ).json()
    entry_id = created["id"]

    res = client.get(f"/api/journal/{entry_id}")
    assert res.status_code == 200
    assert res.json()["body"] == "Hello"

    res = client.put(
        f"/api/journal/{entry_id}",
        json={"title": "My Day", "date": "2026-01-01", "body": "Updated"},
    )
    assert res.status_code == 200
    assert res.json()["body"] == "Updated"

    res = client.delete(f"/api/journal/{entry_id}")
    assert res.status_code == 200

    assert client.get(f"/api/journal/{entry_id}").status_code == 404
    assert client.get("/api/journal").json() == []


def test_tags_roundtrip(client):
    created = client.post(
        "/api/journal",
        json={"title": "Tagged", "date": "2026-01-01", "body": "Hello", "tags": ["music", "travel"]},
    ).json()
    assert created["tags"] == ["music", "travel"]

    fetched = client.get(f"/api/journal/{created['id']}").json()
    assert fetched["tags"] == ["music", "travel"]

    listed = client.get("/api/journal").json()
    assert listed[0]["tags"] == ["music", "travel"]


def test_get_nonexistent_entry_404s(client):
    res = client.get("/api/journal/does-not-exist")
    assert res.status_code == 404


def test_list_sorts_by_date_descending(client):
    client.post("/api/journal", json={"title": "Older", "date": "2026-01-01", "body": ""})
    client.post("/api/journal", json={"title": "Newer", "date": "2026-06-01", "body": ""})

    titles = [e["title"] for e in client.get("/api/journal").json()]

    assert titles == ["Newer", "Older"]
