# Song View — design spec

Date: 2026-07-30
Status: approved, moving to implementation

## Problem

Albums currently only surface as whole units. The user wants a dedicated view over
individual songs across all albums — for songs they remember even when they don't
remember the whole album, and to make searching by song easier. Songs need their own
tags (independent of album-level tags), and need to be individually starrable into
this view. No new freestanding track type — a song in Song View must already exist
inside an album/EP/single (that's what `live_covers` is for).

## Data model

`app/models.py` — `TrackIn`/`TrackOut` gain two fields:

- `starred: bool = False` — song view membership.
- `tags: list[str] = []` — per-song tags, independent of the album's own `tags`.

Existing `favorite`/`favorite_order` (home-page favourites lane) are unchanged in
meaning, but gain an invariant: `favorite=True` implies `starred=True`. The home lane
is a strictly narrower set than song view membership.

- Enforced in the router on write, not via a pydantic validator (the two fields can
  arrive independently from different UI actions — e.g. a client toggling `favorite`
  without knowing about `starred`).
- One-time backfill on rollout: any existing track with `favorite=True` gets
  `starred=True` set, so pre-existing data satisfies the invariant.

## Backend API

- `GET /api/music/tracks` (`list_all_tracks`, `app/routers/music.py`) is unchanged —
  it already returns every track flattened with album context. Song View consumes it
  directly (filtering client-side to `starred`), rather than `home.js`'s current
  `.filter(t => t.favorite)`.
- No new search/filter endpoint — client-side filtering (same as the existing
  `createCollectionView` pattern used for albums/books/movies) is fine at this scale.
  Revisit only if the track count grows large enough to make full-list fetch slow.
- `PUT /{album_id}/tracks/{track_id}` starts accepting/returning `starred` and `tags`.
  Every call site that builds a full-track payload (`trackToPayload` in `music.js`,
  and any future one in `song-view.js`) must include both fields — omitting a field
  silently resets it to default, a trap this codebase has been bitten by before
  (see the comment at `music.js:87-93`).

## Frontend

**Navigation**: Music becomes a 3-way sub-tab, matching how Live & Covers already
works: **Albums / Song View / Live & Covers**.

**Shared track-detail component**: The track editor body currently built inline
inside `buildTrackElement` (`frontend/scripts/music.js`) — title, alt title, link,
duration, credits, lyrics, thoughts, tags editor, star/favorite toggles — is
extracted into a shared builder used in two contexts:

- **Album view**: unchanged — nested inline as an expandable row under its album,
  album context implicit.
- **Song view**: the *same* component, opened via this app's existing
  browse-to-detail pane pattern (`detail.css`, already used by albums/books/movies),
  with one addition: a "Part of: *Album Title*" link back to that album's own detail
  page, since album context isn't implicit in a flattened cross-album list.

No separate "lightweight" song detail UI — Song View reuses the real editor, it's
just reached from a different browse list.

**Album view addition**: `buildTrackElement`'s row gains a star toggle button
(next to the existing pencil/edit icon), since today `starred`/`favorite` can only be
set via the Music page's sidebar favourites-panel search — there's no per-row toggle
yet.

**Song View browse UI**: built with the existing `createCollectionView` factory
(`frontend/scripts/shelf.js`), the same one albums/books/movies already use — search
box, OR-gated tag filter, sort, grid/list toggle all come for free. `coverAspect:
"square"`, matching album covers.

**Add a song from Song View**: a search box over the same all-tracks list
(title/artist/album); clicking a result sets `starred=true` on the existing track.
Never creates a new track record.

**Pagination**: added to `createCollectionView` as a new opt-in parameter, used only
by Song View for now (it's the one browse view whose count scales with the *entire*
library rather than one album/movie/book at a time). Albums/books/movies keep
rendering full lists. Filtering/tag-filtering happens first; pagination applies to
whatever's left after that.

## Explicitly deferred (not part of this feature)

- **AND-gated tag filtering** — current tag filters (journal, and now Song View) are
  OR-only. The user flagged this as the real itch behind considering playlists, but
  asked to defer it rather than bundle it here. Worth raising again once Song View
  ships, as a possible full alternative to playlists.
- **Playlists** — user is leaning against these in favor of tags; not built.
- **Pagination for albums/movies/books** — not requested; Song View is the only page
  getting it in this pass.

## Testing

Per this repo's CLAUDE.md, `app/storage.py`-adjacent logic (new fields flowing
through markdown frontmatter read/write, the backfill migration) is the one place a
silent bug could lose or corrupt real diary content — build this test-first.
