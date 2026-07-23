from collections import defaultdict

from fastapi import APIRouter

from app.config import BOOKS_DIR, JOURNAL_DIR, LIVE_COVERS_DIR, MOVIES_DIR, MUSIC_DIR, TV_DIR
from app.storage import read_entry

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def _iter_thought_sources():
    """Yields (category, type, ids, title, thoughts) for every thought-bearing
    record in the diary — movies, shows, episodes, books, albums, tracks."""
    if MOVIES_DIR.exists():
        for path in sorted(MOVIES_DIR.glob("*.md")):
            metadata, _ = read_entry(path)
            yield "movies_tv", "movie", {"id": path.stem}, metadata.get("title", ""), metadata.get("thoughts", [])

    if TV_DIR.exists():
        for show_dir in sorted(p for p in TV_DIR.iterdir() if p.is_dir()):
            show_path = show_dir / "show.md"
            if not show_path.exists():
                continue
            show_meta, _ = read_entry(show_path)
            show_title = show_meta.get("title", "")
            yield "movies_tv", "show", {"id": show_dir.name}, show_title, show_meta.get("thoughts", [])

            episodes_dir = show_dir / "episodes"
            if episodes_dir.exists():
                for ep_path in sorted(episodes_dir.glob("*.md")):
                    ep_meta, _ = read_entry(ep_path)
                    ep_title = f"{show_title} — {ep_path.stem.upper()}"
                    yield (
                        "movies_tv",
                        "episode",
                        {"id": show_dir.name, "episode_id": ep_path.stem},
                        ep_title,
                        ep_meta.get("thoughts", []),
                    )

    if BOOKS_DIR.exists():
        for path in sorted(BOOKS_DIR.glob("*.md")):
            metadata, _ = read_entry(path)
            yield "books", "book", {"id": path.stem}, metadata.get("title", ""), metadata.get("thoughts", [])

    if MUSIC_DIR.exists():
        for album_dir in sorted(p for p in MUSIC_DIR.iterdir() if p.is_dir()):
            album_path = album_dir / "album.md"
            if not album_path.exists():
                continue
            album_meta, _ = read_entry(album_path)
            album_title = album_meta.get("title", "")
            yield "music", "album", {"id": album_dir.name}, album_title, album_meta.get("thoughts", [])

            tracks_dir = album_dir / "tracks"
            if tracks_dir.exists():
                for track_path in sorted(tracks_dir.glob("*.md")):
                    track_meta, _ = read_entry(track_path)
                    track_title = f"{album_title} — {track_meta.get('title', '')}"
                    yield (
                        "music",
                        "track",
                        {"id": album_dir.name, "track_id": track_path.stem},
                        track_title,
                        track_meta.get("thoughts", []),
                    )

    if LIVE_COVERS_DIR.exists():
        for path in sorted(LIVE_COVERS_DIR.glob("*.md")):
            metadata, _ = read_entry(path)
            yield "music", "live_cover", {"id": path.stem}, metadata.get("title", ""), metadata.get("thoughts", [])


def _iter_journal_entries():
    if not JOURNAL_DIR.exists():
        return
    for path in sorted(JOURNAL_DIR.rglob("*.md")):
        metadata, content = read_entry(path)
        yield path.stem, metadata.get("title", ""), metadata.get("date", ""), content


@router.get("/counts")
def get_counts(year: int, month: int):
    """Thought counts per day, per category, for the given month (1 request,
    scans every file — fine at personal scale, no index needed)."""
    prefix = f"{year:04d}-{month:02d}-"
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for category, _type, _ids, _title, thoughts in _iter_thought_sources():
        for t in thoughts:
            date = t.get("date", "")
            if date.startswith(prefix):
                counts[date][category] += 1

    for _id, _title, date, _body in _iter_journal_entries():
        if date.startswith(prefix):
            counts[date]["random"] += 1

    return counts


@router.get("/day/{date}")
def get_day_detail(date: str):
    """Every specific thought recorded on this date, across all sections,
    with enough ids to jump straight to the item that owns it."""
    results = []

    for category, type_, ids, title, thoughts in _iter_thought_sources():
        for t in thoughts:
            if t.get("date") == date:
                results.append({"category": category, "type": type_, **ids, "title": title, "text": t.get("text", "")})

    for entry_id, title, entry_date, body in _iter_journal_entries():
        if entry_date == date:
            results.append({"category": "random", "type": "journal", "id": entry_id, "title": title, "text": body})

    return results
