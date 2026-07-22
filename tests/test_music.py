def _create_album(client, **overrides):
    payload = {"title": "Static Meadow", "artist": "Test Artist"}
    payload.update(overrides)
    return client.post("/api/music", json=payload).json()


def _create_track(client, album_id, **overrides):
    payload = {"track_number": 1, "title": "Opening Track"}
    payload.update(overrides)
    return client.post(f"/api/music/{album_id}/tracks", json=payload).json()


def test_create_album_and_get_detail(client):
    album = _create_album(client)
    assert album["id"] == "static-meadow-test-artist"

    res = client.get(f"/api/music/{album['id']}")
    assert res.status_code == 200
    assert res.json()["tracks"] == []


def test_add_track_appears_in_album_detail(client):
    album = _create_album(client)

    track = _create_track(client, album["id"])
    assert track["id"] == "opening-track"
    assert track["lyrics"] == ""

    detail = client.get(f"/api/music/{album['id']}").json()
    assert len(detail["tracks"]) == 1
    assert detail["tracks"][0]["title"] == "Opening Track"

    listed = client.get("/api/music").json()
    assert listed[0]["track_count"] == 1


def test_lyrics_save_and_fetch_via_track_detail(client):
    album = _create_album(client)
    track = _create_track(client, album["id"])

    res = client.put(f"/api/music/{album['id']}/tracks/{track['id']}/lyrics", json={"lyrics": "Line one\nLine two"})
    assert res.status_code == 200

    detail = client.get(f"/api/music/{album['id']}").json()
    assert detail["tracks"][0]["lyrics"] == "Line one\nLine two"


def test_track_thoughts_roundtrip(client):
    album = _create_album(client)
    track = _create_track(client, album["id"])

    res = client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={
            "track_number": 1,
            "title": "Opening Track",
            "thoughts": [{"date": "2026-07-21", "text": "Great opener."}],
        },
    )

    assert res.json()["thoughts"] == [{"date": "2026-07-21", "text": "Great opener."}]


def test_reordering_track_keeps_same_id_lyrics_and_thoughts(client):
    """Renumbering (drag-to-reorder) must never orphan a track's lyrics/thoughts —
    the id is a stable title slug, track_number is just a sortable field on it."""
    album = _create_album(client)
    track = _create_track(client, album["id"], track_number=1, title="Opening Track")
    client.put(f"/api/music/{album['id']}/tracks/{track['id']}/lyrics", json={"lyrics": "Some lyrics"})
    client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 1, "title": "Opening Track", "thoughts": [{"date": "2026-07-21", "text": "Nice."}]},
    )

    # Move it from position 1 to position 3 — same id, same file.
    res = client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 3, "title": "Opening Track", "thoughts": [{"date": "2026-07-21", "text": "Nice."}]},
    )
    assert res.status_code == 200
    assert res.json()["id"] == track["id"]
    assert res.json()["track_number"] == 3

    detail = client.get(f"/api/music/{album['id']}").json()
    assert len(detail["tracks"]) == 1
    moved = detail["tracks"][0]
    assert moved["id"] == track["id"]
    assert moved["lyrics"] == "Some lyrics"
    assert moved["thoughts"] == [{"date": "2026-07-21", "text": "Nice."}]


def test_delete_track_also_removes_lyrics_file(client):
    album = _create_album(client)
    track = _create_track(client, album["id"])
    client.put(f"/api/music/{album['id']}/tracks/{track['id']}/lyrics", json={"lyrics": "Some lyrics"})

    res = client.delete(f"/api/music/{album['id']}/tracks/{track['id']}")
    assert res.status_code == 200

    detail = client.get(f"/api/music/{album['id']}").json()
    assert detail["tracks"] == []


def test_delete_album_removes_it(client):
    album = _create_album(client)
    res = client.delete(f"/api/music/{album['id']}")
    assert res.status_code == 200
    assert client.get("/api/music").json() == []
