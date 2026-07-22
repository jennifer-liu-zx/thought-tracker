from fastapi import APIRouter, HTTPException

from app.config import MOVIES_DIR
from app.external.tmdb import search_movies
from app.models import MovieIn, MovieOut
from app.storage import list_entries, read_entry, slugify, unique_path, write_entry

router = APIRouter(prefix="/api/movies", tags=["movies"])


def _path_for_id(movie_id: str):
    return MOVIES_DIR / f"{movie_id}.md"


def _to_out(path, metadata: dict, content: str) -> MovieOut:
    return MovieOut(id=path.stem, notes=content, **{k: v for k, v in metadata.items() if k != "notes"})


@router.get("", response_model=list[MovieOut])
def list_movies():
    movies = [_to_out(path, metadata, content) for path, metadata, content in list_entries(MOVIES_DIR)]
    movies.sort(key=lambda m: m.title.lower())
    return movies


@router.get("/search")
async def search_movies_endpoint(q: str):
    return await search_movies(q)


@router.post("", response_model=MovieOut)
def create_movie(movie: MovieIn):
    base_slug = slugify(f"{movie.title}-{movie.year}" if movie.year else movie.title)
    path = unique_path(MOVIES_DIR, base_slug)
    metadata = movie.model_dump(exclude={"notes"})
    write_entry(path, metadata, movie.notes)
    return _to_out(path, metadata, movie.notes)


@router.get("/{movie_id}", response_model=MovieOut)
def get_movie(movie_id: str):
    path = _path_for_id(movie_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Movie not found")
    metadata, content = read_entry(path)
    return _to_out(path, metadata, content)


@router.put("/{movie_id}", response_model=MovieOut)
def update_movie(movie_id: str, movie: MovieIn):
    path = _path_for_id(movie_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Movie not found")
    metadata = movie.model_dump(exclude={"notes"})
    write_entry(path, metadata, movie.notes)
    return _to_out(path, metadata, movie.notes)


@router.delete("/{movie_id}")
def delete_movie(movie_id: str):
    path = _path_for_id(movie_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Movie not found")
    path.unlink()
    return {"ok": True}
