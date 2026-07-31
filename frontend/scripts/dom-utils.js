/** Simple pencil glyph (tip pointing to the lower-left) used for every "edit"
 * affordance — one filled silhouette with no dividing line across the body,
 * as an inline SVG rather than a Unicode character so it renders identically
 * across platforms/fonts. */
const PENCIL_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/** Picks which title a browse/list/swimlane view should show for an item that
 * has both an original `title` and an optional `english_title` + toggle. */
function pickDisplayTitle(item) {
  return item.show_english_title && item.english_title ? item.english_title : item.title;
}

/** Packs two ids into one flat string, for item lists (like createCollectionView's
 * `items`) that need a single unique `id` per row but the underlying record is
 * addressed by two ids (e.g. a track's album_id + track_id). */
function packTrackId(albumId, trackId) {
  return `${albumId}::${trackId}`;
}

function unpackTrackId(compositeId) {
  const [albumId, trackId] = compositeId.split("::");
  return { albumId, trackId };
}

/** Cover image, or a single-letter placeholder — shared by every place that
 * renders an item's cover (collection grid/list, favourites panel, home swimlanes). */
function buildCoverHtml(item) {
  return item.cover
    ? `<img src="${escapeHtml(item.cover)}" alt="" class="cover-img" />`
    : `<div class="cover-placeholder">${escapeHtml((item.title || "?")[0])}</div>`;
}
