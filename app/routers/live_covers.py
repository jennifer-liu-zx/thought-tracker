from fastapi import APIRouter

from app.config import LIVE_COVERS_DIR
from app.models import LiveCoverIn, LiveCoverOut
from app.storage import list_entries, read_entry, require_exists, slugify, unique_path, write_entry

router = APIRouter(prefix="/api/live-covers", tags=["live-covers"])


def _path_for_id(entry_id: str):
    return LIVE_COVERS_DIR / f"{entry_id}.md"


def _to_out(path, metadata: dict, content: str) -> LiveCoverOut:
    return LiveCoverOut(id=path.stem, notes=content, **{k: v for k, v in metadata.items() if k != "notes"})


@router.get("", response_model=list[LiveCoverOut])
def list_live_covers():
    entries = [_to_out(path, metadata, content) for path, metadata, content in list_entries(LIVE_COVERS_DIR)]
    entries.sort(key=lambda e: e.title.lower())
    return entries


@router.post("", response_model=LiveCoverOut)
def create_live_cover(entry: LiveCoverIn):
    base_slug = slugify(f"{entry.title}-{entry.artist}" if entry.artist else entry.title)
    path = unique_path(LIVE_COVERS_DIR, base_slug)
    metadata = entry.model_dump(exclude={"notes"})
    write_entry(path, metadata, entry.notes)
    return _to_out(path, metadata, entry.notes)


@router.get("/{entry_id}", response_model=LiveCoverOut)
def get_live_cover(entry_id: str):
    path = require_exists(_path_for_id(entry_id), "Entry not found")
    metadata, content = read_entry(path)
    return _to_out(path, metadata, content)


@router.put("/{entry_id}", response_model=LiveCoverOut)
def update_live_cover(entry_id: str, entry: LiveCoverIn):
    path = require_exists(_path_for_id(entry_id), "Entry not found")
    metadata = entry.model_dump(exclude={"notes"})
    write_entry(path, metadata, entry.notes)
    return _to_out(path, metadata, entry.notes)


@router.delete("/{entry_id}")
def delete_live_cover(entry_id: str):
    path = require_exists(_path_for_id(entry_id), "Entry not found")
    path.unlink()
    return {"ok": True}
