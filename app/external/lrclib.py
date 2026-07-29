import httpx

BASE_URL = "https://lrclib.net/api"


async def get_lyrics(artist: str, track: str, album: str = "") -> str:
    """A first-pass lyrics fetch — LRCLIB is a free, open, crowd-sourced
    lyrics database (unlike Genius/Musixmatch, it doesn't restrict full-text
    redistribution). Coverage is inconsistent, especially outside
    K-pop/J-pop, so this is meant to give the user a starting point to
    correct by hand, not a guaranteed-accurate result. Uses the fuzzy
    /search endpoint (not /get) since exact-duration matching is too
    fragile — returns "" if nothing matched, never raises for a miss."""
    params = {"track_name": track, "artist_name": artist}
    if album:
        params["album_name"] = album

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{BASE_URL}/search", params=params)
        resp.raise_for_status()
        results = resp.json()

    if not results:
        return ""
    return results[0].get("plainLyrics") or ""
