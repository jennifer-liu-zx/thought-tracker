from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_DIR, MEDIA_DIR
from app.routers import books, calendar, journal, movies, music, tv

app = FastAPI(title="Diary")

app.include_router(journal.router)
app.include_router(books.router)
app.include_router(movies.router)
app.include_router(tv.router)
app.include_router(music.router)
app.include_router(calendar.router)


@app.middleware("http")
async def no_cache_frontend_assets(request, call_next):
    response = await call_next(request)
    # This is a local app under active development — always revalidate CSS/JS/HTML
    # rather than risk the browser silently running a stale cached script.
    if request.url.path in ("/", "") or request.url.path.startswith(("/styles/", "/scripts/")):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response


app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
