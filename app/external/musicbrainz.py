import asyncio
import time

import httpx

BASE_URL = "https://musicbrainz.org/ws/2"
COVER_ART_BASE = "https://coverartarchive.org"

# MusicBrainz's usage policy requires a descriptive User-Agent identifying the
# application — unlike TMDb/Discogs it doesn't issue API keys, this is the
# only credential it asks for. No .env entry needed.
_HEADERS = {"User-Agent": "MyThoughtsDiary/1.0 (personal local-only diary app)"}

# release-group primary/secondary "type" combinations map onto this app's
# release_type field. Secondary types (Live, Compilation, Remix, etc.) take
# priority when present since they're more specific than the primary type.
_RELEASE_TYPE_MAP = {"Album": "album", "EP": "ep", "Single": "single"}

# MusicBrainz enforces a strict ~1 request/second budget and returns 503s
# once exceeded. A single "Import tracklist" click already makes 2-3 calls
# in a row (release-group lookup, then a release lookup for the tracklist),
# and picking a search result adds 2 more before that — enough to trip the
# limit on its own, which is what was showing up as "sometimes fails, retry
# eventually works." Self-throttling here removes the need for the user to
# retry by hand.
_MIN_INTERVAL = 1.05
_last_request_at = 0.0
_rate_limit_lock = asyncio.Lock()


def _release_type_from(primary: str | None, secondary: list[str]) -> str:
    for s in secondary:
        if s in ("Live", "Compilation"):
            return s.lower()
    return _RELEASE_TYPE_MAP.get(primary or "", "album")


def _cover_url(mbid: str) -> str:
    # A release-group-level shortcut — redirects to the front image of
    # whichever release MusicBrainz considers canonical. Avoids a second
    # lookup just to find a release id. 404s quietly if no art was ever
    # uploaded; the frontend just shows the "no cover" placeholder then.
    return f"{COVER_ART_BASE}/release-group/{mbid}/front-500"


def _pick_best_release(releases: list[dict], group_title: str = "") -> dict | None:
    """A release-group frequently has several releases under it — regional
    editions, reissues, deluxe/bonus-track versions, and sometimes an
    entirely differently-titled compilation MusicBrainz contributors linked
    into the same group — with no guaranteed order from the API. Blindly
    taking the first one risks landing on a bonus-track reissue padded with
    unidentified "[unknown]" tracks (confirmed on real data: a same-group
    release titled differently from the album itself, dated *earlier* than
    the real releases, padded with 5 "[unknown]" bonus tracks). Prefer a
    release whose own title matches the release-group's title — that's what
    actually distinguished the real editions from the stray compilation in
    that case, date order didn't — then fall back to official status and
    earliest date as tiebreakers."""
    if not releases:
        return None
    candidates = releases
    if group_title:
        title_matches = [r for r in candidates if r.get("title") == group_title]
        candidates = title_matches or candidates
    official = [r for r in candidates if r.get("status") == "Official"]
    candidates = official or candidates
    return sorted(candidates, key=lambda r: r.get("date") or "9999")[0]


async def _get(path: str, params: dict) -> dict:
    global _last_request_at
    async with _rate_limit_lock:
        wait = _MIN_INTERVAL - (time.monotonic() - _last_request_at)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_request_at = time.monotonic()

    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        for attempt in range(3):
            resp = await client.get(f"{BASE_URL}{path}", params={**params, "fmt": "json"})
            if resp.status_code != 503:
                resp.raise_for_status()
                return resp.json()
            if attempt < 2:
                await asyncio.sleep(_MIN_INTERVAL * (attempt + 1))
        resp.raise_for_status()  # exhausted retries — surface the last 503 as an error
        return resp.json()


async def search_releases(query: str) -> list[dict]:
    """Lightweight search over release-groups (the canonical "album" concept,
    independent of any one specific pressing/edition)."""
    data = await _get("/release-group/", {"query": query, "limit": 25})
    results = []
    for rg in data.get("release-groups", []):
        artist = " & ".join(a["name"] for a in rg.get("artist-credit", []) if isinstance(a, dict) and a.get("name"))
        results.append(
            {
                "mbid": rg.get("id", ""),
                "title": rg.get("title", ""),
                "artist": artist,
                "release_date": rg.get("first-release-date", ""),
                "release_type": _release_type_from(rg.get("primary-type"), rg.get("secondary-types", [])),
                "cover": _cover_url(rg["id"]) if rg.get("id") else "",
            }
        )
    return results


async def get_release_group_detail(mbid: str) -> dict:
    """Fills in the fields a lightweight search can't give: country (a
    per-release attribute, not per-release-group) and an English alias to
    suggest as the alternative title, plus community tags as genre/style
    candidates. Two follow-up lookups, only made once — when the user picks
    a specific search result, not per keystroke."""
    rg_data = await _get(f"/release-group/{mbid}", {"inc": "aliases+tags+releases"})

    english_title = ""
    for alias in rg_data.get("aliases", []):
        if alias.get("locale") == "en" and alias.get("name"):
            english_title = alias["name"]
            if alias.get("primary"):
                break  # a "primary" English alias is the best possible match, stop looking

    tags = [t["name"] for t in rg_data.get("tags", []) if t.get("name")]

    country = ""
    best_release = _pick_best_release(rg_data.get("releases", []), rg_data.get("title", ""))
    if best_release:
        release_detail = await _get(f"/release/{best_release['id']}", {})
        country = release_detail.get("country") or ""

    return {"english_title": english_title, "tags": tags, "country": country}


def _tracks_from_release(release_data: dict) -> list[dict]:
    tracks = []
    for medium in release_data.get("media", []):
        for t in medium.get("tracks", []):
            length_ms = t.get("length") or (t.get("recording") or {}).get("length")
            duration = ""
            if length_ms:
                total_seconds = int(length_ms) // 1000
                duration = f"{total_seconds // 60}:{total_seconds % 60:02d}"
            tracks.append(
                {
                    "title": t.get("title", ""),
                    "track_number": int(t.get("position") or len(tracks) + 1),
                    "duration": duration,
                }
            )
    return tracks


async def get_tracklist(mbid: str) -> list[dict]:
    """Track listing for this release-group. MusicBrainz's writer/composer
    credit data is inconsistent across releases (depends on volunteer-entered
    "work" relationships), so this deliberately only returns what MusicBrainz
    is reliably good at — title, position, duration — leaving credits for
    manual entry or a Discogs import instead.

    Title/status narrows candidates down (see _pick_best_release), but date
    alone isn't a reliable enough tiebreaker between same-titled official
    releases — confirmed on real data where the earlier-dated one was
    actually missing 2 tracks compared to a later-dated one. When more than
    one candidate survives the narrowing, fetch each (bounded to 3, so a
    messy release-group doesn't cost unbounded requests) and keep whichever
    has the most tracks, on the theory that the fullest tracklist is the
    most likely to be the complete/canonical one."""
    rg_data = await _get(f"/release-group/{mbid}", {"inc": "releases"})
    releases = rg_data.get("releases", [])
    group_title = rg_data.get("title", "")

    candidates = releases
    if group_title:
        title_matches = [r for r in candidates if r.get("title") == group_title]
        candidates = title_matches or candidates
    official = [r for r in candidates if r.get("status") == "Official"]
    candidates = official or candidates
    candidates = sorted(candidates, key=lambda r: r.get("date") or "9999")[:3]

    if not candidates:
        return []

    best_tracks: list[dict] = []
    for release in candidates:
        release_data = await _get(f"/release/{release['id']}", {"inc": "recordings"})
        tracks = _tracks_from_release(release_data)
        if len(tracks) > len(best_tracks):
            best_tracks = tracks
    return best_tracks
