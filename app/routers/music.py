import shutil

from fastapi import APIRouter, HTTPException

from app.config import MUSIC_DIR
from app.external import discogs, lrclib, musicbrainz
from app.models import AlbumDetailOut, AlbumIn, AlbumOut, LyricsIn, TrackIn, TrackOut, TrackWithAlbumOut
from app.storage import read_entry, require_exists, slugify, unique_dir, unique_path, write_entry

router = APIRouter(prefix="/api/music", tags=["music"])


def _album_dir(album_id: str):
    return MUSIC_DIR / album_id


def _album_path(album_id: str):
    return _album_dir(album_id) / "album.md"


def _tracks_dir(album_id: str):
    return _album_dir(album_id) / "tracks"


def _track_path(album_id: str, track_id: str):
    return _tracks_dir(album_id) / f"{track_id}.md"


def _lyrics_path(album_id: str, track_id: str):
    return _album_dir(album_id) / "lyrics" / f"{track_id}.txt"


def _normalize_track(track: TrackIn) -> TrackIn:
    """Enforce favorite ⇒ starred: the home-page favourites lane is meant to
    be a strictly narrower set than Song View membership. The two flags can
    arrive independently (e.g. favoriting from the Albums favourites panel
    doesn't know about `starred`), so this is enforced on write rather than
    trusting every caller to set both.

    Deliberately one-directional: given a self-contradictory payload
    (favorite=True, starred=False — which the app's own client never sends,
    since every star/favorite toggle resends a consistent pair), this
    always resolves toward promoting starred rather than demoting favorite.
    The wire format can't distinguish "starred omitted, defaulted false"
    from "starred explicitly cleared" (TrackIn has no way to tell), so
    trying to also cascade starred=False -> favorite=False here would
    silently break this exact promotion for that same ambiguous input —
    see 2026-07-30 code review notes."""
    if track.favorite and not track.starred:
        track.starred = True
    return track


def _list_track_files(album_id: str):
    tracks_dir = _tracks_dir(album_id)
    if not tracks_dir.exists():
        return []
    return sorted(tracks_dir.glob("*.md"))


def _album_to_out(album_id: str, metadata: dict, content: str, track_titles: list[str] | None = None) -> AlbumOut:
    if track_titles is None:
        track_titles = [read_entry(p)[0].get("title", "") for p in _list_track_files(album_id)]
    return AlbumOut(
        id=album_id,
        notes=content,
        track_count=len(track_titles),
        track_titles=track_titles,
        **{k: v for k, v in metadata.items() if k != "notes"},
    )


def _track_to_out(album_id: str, path, metadata: dict) -> TrackOut:
    lyrics_path = _lyrics_path(album_id, path.stem)
    lyrics = lyrics_path.read_text() if lyrics_path.exists() else ""
    return TrackOut(id=path.stem, lyrics=lyrics, **metadata)


@router.get("", response_model=list[AlbumOut])
def list_albums():
    albums = []
    if MUSIC_DIR.exists():
        for album_dir in sorted(MUSIC_DIR.iterdir()):
            album_path = album_dir / "album.md"
            if album_path.exists():
                metadata, content = read_entry(album_path)
                albums.append(_album_to_out(album_dir.name, metadata, content))
    albums.sort(key=lambda a: a.title.lower())
    return albums


@router.post("", response_model=AlbumOut)
def create_album(album: AlbumIn):
    base_slug = slugify(f"{album.title}-{album.artist}" if album.artist else album.title)
    album_dir = unique_dir(MUSIC_DIR, base_slug)
    album_id = album_dir.name
    metadata = album.model_dump(exclude={"notes"})
    write_entry(_album_path(album_id), metadata, album.notes)
    return _album_to_out(album_id, metadata, album.notes)


@router.get("/tracks", response_model=list[TrackWithAlbumOut])
def list_all_tracks():
    """Every track across every album, flattened with its parent album's
    context — the Albums favourites panel favourites individual songs, not
    albums, so it needs a cross-album view rather than one album at a time.
    Registered before /{album_id} so "tracks" isn't swallowed as an album id.
    """
    results = []
    if MUSIC_DIR.exists():
        for album_dir in sorted(MUSIC_DIR.iterdir()):
            album_path = album_dir / "album.md"
            if not album_path.exists():
                continue
            album_meta, _ = read_entry(album_path)
            for track_path in _list_track_files(album_dir.name):
                track_meta, _ = read_entry(track_path)
                track_out = _track_to_out(album_dir.name, track_path, track_meta)
                results.append(
                    TrackWithAlbumOut(
                        **track_out.model_dump(),
                        album_id=album_dir.name,
                        album_title=album_meta.get("title", ""),
                        album_cover=album_meta.get("cover", ""),
                        album_artist=album_meta.get("artist", ""),
                    )
                )
    return results


@router.get("/search")
async def search_metadata(q: str):
    """MusicBrainz primary, Discogs only as a fallback for what MusicBrainz
    misses — same "primary + fallback" shape as Books' Open Library +
    Google Books. If Discogs isn't configured yet (.env has no
    DISCOGS_TOKEN), that's not surfaced as an error here — MusicBrainz-only
    results are still useful, and the token can be added anytime."""
    results = await musicbrainz.search_releases(q)
    if results:
        return results
    try:
        return await discogs.search_releases(q)
    except HTTPException as e:
        if e.status_code == 501:
            return []
        raise


@router.get("/search-detail")
async def search_metadata_detail(mbid: str):
    """MusicBrainz search results are lightweight (no country, tags, or
    alternative-title candidate) — this fills those in for whichever one
    result the user actually picked, rather than doing it for all 10.
    Discogs results don't need this; its search response is already
    complete for the form."""
    return await musicbrainz.get_release_group_detail(mbid)


@router.get("/{album_id}", response_model=AlbumDetailOut)
def get_album(album_id: str):
    path = require_exists(_album_path(album_id), "Album not found")
    metadata, content = read_entry(path)
    tracks = []
    for track_path in _list_track_files(album_id):
        track_metadata, _ = read_entry(track_path)
        tracks.append(_track_to_out(album_id, track_path, track_metadata))
    tracks.sort(key=lambda t: t.track_number)
    album_out = _album_to_out(album_id, metadata, content, track_titles=[t.title for t in tracks])
    return AlbumDetailOut(**album_out.model_dump(), tracks=tracks)


@router.put("/{album_id}", response_model=AlbumOut)
def update_album(album_id: str, album: AlbumIn):
    path = require_exists(_album_path(album_id), "Album not found")
    metadata = album.model_dump(exclude={"notes"})
    write_entry(path, metadata, album.notes)
    return _album_to_out(album_id, metadata, album.notes)


@router.delete("/{album_id}")
def delete_album(album_id: str):
    album_dir = require_exists(_album_dir(album_id), "Album not found")
    shutil.rmtree(album_dir)
    return {"ok": True}


@router.post("/{album_id}/tracks", response_model=TrackOut)
def create_track(album_id: str, track: TrackIn):
    require_exists(_album_path(album_id), "Album not found")
    track = _normalize_track(track)
    # The track's id is a stable slug of its title, independent of track_number —
    # so reordering later just edits the number in place and never touches this
    # file (or its lyrics), meaning thoughts/lyrics can never be orphaned by a move.
    path = unique_path(_tracks_dir(album_id), slugify(track.title))
    metadata = track.model_dump()
    write_entry(path, metadata, "")
    return _track_to_out(album_id, path, metadata)


@router.post("/{album_id}/import-tracks", response_model=list[TrackOut])
async def import_tracks(album_id: str):
    """Fetches the full tracklist for an album that was added via search
    (mirrors tv.py's import-season). Discogs is preferred when the album has
    a discogs_id since it reliably captures writer/composer/producer
    credits, which MusicBrainz's data does not."""
    path = require_exists(_album_path(album_id), "Album not found")
    metadata, _ = read_entry(path)
    discogs_id = metadata.get("discogs_id")
    mbid = metadata.get("mbid")

    if discogs_id:
        fetched = await discogs.get_tracklist(discogs_id)
    elif mbid:
        fetched = await musicbrainz.get_tracklist(mbid)
    else:
        raise HTTPException(
            status_code=400,
            detail="This album has no mbid or discogs_id (it wasn't added via search) — add tracks manually instead.",
        )

    # Keyed by track_number rather than title, since track files are named
    # from a slug of the title and re-running this shouldn't create
    # duplicates or overwrite a track's existing thoughts/lyrics/credits.
    existing_numbers = {read_entry(p)[0].get("track_number") for p in _list_track_files(album_id)}
    for t in fetched:
        if t["track_number"] in existing_numbers:
            continue
        track_in = TrackIn(
            track_number=t["track_number"],
            title=t["title"],
            duration=t.get("duration", ""),
            writers=t.get("writers", ""),
            composers=t.get("composers", ""),
            producers=t.get("producers", ""),
            featuring=t.get("featuring", ""),
        )
        track_path = unique_path(_tracks_dir(album_id), slugify(track_in.title))
        write_entry(track_path, track_in.model_dump(), "")

    tracks = [_track_to_out(album_id, p, read_entry(p)[0]) for p in _list_track_files(album_id)]
    tracks.sort(key=lambda t: t.track_number)
    return tracks


@router.get("/{album_id}/tracks/{track_id}/fetch-lyrics")
async def fetch_lyrics(album_id: str, track_id: str):
    """A first-pass LRCLIB lookup for one track — returned for the user to
    review and correct in the lyrics textarea, not saved automatically."""
    require_exists(_track_path(album_id, track_id), "Track not found")
    album_metadata, _ = read_entry(_album_path(album_id))
    track_metadata, _ = read_entry(_track_path(album_id, track_id))
    lyrics = await lrclib.get_lyrics(
        artist=album_metadata.get("artist", ""),
        track=track_metadata.get("title", ""),
        album=album_metadata.get("title", ""),
    )
    return {"lyrics": lyrics}


@router.put("/{album_id}/tracks/{track_id}", response_model=TrackOut)
def update_track(album_id: str, track_id: str, track: TrackIn):
    path = require_exists(_track_path(album_id, track_id), "Track not found")
    track = _normalize_track(track)
    metadata = track.model_dump()
    write_entry(path, metadata, "")
    return _track_to_out(album_id, path, metadata)


@router.delete("/{album_id}/tracks/{track_id}")
def delete_track(album_id: str, track_id: str):
    path = require_exists(_track_path(album_id, track_id), "Track not found")
    path.unlink()
    lyrics_path = _lyrics_path(album_id, track_id)
    if lyrics_path.exists():
        lyrics_path.unlink()
    return {"ok": True}


@router.put("/{album_id}/tracks/{track_id}/lyrics")
def save_lyrics(album_id: str, track_id: str, body: LyricsIn):
    require_exists(_track_path(album_id, track_id), "Track not found")
    lyrics_path = _lyrics_path(album_id, track_id)
    lyrics_path.parent.mkdir(parents=True, exist_ok=True)
    lyrics_path.write_text(body.lyrics)
    return {"ok": True}
