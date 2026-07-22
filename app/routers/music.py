import shutil

from fastapi import APIRouter, HTTPException

from app.config import MUSIC_DIR
from app.models import AlbumDetailOut, AlbumIn, AlbumOut, LyricsIn, TrackIn, TrackOut
from app.storage import read_entry, slugify, unique_dir, unique_path, write_entry

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


def _list_track_files(album_id: str):
    tracks_dir = _tracks_dir(album_id)
    if not tracks_dir.exists():
        return []
    return sorted(tracks_dir.glob("*.md"))


def _album_to_out(album_id: str, metadata: dict, content: str) -> AlbumOut:
    track_files = _list_track_files(album_id)
    track_titles = [read_entry(p)[0].get("title", "") for p in track_files]
    return AlbumOut(
        id=album_id,
        notes=content,
        track_count=len(track_files),
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


@router.get("/{album_id}", response_model=AlbumDetailOut)
def get_album(album_id: str):
    path = _album_path(album_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Album not found")
    metadata, content = read_entry(path)
    tracks = []
    for track_path in _list_track_files(album_id):
        track_metadata, _ = read_entry(track_path)
        tracks.append(_track_to_out(album_id, track_path, track_metadata))
    tracks.sort(key=lambda t: t.track_number)
    album_out = _album_to_out(album_id, metadata, content)
    return AlbumDetailOut(**album_out.model_dump(), tracks=tracks)


@router.put("/{album_id}", response_model=AlbumOut)
def update_album(album_id: str, album: AlbumIn):
    path = _album_path(album_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Album not found")
    metadata = album.model_dump(exclude={"notes"})
    write_entry(path, metadata, album.notes)
    return _album_to_out(album_id, metadata, album.notes)


@router.delete("/{album_id}")
def delete_album(album_id: str):
    album_dir = _album_dir(album_id)
    if not album_dir.exists():
        raise HTTPException(status_code=404, detail="Album not found")
    shutil.rmtree(album_dir)
    return {"ok": True}


@router.post("/{album_id}/tracks", response_model=TrackOut)
def create_track(album_id: str, track: TrackIn):
    if not _album_path(album_id).exists():
        raise HTTPException(status_code=404, detail="Album not found")
    # The track's id is a stable slug of its title, independent of track_number —
    # so reordering later just edits the number in place and never touches this
    # file (or its lyrics), meaning thoughts/lyrics can never be orphaned by a move.
    path = unique_path(_tracks_dir(album_id), slugify(track.title))
    metadata = track.model_dump()
    write_entry(path, metadata, "")
    return _track_to_out(album_id, path, metadata)


@router.put("/{album_id}/tracks/{track_id}", response_model=TrackOut)
def update_track(album_id: str, track_id: str, track: TrackIn):
    path = _track_path(album_id, track_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Track not found")
    metadata = track.model_dump()
    write_entry(path, metadata, "")
    return _track_to_out(album_id, path, metadata)


@router.delete("/{album_id}/tracks/{track_id}")
def delete_track(album_id: str, track_id: str):
    path = _track_path(album_id, track_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Track not found")
    path.unlink()
    lyrics_path = _lyrics_path(album_id, track_id)
    if lyrics_path.exists():
        lyrics_path.unlink()
    return {"ok": True}


@router.put("/{album_id}/tracks/{track_id}/lyrics")
def save_lyrics(album_id: str, track_id: str, body: LyricsIn):
    if not _track_path(album_id, track_id).exists():
        raise HTTPException(status_code=404, detail="Track not found")
    lyrics_path = _lyrics_path(album_id, track_id)
    lyrics_path.parent.mkdir(parents=True, exist_ok=True)
    lyrics_path.write_text(body.lyrics)
    return {"ok": True}
