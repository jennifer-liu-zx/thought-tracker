# Personal Diary App

A local-only personal diary — site title "My Thoughts." — with sections **movies & TV**,
**books**, **music** (albums, plus a separate Live & Covers sub-tab for standalone live
performances/covers/adaptations), and **journal** (nav label "Random"), aggregated on a **home**
page with per-section swimlanes, a favourites panel, and a today-card that opens a full
month-grid calendar of thought counts. Single user (just Jennifer), runs on localhost only, no
auth, no internet exposure.

## Stack & why

- **Backend:** Python 3.11+, FastAPI, Uvicorn. Chosen because the app is local-only and the
  interesting logic (parsing/writing markdown files, calling external APIs, aggregating
  thoughts for the calendar) is backend logic, not UI logic — Python keeps that simple and
  matches prior project experience in this workspace.
- **Frontend:** plain HTML/CSS/JS, no build step, no framework. The only "fancy" UI is a CSS
  3D perspective shelf (angled book/album spines) for movies, books, and albums — that's
  achievable with `transform: perspective() rotateY()` and doesn't need React or Three.js.
  Journal entries get a plain chronological list/timeline instead (no natural "spine").
- **Storage:** Markdown files with YAML frontmatter are the **only** store — every router reads
  `data/**/*.md` directly on each request (see `app/storage.py`'s `list_entries`). There is no
  SQLite cache/index layer; at personal scale, scanning the files directly on every request is
  fast enough, and it removes an entire class of "index out of sync with the files" bugs.
- **Why markdown+frontmatter over a DB-only design:** readable/editable in any text editor,
  trivially exportable (they're just files), diffable in git, and matches the requirement that
  written content isn't locked inside the app.

## Repo structure

```
diary/
  CLAUDE.md
  requirements.txt
  .env                       # TMDB_API_KEY etc — gitignored, never commit
  run.sh                     # starts uvicorn for local dev
  app/
    main.py                  # FastAPI app; mounts routers + serves frontend/
    config.py                # paths, .env loading
    storage.py                # generic markdown+frontmatter read/write helpers
    routers/
      movies.py
      tv.py
      books.py
      music.py
      live_covers.py           # standalone live-performance/cover/adaptation tracks
      journal.py
      calendar.py              # thought-count aggregation for the home page calendar
    external/
      tmdb.py                 # TMDb client (movies + TV + episodes)
      openlibrary.py          # Open Library client (books), Google Books as fallback
    models.py                 # pydantic schemas shared by routers
  data/                       # <-- the actual diary content, source of truth, backed up/exported directly
    movies/
      <slug>.md                # frontmatter: title, tmdb_id, poster, watch_dates: [], thoughts: [{date, text}]
    tv/
      <show-slug>/
        show.md                 # show-level metadata (tmdb id, poster, status)
        episodes/
          s01e01.md              # per-episode thoughts, same thoughts[] shape
    books/
      <slug>.md                 # frontmatter: title, author, isbn, cover, publisher, pages,
                                 # genre, series, format, status, read_dates: [], thoughts: []
    music/
      <album-slug>/
        album.md                # album-level metadata + thoughts
        tracks/
          <track-slug>.md        # per-track thoughts, references lyrics file
        lyrics/
          <track-slug>.txt       # user-uploaded lyrics, plain text
    live_covers/
      <slug>.md                 # standalone track: title, artist, original_artist, link,
                                 # tags: [], thoughts: [] — not tied to any album
    journal/
      2026/
        2026-07-21-<slug>.md    # frontmatter: title, date; body is the entry
  media/
    posters/                   # movie/TV posters (from TMDb or user upload)
    covers/                    # book covers, album covers (mostly user-uploaded)
  frontend/
    index.html
    styles/
      base.css
      shelf.css                # shared browse-grid/list + favourites-panel styling
      detail.css               # shared "browse <-> detail" pane pattern
      home.css                 # home page swimlanes
      calendar.css             # today-card + month-grid modal (structural rules)
      099supply.css            # site-wide visual theme — overrides all of the above;
                                # see DESIGN.md for the underlying system
    scripts/
      app.js                   # routing between the 5 top-level sections
      shelf.js                 # shared factories: collection view, favourites panel, star
                                # rating, thoughts/notes/chip-list editors, smooth <details>
      movies.js
      tv.js
      books.js
      music.js                 # albums + tracks
      live-covers.js           # standalone live-performance/cover tracks (Music sub-tab)
      journal.js
      calendar.js              # home page today-card + month-grid modal
      home.js                  # home page swimlanes + drag-to-reorder favourites
```

## Data model conventions

- **Slugs**: lowercase, hyphenated, derived from title + year where useful (e.g.
  `dune-2021.md`, `the-bear/`) — keeps filenames stable and human-readable.
- **Dates**: always ISO 8601 (`YYYY-MM-DD`) in frontmatter.
- **Multiple dates/thoughts**: `watch_dates` / `read_dates` are a plain list of ISO dates.
  `thoughts` is a list of `{date, text}` objects — this is the shared shape used across
  movies, TV episodes, books, and albums/tracks so the frontend can render "thoughts over
  time" the same way everywhere.
- **External IDs**: always store the source API's ID (`tmdb_id`, `openlibrary_id`) alongside
  fetched metadata, so re-fetching or refreshing cached data later is possible without
  re-searching.
- **Images**: filenames only in frontmatter (e.g. `cover: covers/dune-2021.jpg`), actual files
  live under `media/`. User-uploaded covers always take priority over API-fetched ones if both
  exist.

## External APIs (calls happen server-side in `app/external/`, never from frontend JS)

- **Movies/TV** — TMDb (`themoviedb.org/documentation/api`). Free key, has full per-episode
  data (needed for the expandable TV section: episode titles, air dates, stills).
- **Books** — Open Library (no key needed) primary, Google Books API as fallback for missing
  covers/descriptions.
- **Music** — no API for lyrics is legally usable for bulk personal archiving (Genius/Musixmatch
  both restrict full lyric text). Lyrics are always user-uploaded `.txt` files under
  `data/music/<album>/lyrics/`. Album/track metadata and covers are user-entered/uploaded too,
  per Jennifer's preference — no external music API is wired up initially.

## Running locally

```
./run.sh          # starts uvicorn, serves frontend/ + API on localhost:8000
```

## Conventions for future work in this repo

- Keep the frontend framework-free. If a section's interactivity outgrows plain JS, raise it
  before adding a framework rather than introducing one quietly.
- New content types (if added later) should follow the same `frontmatter + thoughts[]` shape
  for consistency, and should be added to `app/routers/calendar.py`'s `_iter_thought_sources()`
  so their thoughts show up in the home page calendar.
- The 099 Supply visual system (`frontend/styles/099supply.css`, spec in
  `DESIGN.md`) applies site-wide — new UI should extend it rather than
  introducing a different look.

## Recommended skills for this repo

- **`run`** — use to launch the FastAPI dev server and click through a feature in the browser
  after building it, rather than just eyeballing the code.
- **`prototype`** — use before committing to the CSS shelf implementation, to quickly check
  whether the angled-spine look and expandable-episode interaction actually feel right before
  wiring them into the real data.
- **`tdd`** — worth using specifically for `app/storage.py` (the markdown-parsing/writing
  logic). That's the one part of this app where a silent bug could lose or corrupt
  journal/thoughts content, so it's worth testing deliberately even though the rest of the app
  is low-stakes.
- **`dataviz`** — not needed now, but worth remembering if a "stats" view gets added later
  (books read per year, movies per month, etc.) — it has palette/chart guidance ready to go.
