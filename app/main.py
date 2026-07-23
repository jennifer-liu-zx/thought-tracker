from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_DIR, MEDIA_DIR
from app.routers import books, calendar, journal, live_covers, movies, music, tv

app = FastAPI(title="Diary")

app.include_router(journal.router)
app.include_router(books.router)
app.include_router(movies.router)
app.include_router(tv.router)
app.include_router(music.router)
app.include_router(live_covers.router)
app.include_router(calendar.router)


class NoCacheStaticFiles(StaticFiles):
    """This app is under active local development — always revalidate rather
    than risk the browser silently running a stale cached script/page."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response


app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
app.mount("/", NoCacheStaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
