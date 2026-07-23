from fastapi import APIRouter

from app.config import JOURNAL_DIR
from app.models import JournalEntryIn, JournalEntryOut
from app.storage import list_entries, read_entry, require_exists, slugify, unique_path, write_entry

router = APIRouter(prefix="/api/journal", tags=["journal"])


def _path_for_id(entry_id: str):
    year = entry_id[:4]
    return JOURNAL_DIR / year / f"{entry_id}.md"


@router.get("", response_model=list[JournalEntryOut])
def list_journal_entries():
    entries = []
    for path, metadata, content in list_entries(JOURNAL_DIR):
        entries.append(
            JournalEntryOut(
                id=path.stem,
                title=metadata.get("title", ""),
                date=metadata.get("date", ""),
                body=content,
                tags=metadata.get("tags", []),
            )
        )
    entries.sort(key=lambda e: e.date, reverse=True)
    return entries


@router.post("", response_model=JournalEntryOut)
def create_journal_entry(entry: JournalEntryIn):
    year = entry.date[:4]
    base_slug = f"{entry.date}-{slugify(entry.title)}"
    path = unique_path(JOURNAL_DIR / year, base_slug)
    write_entry(path, {"title": entry.title, "date": entry.date, "tags": entry.tags}, entry.body)
    return JournalEntryOut(id=path.stem, title=entry.title, date=entry.date, body=entry.body, tags=entry.tags)


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_journal_entry(entry_id: str):
    path = require_exists(_path_for_id(entry_id), "Journal entry not found")
    metadata, content = read_entry(path)
    return JournalEntryOut(
        id=path.stem,
        title=metadata.get("title", ""),
        date=metadata.get("date", ""),
        body=content,
        tags=metadata.get("tags", []),
    )


@router.put("/{entry_id}", response_model=JournalEntryOut)
def update_journal_entry(entry_id: str, entry: JournalEntryIn):
    path = require_exists(_path_for_id(entry_id), "Journal entry not found")
    write_entry(path, {"title": entry.title, "date": entry.date, "tags": entry.tags}, entry.body)
    return JournalEntryOut(id=path.stem, title=entry.title, date=entry.date, body=entry.body, tags=entry.tags)


@router.delete("/{entry_id}")
def delete_journal_entry(entry_id: str):
    path = require_exists(_path_for_id(entry_id), "Journal entry not found")
    path.unlink()
    return {"ok": True}
