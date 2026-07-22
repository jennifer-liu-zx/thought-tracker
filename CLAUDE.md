# Personal Diary App

A local-only personal diary with four sections: **movies & TV**, **books**, **songs**, **journal**.
Single user (just Jennifer), runs on localhost only, no auth, no internet exposure.

## Stack & why

- **Backend:** Python 3.11+, FastAPI, Uvicorn. Chosen because the app is local-only and the
  interesting logic (parsing/writing markdown files, calling external APIs, rebuilding the
  index) is backend logic, not UI logic — Python keeps that simple and matches prior project
  experience in this workspace.
- **Frontend:** plain HTML/CSS/JS, no build step, no framework. The only "fancy" UI is a CSS
  3D perspective shelf (angled book/album spines) for movies, books, and albums — that's
  achievable with `transform: perspective() rotateY()` and doesn't need React or Three.js.
  Journal entries get a plain chronological list/timeline instead (no natural "spine").
- **Storage:** Markdown files with YAML frontmatter are the **source of truth** for every
  entry. SQLite (`data/index.sqlite3`) is a *derived, rebuildable cache* used only for fast
  listing/search/sort — never authoritative. If it ever gets out of sync or corrupted, delete
  it and re-run `scripts/reindex.py`; nothing is lost because the real content lives in
  `data/**/*.md`.
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
    db.py                    # SQLite index: connect, query, rebuild-from-files
    storage.py                # generic markdown+frontmatter read/write helpers
    routers/
      movies.py
      tv.py
      books.py
      music.py
      journal.py
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
    journal/
      2026/
        2026-07-21-<slug>.md    # frontmatter: title, date; body is the entry
    index.sqlite3               # generated, gitignored — rebuild with scripts/reindex.py
  media/
    posters/                   # movie/TV posters (from TMDb or user upload)
    covers/                    # book covers, album covers (mostly user-uploaded)
  frontend/
    index.html
    styles/
      base.css
      shelf.css                # the CSS 3D angled-spine shelf look
    scripts/
      app.js                   # routing between the 4 sections
      shelf.js                 # shared shelf rendering (movies/books/albums)
      movies.js
      tv.js
      books.js
      music.js
      journal.js
  scripts/
    reindex.py                 # rebuild data/index.sqlite3 by walking data/**/*.md
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
python scripts/reindex.py   # rebuild the SQLite cache from data/**/*.md if needed
```

## Conventions for future work in this repo

- Never treat `index.sqlite3` as authoritative — always write to the markdown files first,
  then update the index (or just trigger a reindex).
- Keep the frontend framework-free. If a section's interactivity outgrows plain JS, raise it
  before adding a framework rather than introducing one quietly.
- New content types (if added later) should follow the same `frontmatter + thoughts[]` shape
  for consistency.

## Recommended skills for this repo

- **`run`** — use to launch the FastAPI dev server and click through a feature in the browser
  after building it, rather than just eyeballing the code.
- **`prototype`** — use before committing to the CSS shelf implementation, to quickly check
  whether the angled-spine look and expandable-episode interaction actually feel right before
  wiring them into the real data.
- **`tdd`** — worth using specifically for `app/storage.py` and `scripts/reindex.py` (the
  markdown-parsing and reindexing logic). That's the one part of this app where a silent bug
  could lose or corrupt journal/thoughts content, so it's worth testing deliberately even
  though the rest of the app is low-stakes.
- **`dataviz`** — not needed now, but worth remembering if a "stats" view gets added later
  (books read per year, movies per month, etc.) — it has palette/chart guidance ready to go.
