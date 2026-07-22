def test_counts_and_day_detail_aggregate_across_sections(client):
    movie = client.post("/api/movies", json={"title": "Dune"}).json()
    client.put(
        f"/api/movies/{movie['id']}",
        json={"title": "Dune", "thoughts": [{"date": "2026-07-21", "text": "Loved the score."}]},
    )

    album = client.post("/api/music", json={"title": "Static Meadow", "artist": "Test Artist"}).json()
    client.put(
        f"/api/music/{album['id']}",
        json={
            "title": "Static Meadow",
            "artist": "Test Artist",
            "thoughts": [{"date": "2026-07-21", "text": "Great production."}],
        },
    )

    client.post("/api/journal", json={"title": "A day", "date": "2026-07-21", "body": "Random musings."})
    client.post("/api/journal", json={"title": "Another day", "date": "2026-07-21", "body": "More musings."})

    # A thought in a different month shouldn't leak into July's counts.
    client.put(
        f"/api/movies/{movie['id']}",
        json={
            "title": "Dune",
            "thoughts": [
                {"date": "2026-07-21", "text": "Loved the score."},
                {"date": "2026-08-01", "text": "Rewatched."},
            ],
        },
    )

    counts = client.get("/api/calendar/counts?year=2026&month=7").json()
    assert counts["2026-07-21"] == {"movies_tv": 1, "music": 1, "random": 2}
    assert "2026-08-01" not in counts

    day = client.get("/api/calendar/day/2026-07-21").json()
    categories = sorted(item["category"] for item in day)
    assert categories == ["movies_tv", "music", "random", "random"]

    movie_item = next(item for item in day if item["category"] == "movies_tv")
    assert movie_item["type"] == "movie"
    assert movie_item["id"] == movie["id"]
    assert movie_item["title"] == "Dune"
    assert movie_item["text"] == "Loved the score."


def test_episode_and_track_thoughts_are_categorized_correctly(client):
    show = client.post("/api/tv", json={"title": "Severance"}).json()
    client.put(f"/api/tv/{show['id']}/episodes/s01e01", json={"season": 1, "episode": 1, "name": "Good News About Hell"})
    client.put(
        f"/api/tv/{show['id']}/episodes/s01e01",
        json={
            "season": 1,
            "episode": 1,
            "name": "Good News About Hell",
            "thoughts": [{"date": "2026-07-21", "text": "Great cold open."}],
        },
    )

    album = client.post("/api/music", json={"title": "Concept Album"}).json()
    track = client.post(f"/api/music/{album['id']}/tracks", json={"track_number": 1, "title": "Opener"}).json()
    client.put(
        f"/api/music/{album['id']}/tracks/{track['id']}",
        json={"track_number": 1, "title": "Opener", "thoughts": [{"date": "2026-07-21", "text": "Strong start."}]},
    )

    day = client.get("/api/calendar/day/2026-07-21").json()
    episode_item = next(item for item in day if item["type"] == "episode")
    assert episode_item["category"] == "movies_tv"
    assert episode_item["id"] == show["id"]
    assert episode_item["episode_id"] == "s01e01"

    track_item = next(item for item in day if item["type"] == "track")
    assert track_item["category"] == "music"
    assert track_item["id"] == album["id"]
    assert track_item["track_id"] == track["id"]
