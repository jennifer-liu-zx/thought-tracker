# Inspiration research: features, UI patterns, and storage models for the diary app

Scope: this app is local-only, single-user, no social features. Everything below is filtered
through that lens — anything about following, sharing, feeds, or multi-user sync from the
source products was deliberately left out because it doesn't apply here.

Confidence key used throughout: **[verified]** = confirmed from an official/primary source
(docs, official blog, source repo). **[reported]** = came through search-engine summaries of a
primary source that blocked direct fetching (e.g. Letterboxd's site returns 403 to automated
fetches) — treat as probably-accurate but not independently re-checked line-by-line.
**[unclear]** = I looked for a primary source and couldn't confirm the detail; flagged so it
doesn't get treated as fact.

---

## 1. Feature ideas worth adapting

### Movies & TV (Letterboxd + Trakt)

**Diary entry ≠ "watched" flag.** Letterboxd's own data export format is the clearest evidence
of this: the exported `diary.csv` contains one row per *logged viewing* — date watched, rating,
a `Rewatch` boolean column, and a notes field — separate from `ratings.csv` (per-film rating,
independent of any specific viewing) and `reviews.csv` (written review text, also independent of
viewing date) **[reported, via Letterboxd's documented export/import format]**. In other words,
Letterboxd models three distinct things that only *look* like one "log a movie" action:

1. a movie (static identity + metadata),
2. viewing instances (dates, and whether each was a rewatch), and
3. reflections (rating/review), which can be tied to a specific viewing or just to the movie in
   general.

This maps almost exactly onto the app's existing `thoughts: [{date, text}]` shape, and confirms
it's the right shape rather than something to simplify away. **Concrete adaptation**: consider
adding a `rewatch: true/false` field to each entry in `watch_dates`/`thoughts` (or making
`watch_dates` itself a list of `{date, rewatch}` objects instead of bare date strings) so a
second viewing of the same movie doesn't need to be modeled as a hack. Right now the schema only
has a flat `watch_dates: []` — this is the one concrete gap found.

Letterboxd also explicitly separates "marking a film watched" (a bare acknowledgment) from
"logging to your diary" (a dated, detailed entry) **[reported, Letterboxd FAQ]** — worth keeping
in mind if a quick "mark as watched, fill in details later" action ever gets added, so it's clear
which one is authoritative for date-based stats.

**Year in Review / "Wrapped".** Letterboxd's annual Year in Review is generated purely from
already-logged diary data (dates, ratings, rewatches) and requires a minimum of 10 films logged
in the year before it's even offered to a user **[reported, Letterboxd Journal FAQ]**. Two
takeaways: (a) yearly stats are a pure read/aggregation over existing entries, no new data model
needed, so this is cheap to add later; (b) it's worth guarding a "your year in review" view with
a minimum-entries threshold so an early/sparse year doesn't render an embarrassing empty chart.

**Trakt's watched-status model** (checkin / scrobble / history) is more complex than this app
needs, but the underlying idea is useful: Trakt distinguishes "currently watching" (a live,
transient status) from "scrobble" (an automatic progress-based mechanism using a completion
percentage/time threshold to decide when to log something as watched, including resuming after a
pause) from "history" (the permanent list of watched plays, which can also be added to manually)
**[verified: docs.trakt.tv getting-started page confirms sync/history, scrobble, and checkin as
distinct endpoint families; exact percentage threshold for auto-completion was not independently
confirmed — commonly cited as ~80% in secondary sources but I could not verify that number against
Trakt's own docs, so treat it as unconfirmed]**. For this app, there's no live "now playing"
signal (it's a manual-entry, not scrobbling, app), so the useful takeaway is narrower: **episode-level
tracking should record enough per-episode state to answer "have I seen this episode" independent
of the show as a whole**, which the existing `tv/<show>/episodes/*.md` per-episode file structure
already supports. No schema change needed here — just confirms the existing design is on the
right track.

### Books (Goodreads + The StoryGraph)

**Reading-challenge counting logic**: Goodreads' yearly challenge counts a book toward a given
year based on its *date-finished value falling in that year*, regardless of which shelf the book
is currently on **[reported, Goodreads Help Center]**. This is a good rule to copy directly: yearly
book (or movie/album) stats should always be computed by filtering `read_dates`/`watch_dates` by
year, not by any status field, so a book finished in January but re-shelved later still counts
correctly for that year.

**StoryGraph's mood/pace tags** are a genuinely useful idea adapted for personal use: instead of
(or alongside) a single star rating, let an entry carry qualitative tags like mood
(dark/hopeful/emotional/tense...) and pace (slow/medium/fast), plus content descriptors
(plot-driven vs. character-driven) **[reported, general StoryGraph feature descriptions]**. On
StoryGraph these are partly ML-generated from aggregate community data **[reported, StoryGraph's
own product roadmap site at roadmap.thestorygraph.com, in responses to user feature requests]** —
that part obviously doesn't transfer to a single-user local app with no community data pool, but
the *tag taxonomy itself* (mood + pace, as free-form or fixed-vocabulary tags entered by the user
at finish-time) is a cheap, high-value field to add to `books/<slug>.md` frontmatter. It gives
later "what kind of books do I actually enjoy" stats for free without needing an ML layer.

**Format tracking** (physical / ebook / audiobook) is a StoryGraph/Goodreads staple worth
including in frontmatter (`format:`) since it's already implied by the CLAUDE.md schema
(`format` field is listed) — just confirming it's a well-established pattern worth keeping, not a
StoryGraph-only quirk.

### Music (Last.fm concepts + personal shelf/collection apps)

Last.fm's scrobbling rules are a nice, precise example of "when does an interaction count as a
real listen," even though this app has no scrobbling: a track only counts once it's **longer than
30 seconds** and the listener has heard **at least half its duration, or 4 minutes, whichever
comes first** **[verified, last.fm/api/scrobbling official docs]**. There's no player integration
here to reuse this directly, but the underlying idea — *a logged listen should require a minimum
bar, not just "I clicked on it"* — is worth carrying over informally: e.g. a UI nicety where
adding a "listen" to an album/track defaults to today's date and requires deliberate action, not
an accidental click, mirroring the "now playing" vs. "scrobble" distinction (transient status vs.
committed history) **[verified, same source]**.

Since there's no metadata API for music in this app, the relevant prior art is really the
self-hosted "shelf" apps rather than Last.fm: **Musivault** (self-hosted vinyl/CD tracker) and the
**Vinyl Shelf Finder** project both lean on Discogs for metadata/cover art and focus their own UI
on collection stats — format distribution, top artists, decade breakdown — and physical-location
notes (which shelf/box a record lives in) **[verified, project READMEs — see references]**. Two
transferable ideas even though this app has no Discogs integration:
- **Collection-level stats view** (albums per year acquired, most-played artist, format
  breakdown) — cheap to compute from existing frontmatter once there's more than a handful of
  albums.
- **Free-text location/context notes** (Musivault's condition/location notes) — maps to a
  simple free-text field on `album.md` if ever useful (e.g. "gift from X", "bought at Y record
  store") — matches the existing `thoughts[]` pattern, no new mechanism required.

---

## 2. UI/UX and aesthetic patterns (and what's realistic in plain HTML/CSS/JS)

| Pattern | Where it's from | Feasible without a framework? |
|---|---|---|
| Angled "shelf" grid (book spines / album covers on a tilted shelf) | Already planned in this app's CLAUDE.md via CSS `perspective()`/`rotateY()` | **Yes.** This is pure CSS 3D transforms on a `<div>` grid — no JS framework needed, and it's exactly the kind of thing CSS `transform-style: preserve-3d` was built for. The main engineering risk isn't the visual effect, it's making the *hit targets* (click-to-open) behave sanely once elements are rotated — worth prototyping (the CLAUDE.md already flags using the `prototype` skill for this, which is the right call). |
| Diary-style reverse-chronological list (Letterboxd profile/diary view) | Letterboxd | **Yes, trivially.** It's a sorted list rendered server-side or client-side from the SQLite index; no different in kind from a blog archive page. This is the natural fit for the journal section, which the CLAUDE.md already earmarks for "a plain chronological list/timeline" instead of the shelf look — that's the right call, since journal entries have no natural "spine" object to render. |
| Yearly "Wrapped"-style summary (Letterboxd Year in Review, StoryGraph annual stats) | Letterboxd + StoryGraph | **Yes, as a stats page, with caveats.** The data computation (group entries by year, count/aggregate) is simple SQL over the SQLite index. The *presentation* (big animated reveal cards, like real "Wrapped" experiences) is where effort balloons — but a single static page with a few large numbers and a simple bar/heatmap chart (e.g. "movies per month" bars, a GitHub-style contribution heatmap for journal entries) is very achievable in vanilla JS + inline SVG/canvas, no chart library required for anything this simple. Save the animated-reveal treatment for "nice to have later," not v1. |
| Mood/pace tag chips, star ratings, format badges (StoryGraph/Goodreads) | StoryGraph, Goodreads | **Yes.** These are just styled `<span>`/`<button>` elements with a small fixed vocabulary — no framework benefit here at all; arguably *easier* in vanilla HTML than in a component framework because there's no state-management overhead for what's fundamentally static styled text. |
| Episode-level expandable list (Trakt-style season/episode drill-down) | Trakt | **Yes, with plain `<details>/<summary>` or a small amount of vanilla JS toggling a class.** This is already anticipated in the CLAUDE.md ("expandable-episode interaction") and is a good fit for `<details>` elements per season, no JS required at all for the basic expand/collapse, though custom styling of the disclosure triangle needs a little CSS. |
| Collection stat breakdowns (Musivault: format/decade/top-artist charts) | Musivault | **Yes**, same reasoning as the Wrapped-style summary — it's aggregation + a few bar/pie shapes, well within inline SVG territory. |

**General takeaway**: none of the interesting visual ideas from these apps actually require a
JS framework. The place a framework would normally earn its keep — complex client-side state
that has to stay in sync across many components — doesn't really exist here, because this is a
single-user local tool where the server (FastAPI) can recompute a fresh HTML fragment or JSON
payload on every interaction instead of maintaining client-side state. That validates the
CLAUDE.md's existing framework-free decision rather than complicating it.

---

## 3. Data storage approaches

### Precedents for markdown-file-per-entry as source of truth

The closest real-world validation for "markdown + YAML frontmatter per entry, one file per
thing" comes from the **note-taking and static-site-generator world**, not from media trackers
(see below — every open-source self-hosted media tracker found uses a real database instead).

- **Obsidian** stores "Properties" as YAML frontmatter at the top of each note, and deliberately
  keeps it flat: supported types are text, list, number, checkbox, date, date-and-time, and the
  special `tags` type — **nested properties are explicitly not supported**, and the docs state
  this is intentional because "properties are meant for small, atomic bits of information," with
  free-form long-form content belonging in the note body, not the frontmatter
  **[verified, obsidian.md/help/Editing+and+formatting/Properties]**. This directly validates
  this app's approach of keeping frontmatter to scalar/list fields (title, ids, dates, tags) and
  putting long-form writing in `thoughts[].text`/body content rather than trying to cram
  narrative text into frontmatter fields.
- **Hugo**'s content model uses "page bundles": a **leaf bundle** is a folder containing an
  `index.md` plus associated resource files, which becomes one page and explicitly "can't have
  children" **[verified, gohugo.io/content-management/organization/]**. This is structurally
  identical to this app's `tv/<show>/episodes/*.md` and `music/<album>/tracks/*.md` folders — a
  folder-per-parent-entity containing child markdown files is a well-established, load-bearing
  pattern in the SSG world, not an improvised one-off. Front matter itself supports YAML, TOML,
  or JSON, with reserved top-level keys (`date`, `title`, `slug`, etc.) and a `params` namespace
  for anything custom **[verified, gohugo.io/content-management/front-matter/]** — worth
  borrowing the discipline of keeping custom/app-specific fields visually distinct from
  "reserved" ones, even informally, so future fields don't collide with anything a future tool
  might expect.
- **Jekyll** similarly treats any file with YAML frontmatter as a special document, groups
  related documents into "collections," and separately supports pure structured lookup data in a
  `_data/` directory (YAML/JSON/CSV) for things that aren't really "pages" **[verified,
  jekyllrb.com/docs/front-matter/ and /docs/collections/]**. This is a good validation for keeping
  the SQLite index as a clearly separate, clearly derived thing from the markdown "pages" — Jekyll
  makes the same page-vs-data distinction, just with a `_data/` folder instead of a database.
- **jrnl** (a well-known open-source CLI journaling tool) stores entries as plain text by
  default but explicitly supports exporting the entire journal to **one markdown file per entry**
  as a first-class export format **[verified/reported: jrnl.sh/en/stable/formats/ documents
  Markdown and YAML "export to directory, one file per entry" as supported formats]** — direct
  precedent for a personal journal being naturally modeled as one-file-per-entry, matching this
  app's `journal/YYYY/YYYY-MM-DD-slug.md` layout.

### What self-hosted media trackers actually use (and why that's not necessarily a problem)

Every self-hosted, open-source "Letterboxd/Trakt/Discogs-alike" found in this research uses a
conventional database, not flat markdown files:

- **Movary** (self-hosted movie watch-history tracker) — PHP/Twig app, Docker-deployed, uses a
  conventional SQL database (MySQL in its standard Docker Compose setup) **[verified, project
  README/GitHub]**. Notably, its own docs describe importing Letterboxd's `diary.csv` and
  `ratings.csv` as **separate, idempotent imports** — "the import only adds watch dates or ratings
  missing in Movary and it will not overwrite existing data" **[verified, docs.movary.org/features/letterboxd/]**.
  That idempotency rule is directly worth copying for this app's own `scripts/reindex.py`: a
  reindex should be safe to re-run any number of times without needing to diff against "what's
  already in the index" by hand — rebuild-from-scratch (drop and recreate the SQLite index from
  the markdown files every time) sidesteps the whole idempotency problem Movary has to solve,
  since there's no separate "already imported" state to reconcile.
- **Ryot** ("Roll your own tracker" — self-hosted books/movies/games/fitness tracker, written in
  Rust) supports SQLite, MySQL, or Postgres as its database backend, with Postgres as the default
  in its Docker Compose setup **[verified, GitHub README/ryot.io]**. Relevant point: Ryot treats
  the database as fully authoritative — there's no parallel flat-file source of truth — which is
  the opposite of this app's design. That's a reasonable choice for Ryot because it's built for
  potential multi-device/multi-service sync (GraphQL API, PWA); it's less clearly the right choice
  for a single local user who wants files they can read/edit/back up without an app.
- **Musivault** (self-hosted vinyl/CD collection tracker) uses MongoDB **[verified, GitHub
  README]** — again, fully database-backed, no flat-file layer.

**Honest takeaway**: the markdown-first architecture in this app's CLAUDE.md is *not* the
pattern used by comparable self-hosted tracking tools — it's borrowed instead from the
note-taking/SSG world (Obsidian, Hugo, Jekyll, jrnl). That's fine and arguably a good fit
*specifically because* this app is single-user, local, and explicitly wants "readable/editable
in any text editor, diffable in git, exportable as plain files" (as CLAUDE.md already states) —
those are priorities the tracker apps above don't share, since they're built as always-on
services with their own API/UI as the only intended access path. Worth being explicit about this
tradeoff rather than assuming markdown-first is simply "how these things are done" — it isn't, in
the tracker-app world; it's a deliberate divergence justified by this app's specific values
(portability, editability, git-friendliness) over the tracker apps' values (query performance,
multi-client sync, referential integrity enforced by a schema).

### SQLite-as-derived-index: validated by SQLite's own guidance

SQLite's official documentation on appropriate use cases directly supports the "SQLite as a
derived, rebuildable cache" design already chosen here: it explicitly lists **"application file
formats"** and use as an **internal/temporary database for sorting, filtering, and processing
within a program"** as core intended use cases, and frames SQLite's competition as `fopen()` — a
convenient structured-file interface — rather than a client/server RDBMS
**[verified, sqlite.org/whentouse.html]**. The one caveat worth flagging: SQLite allows only one
writer at a time; irrelevant for a genuinely single-user local app, but worth remembering if
this app is ever run with multiple browser tabs writing concurrently (e.g. two journal entries
saved at once) — the write path should still go through the markdown files as the actual
mutation, with the SQLite write following, exactly as CLAUDE.md already specifies ("never treat
index.sqlite3 as authoritative — always write to the markdown files first, then update the
index").

### Concrete, low-effort improvement ideas surfaced by this research

1. Add a `rewatch`/`reread`/`relisten` boolean (or richer object) to repeat entries in
   `watch_dates`/`read_dates`, following Letterboxd's diary.csv model — currently the schema
   only has bare date lists, so a second viewing/read can't be distinguished from a data-entry
   mistake or a first viewing logged twice.
2. Make yearly-stats logic (whenever it gets built) filter strictly by the date value inside
   `thoughts`/`watch_dates`/`read_dates`, not by any status field — this is how Goodreads'
   challenge counting actually works and avoids edge cases around books/movies logged late.
3. Consider an optional `mood`/`pace` tag list on book (and maybe journal) entries — cheap
   frontmatter addition, StoryGraph-inspired, gives "what kind of stuff do I actually enjoy"
   stats without needing any ML/aggregate data this app doesn't have.
4. Treat `scripts/reindex.py` as a full drop-and-rebuild rather than an incremental
   sync-and-diff — sidesteps the idempotency problems that database-backed import tools
   (Movary) have to solve explicitly, since this app's index has no independent state to
   reconcile against.
5. Keep frontmatter fields flat/scalar (per Obsidian's documented rationale) and put anything
   long-form or nested into the markdown body or into `thoughts[].text` — this is already the
   design, and it's good practice to keep it that way as more fields get added later.

---

## What I could not verify

- The exact completion-percentage threshold Trakt uses to auto-mark something "watched" via
  scrobbling — commonly cited elsewhere as ~80%, but I could not confirm that figure against
  Trakt's own documentation, so it's omitted as fact above.
- Several Letterboxd support/FAQ/Zendesk pages returned HTTP 403 to automated fetches, so
  claims about Letterboxd's diary/rewatch/Year-in-Review UI are marked **[reported]** rather than
  **[verified]** — they're based on search-engine-extracted summaries of those same pages, not a
  direct read, so treat them as probably right but not independently double-checked line by
  line.
- The precise mechanics of StoryGraph's mood/pace ML tagging (how the model is trained, what
  inputs it uses) are not publicly documented anywhere I could find — only that StoryGraph itself
  describes the tags as "TSG ML generated" in responses on their own product-roadmap site. The
  *existence* of the mood/pace taxonomy is solid; the *algorithm* behind it is not something to
  cite as understood.
- I did not find a single actively-maintained, open-source, self-hosted tracker (movies, TV,
  books, or music) that uses markdown-file-per-entry as its primary/authoritative storage — the
  markdown-first precedent comes entirely from the note-taking/SSG category (Obsidian, Hugo,
  Jekyll, jrnl), not from anything in the "personal media tracker" category itself. Flagged
  explicitly above rather than glossed over, since it's a real gap in the "prior art" for this
  app's specific architecture.

---

## References

- Letterboxd — Frequent questions (FAQ): https://letterboxd.com/about/faq/ *(reported via search extraction; direct fetch returns 403)*
- Letterboxd — Diary vs. "watched" clarification (Zendesk): https://letterboxd.zendesk.com/hc/en-us/articles/15178773269263 *(reported; direct fetch returns 403)*
- Letterboxd — 2025 Year in Review FAQ: https://letterboxd.com/journal/2025-letterboxd-year-in-review-faq/ *(reported; direct fetch returns 403)*
- Letterboxd — data export/import format (diary.csv/ratings.csv/reviews.csv columns): https://letterboxd.com/user/exportdata/ and https://letterboxd.com/about/importing-data/ *(reported via search extraction)*
- Trakt — API getting started docs: https://docs.trakt.tv/docs/getting-started
- Trakt — API reference (Apiary, JS-rendered, limited content retrievable): https://trakt.docs.apiary.io/
- Trakt — official support repo discussion on scrobble vs. watched status: https://github.com/trakt/api-help/discussions/434
- trakt-scrobbler (third-party client, useful for practical scrobble mechanics): https://github.com/iamkroot/trakt-scrobbler/blob/master/README.md
- Goodreads Help Center — reading challenge/shelf counting: https://help.goodreads.com/s/question/0D51H00006AhpWgSAJ
- The StoryGraph — product roadmap site (mood/pace tag sourcing): https://roadmap.thestorygraph.com/requests-ideas/posts/moods-paces-should-change-based-on-reviews
- Last.fm — Scrobbling 2.0 official docs: https://www.last.fm/api/scrobbling
- Musivault (self-hosted vinyl/CD tracker): https://github.com/Jeanball/Musivault
- Vinyl Shelf Finder (Discogs-collection app, open source): https://github.com/valentingalea/vinyl-shelf-finder
- Movary (self-hosted movie tracker): https://github.com/leepeuker/movary and https://docs.movary.org/features/letterboxd/
- Ryot ("roll your own tracker"): https://github.com/ignisda/ryot and https://ryot.io/
- Obsidian — Properties (frontmatter) documentation: https://obsidian.md/help/Editing+and+formatting/Properties
- Hugo — Content organization: https://gohugo.io/content-management/organization/
- Hugo — Front matter: https://gohugo.io/content-management/front-matter/
- Jekyll — Front matter: https://jekyllrb.com/docs/front-matter/
- Jekyll — Collections: https://jekyllrb.com/docs/collections/
- jrnl — Formats documentation: https://jrnl.sh/en/stable/formats/
- SQLite — Appropriate uses for SQLite: https://www.sqlite.org/whentouse.html
