import pytest
from fastapi.testclient import TestClient

import app.config as config
import app.routers.books as books_router
import app.routers.calendar as calendar_router
import app.routers.journal as journal_router
import app.routers.movies as movies_router
import app.routers.music as music_router
import app.routers.tv as tv_router
from app.main import app as fastapi_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A TestClient wired to a throwaway data directory, so tests never touch the real data/ folder."""
    dirs = {
        "JOURNAL_DIR": tmp_path / "journal",
        "BOOKS_DIR": tmp_path / "books",
        "MOVIES_DIR": tmp_path / "movies",
        "TV_DIR": tmp_path / "tv",
        "MUSIC_DIR": tmp_path / "music",
    }
    for name, path in dirs.items():
        monkeypatch.setattr(config, name, path)

    # Each router imported its *_DIR constant directly, so config-level patches
    # above don't propagate — patch the routers' own module-level references too.
    monkeypatch.setattr(journal_router, "JOURNAL_DIR", dirs["JOURNAL_DIR"])
    monkeypatch.setattr(books_router, "BOOKS_DIR", dirs["BOOKS_DIR"])
    monkeypatch.setattr(movies_router, "MOVIES_DIR", dirs["MOVIES_DIR"])
    monkeypatch.setattr(tv_router, "TV_DIR", dirs["TV_DIR"])
    monkeypatch.setattr(music_router, "MUSIC_DIR", dirs["MUSIC_DIR"])
    monkeypatch.setattr(calendar_router, "JOURNAL_DIR", dirs["JOURNAL_DIR"])
    monkeypatch.setattr(calendar_router, "BOOKS_DIR", dirs["BOOKS_DIR"])
    monkeypatch.setattr(calendar_router, "MOVIES_DIR", dirs["MOVIES_DIR"])
    monkeypatch.setattr(calendar_router, "TV_DIR", dirs["TV_DIR"])
    monkeypatch.setattr(calendar_router, "MUSIC_DIR", dirs["MUSIC_DIR"])

    return TestClient(fastapi_app)
