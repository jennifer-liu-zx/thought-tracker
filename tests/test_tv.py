def _create_show(client, **overrides):
    payload = {"title": "The Bear", "year": "2022"}
    payload.update(overrides)
    return client.post("/api/tv", json=payload).json()


def test_create_show_and_get_detail(client):
    show = _create_show(client)
    assert show["id"] == "the-bear-2022"
    assert show["episode_count"] == 0

    res = client.get(f"/api/tv/{show['id']}")
    assert res.status_code == 200
    assert res.json()["episodes"] == []


def test_add_episode_appears_in_show_detail(client):
    show = _create_show(client)

    res = client.put(
        f"/api/tv/{show['id']}/episodes/s01e01",
        json={"season": 1, "episode": 1, "name": "System", "air_date": "2022-06-23"},
    )
    assert res.status_code == 200

    detail = client.get(f"/api/tv/{show['id']}").json()
    assert len(detail["episodes"]) == 1
    assert detail["episodes"][0]["name"] == "System"

    listed = client.get("/api/tv").json()
    assert listed[0]["episode_count"] == 1


def test_episode_watch_dates_and_thoughts_roundtrip(client):
    show = _create_show(client)
    client.put(
        f"/api/tv/{show['id']}/episodes/s01e01",
        json={"season": 1, "episode": 1, "name": "System"},
    )

    res = client.put(
        f"/api/tv/{show['id']}/episodes/s01e01",
        json={
            "season": 1,
            "episode": 1,
            "name": "System",
            "watch_dates": ["2022-06-24"],
            "thoughts": [{"date": "2022-06-24", "text": "Intense pilot."}],
        },
    )

    assert res.json()["watch_dates"] == ["2022-06-24"]
    assert res.json()["thoughts"] == [{"date": "2022-06-24", "text": "Intense pilot."}]


def test_delete_episode(client):
    show = _create_show(client)
    client.put(f"/api/tv/{show['id']}/episodes/s01e01", json={"season": 1, "episode": 1, "name": "System"})

    res = client.delete(f"/api/tv/{show['id']}/episodes/s01e01")
    assert res.status_code == 200

    detail = client.get(f"/api/tv/{show['id']}").json()
    assert detail["episodes"] == []


def test_import_season_without_tmdb_id_errors_clearly(client):
    show = _create_show(client)  # created with no tmdb_id

    res = client.post(f"/api/tv/{show['id']}/import-season", params={"season_number": 1})

    assert res.status_code == 400
    assert "tmdb_id" in res.json()["detail"]


def test_reorder_episodes_swaps_numbers_and_keeps_thoughts(client):
    show = _create_show(client)
    client.put(
        f"/api/tv/{show['id']}/episodes/s01e01",
        json={"season": 1, "episode": 1, "name": "First", "thoughts": [{"date": "2022-06-24", "text": "one"}]},
    )
    client.put(f"/api/tv/{show['id']}/episodes/s01e02", json={"season": 1, "episode": 2, "name": "Second"})

    res = client.put(f"/api/tv/{show['id']}/seasons/1/reorder", json=["s01e02", "s01e01"])
    assert res.status_code == 200
    reordered = res.json()
    assert [(e["episode"], e["name"]) for e in reordered] == [(1, "Second"), (2, "First")]

    detail = client.get(f"/api/tv/{show['id']}").json()
    first_ep = next(e for e in detail["episodes"] if e["name"] == "First")
    assert first_ep["episode"] == 2
    assert first_ep["thoughts"] == [{"date": "2022-06-24", "text": "one"}]

    # Old filenames are gone — only the renumbered ones remain.
    ids = {e["id"] for e in detail["episodes"]}
    assert ids == {"s01e01", "s01e02"}


def test_delete_show_removes_it_and_its_episodes(client):
    show = _create_show(client)
    client.put(f"/api/tv/{show['id']}/episodes/s01e01", json={"season": 1, "episode": 1, "name": "System"})

    res = client.delete(f"/api/tv/{show['id']}")
    assert res.status_code == 200
    assert client.get("/api/tv").json() == []
