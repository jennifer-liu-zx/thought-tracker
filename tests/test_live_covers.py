def _create_entry(client, **overrides):
    payload = {"title": "Someone Like You (Live at Wembley)", "artist": "Adele"}
    payload.update(overrides)
    return client.post("/api/live-covers", json=payload).json()


def test_create_and_list_live_cover(client):
    created = _create_entry(client)
    assert created["id"] == "someone-like-you-live-at-wembley-adele"

    entries = client.get("/api/live-covers").json()
    assert [e["id"] for e in entries] == [created["id"]]


def test_update_roundtrip(client):
    entry = _create_entry(client)

    res = client.put(
        f"/api/live-covers/{entry['id']}",
        json={
            "title": "Someone Like You (Live at Wembley)",
            "artist": "Adele",
            "original_artist": "Adele",
            "tags": ["ballad"],
            "thoughts": [{"date": "2026-01-01", "text": "Stunning live vocal."}],
        },
    )

    body = res.json()
    assert body["original_artist"] == "Adele"
    assert body["tags"] == ["ballad"]
    assert body["thoughts"] == [{"date": "2026-01-01", "text": "Stunning live vocal."}]


def test_delete_live_cover(client):
    entry = _create_entry(client)
    res = client.delete(f"/api/live-covers/{entry['id']}")
    assert res.status_code == 200
    assert client.get("/api/live-covers").json() == []
