def _create_movie(client, **overrides):
    payload = {"title": "Dune", "year": "2021"}
    payload.update(overrides)
    return client.post("/api/movies", json=payload).json()


def test_create_and_list_movie(client):
    created = _create_movie(client)
    assert created["id"] == "dune-2021"

    movies = client.get("/api/movies").json()
    assert [m["id"] for m in movies] == ["dune-2021"]


def test_watch_dates_and_thoughts_roundtrip(client):
    movie = _create_movie(client)

    res = client.put(
        f"/api/movies/{movie['id']}",
        json={
            "title": "Dune",
            "watch_dates": [
                {"date": "2026-01-10", "cinema": True},
                {"date": "2026-01-11", "cinema": False},
            ],
            "thoughts": [{"date": "2026-01-11", "text": "Great sound design."}],
        },
    )

    body = res.json()
    assert body["watch_dates"] == [
        {"date": "2026-01-10", "cinema": True},
        {"date": "2026-01-11", "cinema": False},
    ]
    assert body["thoughts"] == [{"date": "2026-01-11", "text": "Great sound design."}]


def test_search_without_api_key_returns_clear_error(client, monkeypatch):
    # Force the "no key configured" path regardless of the developer's real .env,
    # so this test never depends on network access or local secrets.
    monkeypatch.delenv("TMDB_API_KEY", raising=False)

    res = client.get("/api/movies/search", params={"q": "dune"})

    assert res.status_code == 501
    assert "TMDB_API_KEY" in res.json()["detail"]


def test_delete_movie(client):
    movie = _create_movie(client)
    res = client.delete(f"/api/movies/{movie['id']}")
    assert res.status_code == 200
    assert client.get("/api/movies").json() == []
