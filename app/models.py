from pydantic import BaseModel, field_validator, model_validator


class Thought(BaseModel):
    date: str
    text: str


class JournalEntryIn(BaseModel):
    title: str
    date: str  # ISO 8601, YYYY-MM-DD
    body: str = ""
    tags: list[str] = []


class JournalEntryOut(BaseModel):
    id: str  # filename stem, e.g. 2026-07-21-first-entry
    title: str
    date: str
    body: str
    tags: list[str] = []


class ReadDate(BaseModel):
    date: str
    format: str = "physical"  # physical | ebook | audiobook — the format read on this date


class WatchDate(BaseModel):
    date: str
    cinema: bool = False  # watched in a cinema/theater, as opposed to at home


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
    rating: float | None = None  # 0.5-5, in 0.5 steps
    favorite: bool = False
    favorite_order: int | None = None  # manual drag-reorder position in the home page favourites lane
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
    cast: list[str] = []
    crew: list[str] = []
    rating: float | None = None  # 0.5-5, in 0.5 steps
    favorite: bool = False
    favorite_order: int | None = None  # manual drag-reorder position in the home page favourites lane
    watch_dates: list[WatchDate] = []
    thoughts: list[Thought] = []
    notes: str = ""

    @field_validator("watch_dates", mode="before")
    @classmethod
    def _migrate_plain_date_strings(cls, value):
        # Old markdown files (and older API payloads) store watch_dates as a
        # plain list of ISO date strings, from before the cinema flag existed.
        if not value:
            return value
        return [{"date": item, "cinema": False} if isinstance(item, str) else item for item in value]


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
    cast: list[str] = []
    crew: list[str] = []
    favorite: bool = False
    favorite_order: int | None = None  # manual drag-reorder position in the home page favourites lane
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
    release_date: str = ""  # ISO date if known in full, else just a year or year-month
    country: str = ""
    cover: str = ""
    tags: list[str] = []
    favorite: bool = False
    favorite_order: int | None = None  # manual drag-reorder position in the home page favourites lane
    release_type: str = "album"  # album | ep | single
    thoughts: list[Thought] = []
    notes: str = ""
    # Not shown in the UI — kept so "Import tracks" can re-fetch the full
    # tracklist later without asking the user to search again.
    mbid: str = ""
    discogs_id: str = ""

    @model_validator(mode="before")
    @classmethod
    def _migrate_year_to_release_date(cls, data):
        # Existing albums (from before release_date existed) store a bare
        # `year` field — carry it over so they don't silently lose that
        # value the next time the album is saved.
        if isinstance(data, dict) and not data.get("release_date") and data.get("year"):
            data = {**data, "release_date": data["year"]}
        return data


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
    duration: str = ""  # display string, e.g. "3:45"
    writers: str = ""  # lyricist(s)
    composers: str = ""  # music composer(s), distinct from lyricist(s)
    producers: str = ""
    featuring: str = ""
    label: str = ""
    favorite: bool = False
    favorite_order: int | None = None  # manual drag-reorder position in the home page favourites lane
    thoughts: list[Thought] = []


class TrackOut(TrackIn):
    id: str
    lyrics: str = ""


class TrackWithAlbumOut(TrackOut):
    """A track flattened with its parent album's context — used by the Albums
    favourites panel, which favourites individual songs rather than albums."""

    album_id: str
    album_title: str
    album_cover: str = ""
    album_artist: str = ""


class AlbumDetailOut(AlbumOut):
    tracks: list[TrackOut] = []


class LyricsIn(BaseModel):
    lyrics: str


class LiveCoverIn(BaseModel):
    """A standalone track that isn't part of a formal studio album — a live
    performance, cover, or adaptation of a song. Kept separate from Album so
    these don't need to be shoehorned into an album's track list."""

    title: str
    english_title: str = ""
    show_english_title: bool = False
    artist: str = ""  # who performed this version
    original_artist: str = ""  # who wrote/originally performed it, if a cover
    year: str = ""
    cover: str = ""
    link: str = ""  # URL to the recording/video
    tags: list[str] = []
    favorite: bool = False
    favorite_order: int | None = None  # manual drag-reorder position in the home page favourites lane
    thoughts: list[Thought] = []
    notes: str = ""


class LiveCoverOut(LiveCoverIn):
    id: str
