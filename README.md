# My Thoughts.

A local-only personal diary app for tracking your thoughts on **movies & TV**,
**books**, **music** (albums, tracks, and standalone live/cover recordings), and
freeform **journal** entries — all aggregated on a home page with per-section
highlights, a favourites panel, and a calendar of how much you've written on
any given day.

Runs entirely on your own machine. No account, no login, no cloud sync, no
internet exposure — everything is stored as plain markdown files you can read,
edit, back up, or export with any text editor.

## Features

- **Movies & TV** — search TMDb to autofill posters/details, track watch
  dates, rate, tag, and write per-movie or per-episode thoughts over time.
- **Books** — search Open Library (with Google Books as a fallback) for
  covers and details, track read dates and reading status, rate and tag.
- **Music** — albums with full tracklists (credits, lyrics, per-track tags
  and thoughts), a "Song View" for browsing/starring individual tracks
  across your whole library, and a separate "Live & Covers" section for
  standalone performances or covers that don't belong to any album.
- **Random** (journal) — a plain chronological list for entries that don't
  fit anywhere else.
- **Home** — swimlanes across every section, a favourites panel you can
  drag to reorder, and a calendar showing how many thoughts you wrote each
  day.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, Uvicorn
- **Frontend:** plain HTML/CSS/JS — no framework, no build step
- **Storage:** markdown files with YAML frontmatter under `data/` — no
  database. Everything is just files on disk.

## Getting started

### 1. Clone the repo

```bash
git clone <this-repo-url>
cd thought-tracker
```

### 2. Set up Python

Requires Python 3.11+.

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

### 3. Add your API keys

```bash
cp .env.example .env
```

Then open `.env` and fill in:

- `TMDB_API_KEY` — needed for Movies & TV search/autofill (posters, episode
  lists). Free — register at https://www.themoviedb.org/settings/api
- `DISCOGS_TOKEN` — optional, only used as a fallback for music metadata
  when MusicBrainz doesn't have a match. Free — https://www.discogs.com/settings/developers

Books (Open Library) and music search (MusicBrainz) need no key. Music
lyrics and album/track art are always entered/uploaded by you — there's no
bulk lyrics API wired up, by design.

### 4. Run it

```bash
./run.sh
```

Open http://localhost:8000 in your browser. That's it — your diary starts
empty and builds up as you use it. Everything you add lives under `data/`
(entries) and `media/` (uploaded posters/covers), both already excluded
from git so your content stays private to your own machine.

## Running the tests

```bash
./.venv/bin/pytest
```
