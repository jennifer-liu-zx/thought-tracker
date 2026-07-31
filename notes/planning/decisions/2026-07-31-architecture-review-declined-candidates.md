# Architecture review: declined candidates

Context: a 2026-07-31 architecture review produced 7 improvement candidates for
this codebase. Candidates #1, #3, #5, #6 were implemented that same session
(favorite/starred seam fix, cover-upload/browse-toggle extraction, `shelf.js`
split, shared tag-filter widget). The three below were deliberately declined
after being grilled individually — recorded here so they aren't re-proposed
without this context.

## #2 — deepen the flat-markdown-collection module (movies/books/live_covers)

**Proposal:** extract the shared list/get/create/update/delete-over-markdown
logic in `app/routers/movies.py`, `books.py`, `live_covers.py` into one
shared module.

**Declined because:** the duplication is real (all 3 files are genuinely
near-identical, ~55 lines each) but low-risk at this scale — it's simple,
stable logic (read files, sort, split notes, write frontmatter), maintained
by a single developer, where `grep` substitutes fine for a shared seam's
"consistency by construction" guarantee. No 4th flat collection is expected.

**Revisit if:** a 4th flat markdown collection gets added, or the 3 files
start actually diverging (a bug fixed in one but not the others).

## #4 — one layout seam per content type (TV/Music nested directories)

**Proposal:** a shared module for the "parent record + directory of child
records" layout (`tv.py`'s show+episodes, `music.py`'s album+tracks), also
reused by `calendar.py`'s `_iter_thought_sources()`, which currently
re-derives the same directory-walk logic independently.

**Declined because:** the duplicated part is narrow — just the physical
folder-layout convention (`episodes/`, `tracks/`) and a 2-line
`sorted(dir.glob("*.md"))` walk. That convention is already the documented,
effectively-permanent storage spec in `CLAUDE.md`, not something likely to
drift or need per-type variation. The two independent implementations are
currently byte-identical in behavior. A "proper" fix means a new shared
module (reaching into another router's `_private` helpers isn't a clean
alternative); that's more machinery than this small, stable duplication
earns.

**Revisit if:** the on-disk layout convention for nested content types
actually needs to change, or a 3rd nested content type is added.

## #7 — speculative Pydantic mixin for favorite/favorite_order/thoughts

**Proposal:** `FavoritableMixin`/`ThoughtfulMixin` for the `favorite` +
`favorite_order` (6 models) and `thoughts` (7 models) fields repeated
verbatim across `app/models.py`.

**Declined because:** this is duplicated *data* (field declarations), not
duplicated *logic* — nothing to silently drift. The risk it guards against
(a new content type's model forgetting these fields) is already covered by
a documented convention in `CLAUDE.md` and would fail loudly (missing
UI behavior), not silently. Against that small benefit, splitting a
Pydantic model's fields across mixins has a real cost: a model's fields are
normally visible in one place, which matters for a validation library —
mixins spread that across 2-3 classes. The original report flagged this as
its weakest, most speculative candidate.

**Revisit if:** a new content type is added and its model ends up missing
one of these fields in practice (i.e. the "fails loudly" assumption turns
out wrong), or the number of models sharing these fields grows enough that
the mixin's cost/benefit shifts.
