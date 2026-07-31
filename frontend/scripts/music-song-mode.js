// Song View mode — Music > Albums tab's "Song View" toggle. A lighter
// browse/tag/thought surface over every starred track across every album:
// song-list rendering and the add-song search are a genuinely separate
// concern from music.js's album browsing/editing, so they live here instead
// of growing music.js further.
//
// onOpenTrack(albumId, trackId): fires when a song row's album-name link is
// clicked — the caller (music.js) owns switching back to Album View mode
// and expanding the right track there.
// onStarChanged (optional): fires after a star toggle, so the caller can
// refresh anything else that shows favourite/starred state (the sidebar
// Favourites panel).
function createSongMode({ collectionEl, addBtn, addPanel, addSearchInput, addResultsEl, onOpenTrack, onStarChanged }) {
  let allTracks = []; // every track across every album, from GET /api/music/tracks

  function renderSongRow(item) {
    const t = item.track;
    const details = document.createElement("details");
    details.className = "song-item";

    const summary = document.createElement("summary");
    const visibleTags = (t.tags || []).slice(0, 2);
    const extraCount = (t.tags || []).length - visibleTags.length;
    summary.innerHTML = `
      <div class="cover">${buildCoverHtml(item)}</div>
      <div class="song-item-info">
        <div class="song-item-title">${escapeHtml(item.title)}</div>
        <div class="song-item-subtitle">${escapeHtml(item.subtitle || "")}</div>
      </div>
      <span class="song-item-album-link">${escapeHtml(t.album_title)}</span>
      <div class="song-item-tags">
        ${visibleTags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
        ${extraCount > 0 ? `<span class="song-item-tags-more">+${extraCount} more</span>` : ""}
      </div>
      <span class="song-item-star ${t.starred ? "active" : ""}" role="button" aria-label="Toggle star">${t.starred ? "★" : "☆"}</span>
    `;
    details.appendChild(summary);

    // Clicks inside <summary> toggle the native details open/close by
    // default — preventDefault stops that so the star/album-link act
    // independently of expanding the row.
    const albumLink = summary.querySelector(".song-item-album-link");
    albumLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onOpenTrack(t.album_id, t.id);
    });

    const starEl = summary.querySelector(".song-item-star");
    starEl.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTrackStarred(t);
      await putTrack(t.album_id, t);
      await load(); // refresh — an unstarred track drops out of this list
      onStarChanged?.();
    });

    const body = document.createElement("div");
    body.className = "song-item-body";
    details.appendChild(body);

    // Lazily build the reduced tags+thoughts editor only on first expand,
    // so rows nobody opens don't pay for wiring two editors each.
    let bodyBuilt = false;
    details.addEventListener("toggle", () => {
      if (details.open && !bodyBuilt) {
        bodyBuilt = true;
        createSongRowExpandBody({
          container: body,
          albumId: t.album_id,
          track: t,
          onSaved: () => {
            summary.querySelector(".song-item-tags").innerHTML = (() => {
              const visible = (t.tags || []).slice(0, 2);
              const extra = (t.tags || []).length - visible.length;
              return `${visible.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}${
                extra > 0 ? `<span class="song-item-tags-more">+${extra} more</span>` : ""
              }`;
            })();
          },
        });
      }
    });

    enableSmoothDetails(details);
    return details;
  }

  const collectionView = createCollectionView({
    container: collectionEl,
    storageKey: "music-songs",
    onSelect: () => {},
    coverAspect: "square",
    pageSize: 40,
    forceView: "list",
    renderItem: renderSongRow,
  });

  async function load() {
    allTracks = await fetch("/api/music/tracks").then((r) => r.json());
    collectionView.setItems(
      allTracks
        .filter((t) => t.starred)
        .map((t) => ({
          id: packTrackId(t.album_id, t.id),
          title: pickDisplayTitle(t),
          subtitle: t.album_artist,
          cover: t.album_cover,
          tags: t.tags || [],
          keywords: [...(t.tags || []), t.english_title, t.album_title].join(" "),
          track: t,
        }))
    );
  }

  addBtn.addEventListener("click", () => {
    const willOpen = addPanel.hidden;
    addPanel.hidden = !willOpen;
    addResultsEl.innerHTML = "";
    addSearchInput.value = "";
    if (willOpen) addSearchInput.focus();
  });

  addSearchInput.addEventListener("input", () => {
    const q = addSearchInput.value.trim().toLowerCase();
    addResultsEl.innerHTML = "";
    if (!q) return;
    const matches = allTracks
      .filter(
        (t) => !t.starred && `${t.title} ${t.album_artist} ${t.album_title}`.toLowerCase().includes(q)
      )
      .slice(0, 8);
    for (const t of matches) {
      const row = document.createElement("div");
      row.className = "search-result";
      row.textContent = `${pickDisplayTitle(t)} — ${t.album_artist} (${t.album_title})`;
      row.addEventListener("click", async () => {
        const album = await fetch(`/api/music/${t.album_id}`).then((r) => r.json());
        const track = album.tracks.find((tr) => tr.id === t.id);
        if (!track) return;
        track.starred = true;
        await putTrack(t.album_id, track);
        addPanel.hidden = true;
        await load();
      });
      addResultsEl.appendChild(row);
    }
  });

  // Exposed so music.js can insert its combined Grid/List/Song toggle here
  // too — this collection's own toolbar has no Grid/List of its own
  // (forceView: "list"), so without this, switching to Song mode would
  // leave no toggle visible to switch back with.
  const toolbarEl = collectionEl.querySelector(".collection-toolbar");

  return { load, toolbarEl };
}
