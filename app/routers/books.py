from fastapi import APIRouter, HTTPException

from app.config import BOOKS_DIR
from app.external.openlibrary import search_books
from app.models import BookIn, BookOut
from app.storage import list_entries, read_entry, slugify, unique_path, write_entry

router = APIRouter(prefix="/api/books", tags=["books"])


def _path_for_id(book_id: str):
    return BOOKS_DIR / f"{book_id}.md"


def _to_out(path, metadata: dict, content: str) -> BookOut:
    return BookOut(id=path.stem, notes=content, **{k: v for k, v in metadata.items() if k != "notes"})


@router.get("", response_model=list[BookOut])
def list_books():
    books = [_to_out(path, metadata, content) for path, metadata, content in list_entries(BOOKS_DIR)]
    books.sort(key=lambda b: b.title.lower())
    return books


@router.get("/search")
async def search_books_endpoint(q: str):
    return await search_books(q)


@router.post("", response_model=BookOut)
def create_book(book: BookIn):
    base_slug = slugify(f"{book.title}-{book.publish_date[:4]}" if book.publish_date else book.title)
    path = unique_path(BOOKS_DIR, base_slug)
    metadata = book.model_dump(exclude={"notes"})
    write_entry(path, metadata, book.notes)
    return _to_out(path, metadata, book.notes)


@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: str):
    path = _path_for_id(book_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    metadata, content = read_entry(path)
    return _to_out(path, metadata, content)


@router.put("/{book_id}", response_model=BookOut)
def update_book(book_id: str, book: BookIn):
    path = _path_for_id(book_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    metadata = book.model_dump(exclude={"notes"})
    write_entry(path, metadata, book.notes)
    return _to_out(path, metadata, book.notes)


@router.delete("/{book_id}")
def delete_book(book_id: str):
    path = _path_for_id(book_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Book not found")
    path.unlink()
    return {"ok": True}
