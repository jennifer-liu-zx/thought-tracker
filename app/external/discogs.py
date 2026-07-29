import os

import httpx
from fastapi import HTTPException

BASE_URL = "https://api.discogs.com"
_HEADERS = {"User-Agent": "MyThoughtsDiary/1.0 (personal local-only diary app)"}

# Discogs' free-text per-credit "role" field gets bucketed into this app's
# writers/composers/producers/featuring fields by simple keyword matching —
# Discogs has no fixed taxonomy here, contributors type roles by hand.
_ROLE_BUCKETS = {
    "writers": ("written-by", "lyrics by", "words by"),
    "composers": ("composed by", "music by"),
    "producers": ("producer", "produced by"),
    "featuring": ("featuring", "vocals"),
}


def _credential() -> str:
    token = os.getenv("DISCOGS_TOKEN", "")
    if not token:
        raise HTTPException(
            status_code=501,
            detail="DISCOGS_TOKEN is not set in .env — add a personal access token from discogs.com/settings/developers.",
        )
    return token


async def _get(path: str, params: dict) -> dict:
    token = _credential()
    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        resp = await client.get(f"{BASE_URL}{path}", params={**params, "token": token})
        resp.raise_for_status()
        return resp.json()


async def search_releases(query: str) -> list[dict]:
    data = await _get("/database/search", {"q": query, "type": "release", "per_page": 25})
    results = []
    for r in data.get("results", []):
        # Discogs combines "Artist - Title" into one search-result field —
        # split on the first " - " (album titles occasionally contain their
        # own hyphens further in, so only the first split point is safe).
        raw_title = r.get("title", "")
        artist, _, title = raw_title.partition(" - ")
        if not title:
            artist, title = "", raw_title

        results.append(
            {
                "discogs_id": str(r.get("id", "")),
                "title": title.strip(),
                "artist": artist.strip(),
                "release_date": str(r.get("year", "") or ""),
                "country": r.get("country", "") or "",
                "cover": r.get("cover_image", "") or "",
                "tags": [*(r.get("genre") or []), *(r.get("style") or [])],
            }
        )
    return results


def _bucket_extra_artists(extra_artists: list[dict]) -> dict[str, str]:
    buckets: dict[str, list[str]] = {"writers": [], "composers": [], "producers": [], "featuring": []}
    for credit in extra_artists:
        role = (credit.get("role") or "").lower()
        name = credit.get("name", "")
        if not name:
            continue
        for field, keywords in _ROLE_BUCKETS.items():
            if any(kw in role for kw in keywords):
                buckets[field].append(name)
                break
    return {field: ", ".join(names) for field, names in buckets.items()}


async def get_tracklist(discogs_id: str) -> list[dict]:
    data = await _get(f"/releases/{discogs_id}", {})
    tracks = []
    for i, t in enumerate(data.get("tracklist", [])):
        if t.get("type_", "track") != "track":
            continue  # Discogs tracklists can include headings/index entries, not real tracks
        credits = _bucket_extra_artists(t.get("extraartists", []))
        tracks.append(
            {
                "title": t.get("title", ""),
                "track_number": i + 1,
                "duration": t.get("duration", ""),
                **credits,
            }
        )
    return tracks
