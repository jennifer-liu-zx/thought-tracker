from app.storage import read_entry, write_entry
from scripts.backfill_starred import backfill_starred


def _write_track(tracks_dir, slug, **metadata):
    tracks_dir.mkdir(parents=True, exist_ok=True)
    write_entry(tracks_dir / f"{slug}.md", {"track_number": 1, "title": slug, **metadata}, "")


def test_backfill_stars_favorited_tracks_that_are_not_yet_starred(tmp_path):
    music_dir = tmp_path / "music"
    _write_track(music_dir / "album-one" / "tracks", "song-a", favorite=True, starred=False)
    _write_track(music_dir / "album-one" / "tracks", "song-b", favorite=False, starred=False)

    updated = backfill_starred(music_dir)

    assert updated == 1
    metadata_a, _ = read_entry(music_dir / "album-one" / "tracks" / "song-a.md")
    assert metadata_a["starred"] is True
    metadata_b, _ = read_entry(music_dir / "album-one" / "tracks" / "song-b.md")
    assert metadata_b["starred"] is False


def test_backfill_is_idempotent(tmp_path):
    music_dir = tmp_path / "music"
    _write_track(music_dir / "album-one" / "tracks", "song-a", favorite=True, starred=True)

    updated = backfill_starred(music_dir)

    assert updated == 0


def test_backfill_on_missing_music_dir_returns_zero(tmp_path):
    assert backfill_starred(tmp_path / "does-not-exist") == 0
