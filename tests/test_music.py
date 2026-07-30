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


def test_favoriting_a_track_also_stars_it(client):
    album = _create_album(client)
    track = _create_track(client, album["id"])

    res = client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 1, "title": "Opening Track", "favorite": True},
    )
    assert res.status_code == 200
    assert res.json()["favorite"] is True
    assert res.json()["starred"] is True


def test_starring_a_track_without_favoriting_it(client):
    album = _create_album(client)
    track = _create_track(client, album["id"])

    res = client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 1, "title": "Opening Track", "starred": True},
    )
    assert res.status_code == 200
    assert res.json()["starred"] is True
    assert res.json()["favorite"] is False


def test_unstarring_a_track_also_unfavorites_it(client):
    """The real unstar flow (both star-toggle handlers in music.js) always
    sends starred=False and favorite=False together in one payload — there's
    no ambiguity for the server to resolve here, since both fields already
    agree by the time the request is sent."""
    album = _create_album(client)
    track = _create_track(client, album["id"])
    client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 1, "title": "Opening Track", "favorite": True},
    )

    res = client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 1, "title": "Opening Track", "starred": False, "favorite": False},
    )
    assert res.status_code == 200
    assert res.json()["starred"] is False
    assert res.json()["favorite"] is False


def test_contradictory_payload_resolves_by_promoting_starred(client):
    """Deliberate, documented tie-break: TrackIn can't distinguish "starred
    omitted, defaulted False" from "starred explicitly False" on the wire,
    so a self-contradictory payload (starred=False, favorite=True) — which
    the app's own client never actually sends — resolves by promoting
    starred rather than demoting favorite. This is the same input shape
    test_favoriting_a_track_also_stars_it relies on; the two cannot be told
    apart, so this test exists to make the choice explicit rather than
    accidental."""
    album = _create_album(client)
    track = _create_track(client, album["id"])

    res = client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 1, "title": "Opening Track", "starred": False, "favorite": True},
    )
    assert res.status_code == 200
    assert res.json()["starred"] is True
    assert res.json()["favorite"] is True


def test_track_tags_roundtrip(client):
    album = _create_album(client)
    track = _create_track(client, album["id"])

    res = client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 1, "title": "Opening Track", "tags": ["wistful", "upbeat"]},
    )
    assert res.status_code == 200
    assert res.json()["tags"] == ["wistful", "upbeat"]

    detail = client.get(f"/api/music/{album['id']}").json()
    assert detail["tracks"][0]["tags"] == ["wistful", "upbeat"]


def test_list_all_tracks_includes_starred_and_tags(client):
    album = _create_album(client)
    _create_track(client, album["id"], track_number=1, title="Song A")
    track_b = _create_track(client, album["id"], track_number=2, title="Song B")
    client.put(
        f"/api/music/{album['id']}/tracks/{track_b['id']}",
        json={"track_number": 2, "title": "Song B", "starred": True, "tags": ["sad"]},
    )

    all_tracks = client.get("/api/music/tracks").json()
    by_title = {t["title"]: t for t in all_tracks}
    assert by_title["Song A"]["starred"] is False
    assert by_title["Song B"]["starred"] is True
    assert by_title["Song B"]["tags"] == ["sad"]


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
