from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
MEDIA_DIR = ROOT_DIR / "media"
FRONTEND_DIR = ROOT_DIR / "frontend"

JOURNAL_DIR = DATA_DIR / "journal"
MOVIES_DIR = DATA_DIR / "movies"
TV_DIR = DATA_DIR / "tv"
BOOKS_DIR = DATA_DIR / "books"
MUSIC_DIR = DATA_DIR / "music"
LIVE_COVERS_DIR = DATA_DIR / "live_covers"

load_dotenv(ROOT_DIR / ".env")
