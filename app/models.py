from pydantic import BaseModel


class Thought(BaseModel):
    date: str
    text: str


class JournalEntryIn(BaseModel):
    title: str
    date: str  # ISO 8601, YYYY-MM-DD
    body: str = ""


class JournalEntryOut(BaseModel):
    id: str  # filename stem, e.g. 2026-07-21-first-entry
    title: str
    date: str
    body: str


class ReadDate(BaseModel):
    date: str
    format: str = "physical"  # physical | ebook | audiobook — the format read on this date


class BookIn(BaseModel):
    title: str
    english_title: str = ""
    show_english_title: bool = False  # if set, browse views show english_title instead of title
    author: str = ""
    isbn: str = ""
    cover: str = ""
    publisher: str = ""
    publish_date: str = ""
    pages: int | None = None
    genre: str = ""
    series: str = ""
    format: str = "physical"  # primary/default format, prefilled when adding a new read date
    status: str = "want_to_read"  # want_to_read | reading | finished | dnf
    openlibrary_id: str = ""
    tags: list[str] = []
    rating: int | None = None  # 1-5
    favorite: bool = False
    read_dates: list[ReadDate] = []
    thoughts: list[Thought] = []
    notes: str = ""


class BookOut(BookIn):
    id: str


class MovieIn(BaseModel):
    title: str
    english_title: str = ""
    show_english_title: bool = False
    year: str = ""
    tmdb_id: int | None = None
    poster: str = ""
    tags: list[str] = []
    rating: int | None = None  # 1-5
    favorite: bool = False
    watch_dates: list[str] = []
    thoughts: list[Thought] = []
    notes: str = ""


class MovieOut(MovieIn):
    id: str


class ShowIn(BaseModel):
    title: str
    english_title: str = ""
    show_english_title: bool = False
    year: str = ""
    tmdb_id: int | None = None
    poster: str = ""
    tags: list[str] = []
    favorite: bool = False
    thoughts: list[Thought] = []
    notes: str = ""


class ShowOut(ShowIn):
    id: str
    episode_count: int = 0


class EpisodeIn(BaseModel):
    season: int
    episode: int
    name: str = ""
    air_date: str = ""
    watch_dates: list[str] = []
    thoughts: list[Thought] = []


class EpisodeOut(EpisodeIn):
    id: str


class ShowDetailOut(ShowOut):
    episodes: list[EpisodeOut] = []


class AlbumIn(BaseModel):
    title: str
    english_title: str = ""
    show_english_title: bool = False
    artist: str = ""
    year: str = ""
    cover: str = ""
    tags: list[str] = []
    favorite: bool = False
    release_type: str = "album"  # album | ep | single
    thoughts: list[Thought] = []
    notes: str = ""


class AlbumOut(AlbumIn):
    id: str
    track_count: int = 0
    track_titles: list[str] = []  # search only — lets "music tab" search match a song, not just the album


class TrackIn(BaseModel):
    track_number: int
    title: str
    english_title: str = ""
    show_english_title: bool = False  # collapsed view shows english_title instead of title
    link: str = ""  # URL to the song/video (YouTube, Spotify, etc.)
    writers: str = ""
    producers: str = ""
    featuring: str = ""
    label: str = ""
    thoughts: list[Thought] = []


class TrackOut(TrackIn):
    id: str
    lyrics: str = ""


class AlbumDetailOut(AlbumOut):
    tracks: list[TrackOut] = []


class LyricsIn(BaseModel):
    lyrics: str
