"""One-off maintenance script: backfill `starred` for any existing track that
was already `favorite` before Song View introduced `starred` as a separate,
broader flag (favorite is meant to always be a subset of starred). Run once
after deploying the Song View change:

    ./.venv/bin/python -m scripts.backfill_starred
"""

from pathlib import Path

from app.config import MUSIC_DIR
from app.storage import read_entry, write_entry


def backfill_starred(music_dir: Path) -> int:
    """Sets starred=True on every track file under music_dir whose favorite
    is already True. Returns the number of track files updated."""
    updated = 0
    if not music_dir.exists():
        return updated
    for album_dir in music_dir.iterdir():
        tracks_dir = album_dir / "tracks"
        if not tracks_dir.exists():
            continue
        for track_path in tracks_dir.glob("*.md"):
            metadata, content = read_entry(track_path)
            if metadata.get("favorite") and not metadata.get("starred"):
                metadata["starred"] = True
                write_entry(track_path, metadata, content)
                updated += 1
    return updated


if __name__ == "__main__":
    count = backfill_starred(MUSIC_DIR)
    print(f"Backfilled starred=True on {count} track(s).")
