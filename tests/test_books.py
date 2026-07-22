def _create_book(client, **overrides):
    payload = {"title": "Project Hail Mary", "author": "Andy Weir"}
    payload.update(overrides)
    return client.post("/api/books", json=payload).json()


def test_create_and_get_book(client):
    created = _create_book(client)
    assert created["id"] == "project-hail-mary"

    res = client.get(f"/api/books/{created['id']}")
    assert res.status_code == 200
    assert res.json()["author"] == "Andy Weir"


def test_read_dates_track_format_per_entry(client):
    book = _create_book(client)

    res = client.put(
        f"/api/books/{book['id']}",
        json={
            "title": "Project Hail Mary",
            "read_dates": [
                {"date": "2026-01-01", "format": "physical"},
                {"date": "2026-03-15", "format": "ebook"},
            ],
        },
    )

    assert res.status_code == 200
    read_dates = res.json()["read_dates"]
    assert read_dates == [
        {"date": "2026-01-01", "format": "physical"},
        {"date": "2026-03-15", "format": "ebook"},
    ]


def test_tags_persist_and_list_returns_them(client):
    _create_book(client, tags=["sci-fi", "favorites"])

    books = client.get("/api/books").json()

    assert books[0]["tags"] == ["sci-fi", "favorites"]


def test_delete_book(client):
    book = _create_book(client)

    res = client.delete(f"/api/books/{book['id']}")
    assert res.status_code == 200
    assert client.get("/api/books").json() == []


def test_update_nonexistent_book_404s(client):
    res = client.put("/api/books/does-not-exist", json={"title": "X"})
    assert res.status_code == 404
