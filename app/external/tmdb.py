import os

import httpx
from fastapi import HTTPException

BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


def _credential() -> str:
    key = os.getenv("TMDB_API_KEY", "")
    if not key:
        raise HTTPException(
            status_code=501,
            detail="TMDB_API_KEY is not set in .env — add one from themoviedb.org to enable search/autofill.",
        )
    return key


async def _get(path: str, params: dict) -> dict:
    credential = _credential()
    # TMDb issues two different credential types from the same settings page:
    # a v4 "API Read Access Token" (a JWT, used as a Bearer header) and an
    # older v3 "API Key" (a plain string, used as an api_key query param).
    # Accept whichever one was pasted into .env rather than requiring a specific one.
    headers = {}
    if credential.count(".") == 2:
        headers["Authorization"] = f"Bearer {credential}"
    else:
        params = {**params, "api_key": credential}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{BASE_URL}{path}", params=params, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def search_movies(query: str) -> list[dict]:
    data = await _get("/search/movie", {"query": query})
    results = []
    for r in data.get("results", []):
        results.append(
            {
                "tmdb_id": r.get("id"),
                "title": r.get("title", ""),
                "year": (r.get("release_date") or "")[:4],
                "poster": IMAGE_BASE + r["poster_path"] if r.get("poster_path") else "",
                "overview": r.get("overview", ""),
            }
        )
    return results


async def search_tv(query: str) -> list[dict]:
    data = await _get("/search/tv", {"query": query})
    results = []
    for r in data.get("results", []):
        results.append(
            {
                "tmdb_id": r.get("id"),
                "title": r.get("name", ""),
                "year": (r.get("first_air_date") or "")[:4],
                "poster": IMAGE_BASE + r["poster_path"] if r.get("poster_path") else "",
                "overview": r.get("overview", ""),
            }
        )
    return results


async def get_tv_show(tmdb_id: int) -> dict:
    data = await _get(f"/tv/{tmdb_id}", {})
    return {
        "tmdb_id": data.get("id"),
        "title": data.get("name", ""),
        "poster": IMAGE_BASE + data["poster_path"] if data.get("poster_path") else "",
        "overview": data.get("overview", ""),
        "seasons": [
            {"season_number": s["season_number"], "episode_count": s["episode_count"]}
            for s in data.get("seasons", [])
            if s["season_number"] > 0
        ],
    }


async def get_season_episodes(tmdb_id: int, season_number: int) -> list[dict]:
    data = await _get(f"/tv/{tmdb_id}/season/{season_number}", {})
    episodes = []
    for ep in data.get("episodes", []):
        episodes.append(
            {
                "episode_number": ep.get("episode_number"),
                "name": ep.get("name", ""),
                "air_date": ep.get("air_date", ""),
                "still": IMAGE_BASE + ep["still_path"] if ep.get("still_path") else "",
                "overview": ep.get("overview", ""),
            }
        )
    return episodes
