(function () {
  const browseEl = document.getElementById("music-browse");
  const detailEl = document.getElementById("music-detail");
  const addBtn = document.getElementById("add-album-btn");
  const backBtn = document.getElementById("music-back-btn");
  const collectionEl = document.getElementById("music-collection");

  const albumModeEl = document.getElementById("music-album-mode");
  const songModeEl = document.getElementById("music-song-mode");
  const songsCollectionEl = document.getElementById("music-songs-collection");
  const addSongBtn = document.getElementById("add-song-btn");
  const songAddPanel = document.getElementById("song-add-panel");
  const songAddSearchInput = document.getElementById("song-add-search");
  const songAddResultsEl = document.getElementById("song-add-results");

  const searchPanel = document.getElementById("album-search-panel");
  const searchInput = document.getElementById("album-search-input");
  const searchResultsEl = document.getElementById("album-search-results");

  const form = document.getElementById("album-form");
  const idEl = document.getElementById("album-id");
  const mbidEl = document.getElementById("album-mbid");
  const discogsIdEl = document.getElementById("album-discogs-id");
  const titleEl = document.getElementById("album-title");
  const englishTitleEl = document.getElementById("album-english-title");
  const showEnglishTitleEl = document.getElementById("album-show-english-title");
  const artistEl = document.getElementById("album-artist");
  const releaseDateEl = document.getElementById("album-release-date");
  const countryEl = document.getElementById("album-country");
  const releaseTypeSelect = createCustomSelect({
    container: document.getElementById("album-release-type"),
    options: [
      { value: "album", label: "Album" },
      { value: "ep", label: "EP" },
      { value: "single", label: "Single" },
    ],
    value: "album",
    onChange: () => {},
  });
  const coverEl = document.getElementById("album-cover");
  const coverPreviewEl = document.getElementById("album-cover-preview");
  const coverUploadEl = document.getElementById("album-cover-upload");
  const coverRemoveBtn = document.getElementById("album-cover-remove-btn");
  const notesEl = document.getElementById("album-notes");
  const thoughtsEl = document.getElementById("album-thoughts");
  const newThoughtDateEl = document.getElementById("new-album-thought-date");
  const newThoughtTextEl = document.getElementById("new-album-thought-text");
  const addThoughtBtn = document.getElementById("add-album-thought-btn");
  const tagsEl = document.getElementById("album-tags");
  const newTagTextEl = document.getElementById("new-album-tag-text");
  const addTagBtn = document.getElementById("add-album-tag-btn");
  const deleteBtn = document.getElementById("album-delete-btn");

  const tracksPanel = document.getElementById("tracks-panel");
  const tracksListEl = document.getElementById("tracks-list");
  const newTrackTitle = document.getElementById("new-track-title");
  const saveTrackBtn = document.getElementById("save-track-btn");
  const importTracksBtn = document.getElementById("import-tracks-btn");

  let thoughts = [];
  let tags = [];
  let favorite = false;
  let favoriteOrder = null;
  let currentAlbumId = null;
  let currentTracks = [];
  let draggingTrackId = null;
  let searchDebounce = null;

  // "grid"/"list" are two layouts of the album collection; "song" swaps to
  // an entirely different collection (starred tracks across every album —
  // see music-song-mode.js). All three read as one toggle, so grid/list's
  // value is derived from the album collectionView's own persisted
  // preference rather than a separate storage key.
  function lastAlbumView() {
    return localStorage.getItem("view:music") === "list" ? "list" : "grid";
  }
  let browseMode = localStorage.getItem("music-mode") === "song" ? "song" : lastAlbumView();

  // Builds one Grid/List/Song button group, reusing .view-toggle's own
  // styling wholesale so it's indistinguishable from a plain Grid/List
  // toggle. Two independent copies get inserted — one into each of
  // Album/Song mode's own toolbar — since only one toolbar is ever visible
  // at a time, but each needs its own copy to switch away from itself.
  function buildModeToggle() {
    const wrap = document.createElement("div");
    wrap.className = "view-toggle";
    wrap.innerHTML = `
      <button type="button" data-mode="song">Song</button>
      <button type="button" data-mode="grid">Grid</button>
      <button type="button" data-mode="list">List</button>
    `;
    wrap.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => setBrowseMode(btn.dataset.mode));
    });
    return wrap;
  }

  const collectionView = createCollectionView({
    container: collectionEl,
    storageKey: "music",
    onSelect: selectAlbum,
    coverAspect: "square",
    hideViewToggle: true,
    sortOptions: [
      { value: "title-asc", label: "Title (A–Z)", cmp: (a, b) => a.title.localeCompare(b.title) },
      { value: "title-desc", label: "Title (Z–A)", cmp: (a, b) => b.title.localeCompare(a.title) },
      { value: "artist-asc", label: "Artist (A–Z)", cmp: (a, b) => (a.artist || "").localeCompare(b.artist || "") },
    ],
  });
  collectionEl.querySelector(".collection-toolbar").appendChild(buildModeToggle());

  // Song View mode's own rendering/data/add-song-search logic lives in
  // music-song-mode.js — this file only owns switching to/from it.
  const songMode = createSongMode({
    collectionEl: songsCollectionEl,
    addBtn: addSongBtn,
    addPanel: songAddPanel,
    addSearchInput: songAddSearchInput,
    addResultsEl: songAddResultsEl,
    onOpenTrack: (albumId, trackId) => {
      setBrowseMode(lastAlbumView());
      openFavoriteTrack(packTrackId(albumId, trackId));
    },
    onStarChanged: () => favoritesPanel.refresh(),
  });
  songMode.toolbarEl.appendChild(buildModeToggle());

  function setBrowseMode(next) {
    browseMode = next;
    const isSong = browseMode === "song";
    localStorage.setItem("music-mode", isSong ? "song" : "album");
    albumModeEl.hidden = isSong;
    songModeEl.hidden = !isSong;
    document
      .querySelectorAll("#music-browse [data-mode]")
      .forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === browseMode));
    if (isSong) {
      songMode.load();
    } else {
      collectionView.setView(browseMode);
      loadAlbums();
    }
  }

  const RELEASE_TYPE_LABELS = { ep: "EP", single: "Single", live: "Live" };

  async function setTrackFavorite(compositeId, value) {
    const { albumId, trackId } = unpackTrackId(compositeId);
    const album = await fetch(`/api/music/${albumId}`).then((r) => r.json());
    const track = album.tracks.find((t) => t.id === trackId);
    if (!track) return;
    applyTrackFavorite(track, value);
    await putTrack(albumId, track);
  }

  async function openFavoriteTrack(compositeId) {
    const { albumId, trackId } = unpackTrackId(compositeId);
    await selectAlbum(albumId);
    const trackEl = tracksListEl.querySelector(`[data-track-id="${CSS.escape(trackId)}"]`);
    if (trackEl) {
      trackEl.open = true;
      trackEl.scrollIntoView({ block: "center" });
    }
  }

  const favoritesPanel = createFavoritesPanel({
    container: document.getElementById("music-favorites"),
    fetchAll: () => fetch("/api/music/tracks").then((r) => r.json()),
    toItem: (t) => ({
      id: packTrackId(t.album_id, t.id),
      title: pickDisplayTitle(t),
      subtitle: t.album_artist,
      cover: t.album_cover,
      favorite: t.favorite,
      keywords: t.english_title,
    }),
    setFavorite: setTrackFavorite,
    onOpen: openFavoriteTrack,
  });

  async function loadAlbums() {
    const res = await fetch("/api/music");
    const albums = await res.json();
    collectionView.setItems(
      albums.map((a) => {
        const typeLabel = RELEASE_TYPE_LABELS[a.release_type];
        return {
          id: a.id,
          title: pickDisplayTitle(a),
          subtitle: `${a.artist || ""}${a.artist ? " · " : ""}${typeLabel ? typeLabel + " · " : ""}${a.track_count} track${a.track_count === 1 ? "" : "s"}`,
          cover: a.cover,
          artist: a.artist,
          tags: a.tags || [],
          // Typing a song title (or either title variant) should surface the album it's on too.
          keywords: [...(a.tags || []), ...(a.track_titles || []), a.title, a.english_title].join(" "),
        };
      })
    );
  }

  const thoughtsEditor = createThoughtsEditor({
    container: thoughtsEl,
    getThoughts: () => thoughts,
    dateInput: newThoughtDateEl,
    textInput: newThoughtTextEl,
    addBtn: addThoughtBtn,
  });

  const notesViewEl = document.createElement("div");
  notesViewEl.className = "notes-view";
  notesViewEl.hidden = true;
  notesEl.insertAdjacentElement("afterend", notesViewEl);
  const notesEditor = createNotesEditor({ container: notesViewEl, textarea: notesEl });

  function renderTags() {
    tagsEl.innerHTML = "";
    tags.forEach((tag, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${tag} <button type="button" aria-label="remove">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        tags.splice(i, 1);
        renderTags();
      });
      tagsEl.appendChild(chip);
    });
  }

  addTagBtn.addEventListener("click", () => {
    const tag = newTagTextEl.value.trim();
    if (!tag || tags.includes(tag)) return;
    tags.push(tag);
    newTagTextEl.value = "";
    renderTags();
  });

  const coverUpload = createCoverUpload({
    coverInput: coverEl,
    uploadInput: coverUploadEl,
    removeBtn: coverRemoveBtn,
    previewEl: coverPreviewEl,
    emptyText: "no cover",
  });

  const { showBrowse, showDetail } = createBrowseDetailToggle({ browseEl, detailEl });

  function resetForm() {
    idEl.value = "";
    mbidEl.value = "";
    discogsIdEl.value = "";
    titleEl.value = "";
    englishTitleEl.value = "";
    showEnglishTitleEl.checked = false;
    artistEl.value = "";
    releaseDateEl.value = "";
    countryEl.value = "";
    releaseTypeSelect.setValue("album");
    coverEl.value = "";
    notesEl.value = "";
    notesEditor.reset();
    thoughts = [];
    tags = [];
    favorite = false;
    favoriteOrder = null;
    thoughtsEditor.render();
    renderTags();
    coverUpload.updatePreview();
    deleteBtn.hidden = true;
    tracksPanel.hidden = true;
    newTrackTitle.value = "";
    importTracksBtn.hidden = true;
    searchPanel.hidden = false;
    searchInput.value = "";
    searchResultsEl.innerHTML = "";
    markClean();
  }

  // ---- Tracks rendering ----

  async function reorderTracks(albumId, draggedId, targetId) {
    const fromIndex = currentTracks.findIndex((t) => t.id === draggedId);
    const toIndex = currentTracks.findIndex((t) => t.id === targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [moved] = currentTracks.splice(fromIndex, 1);
    currentTracks.splice(toIndex, 0, moved);
    currentTracks.forEach((t, i) => {
      t.track_number = i + 1;
    });
    renderTracks(albumId, currentTracks);

    // Same ids/files throughout — reordering only ever edits track_number, so
    // every other field stays attached to the track that owns it.
    await Promise.all(currentTracks.map((t) => putTrack(albumId, t)));
  }

  function buildTrackElement(albumId, track) {
    const details = document.createElement("details");
    details.className = "track-item";
    details.dataset.trackId = track.id;

    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="drag-handle" draggable="true" title="Drag to reorder">⠿</span><span class="ep-num">${String(track.track_number).padStart(2, "0")}</span><span class="ep-name">${escapeHtml(pickDisplayTitle(track)) || "(untitled)"}</span><span class="song-item-star ${track.starred ? "active" : ""}" role="button" aria-label="Toggle star">${track.starred ? "★" : "☆"}</span>`;
    details.appendChild(summary);

    const trackStarEl = summary.querySelector(".song-item-star");
    trackStarEl.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTrackStarred(track);
      trackStarEl.textContent = track.starred ? "★" : "☆";
      trackStarEl.classList.toggle("active", !!track.starred);
      await putTrack(albumId, track);
      favoritesPanel.refresh();
    });

    const dragHandle = summary.querySelector(".drag-handle");
    dragHandle.addEventListener("click", (e) => e.preventDefault());
    dragHandle.addEventListener("dragstart", (e) => {
      draggingTrackId = track.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", track.id);
    });
    dragHandle.addEventListener("dragend", () => {
      draggingTrackId = null;
    });

    details.addEventListener("dragover", (e) => {
      if (!draggingTrackId || draggingTrackId === track.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      details.classList.add("drag-over");
    });
    details.addEventListener("dragleave", () => {
      details.classList.remove("drag-over");
    });
    details.addEventListener("drop", async (e) => {
      e.preventDefault();
      details.classList.remove("drag-over");
      const draggedId = draggingTrackId;
      draggingTrackId = null;
      if (!draggedId || draggedId === track.id) return;
      await reorderTracks(albumId, draggedId, track.id);
    });

    const body = document.createElement("div");
    body.className = "episode-body";
    details.appendChild(body);

    createTrackFieldsEditor({
      container: body,
      albumId,
      track,
      onSaved: () => {
        // The collapsed summary reflects the toggle immediately, without a full re-fetch.
        summary.querySelector(".ep-name").textContent = pickDisplayTitle(track) || "(untitled)";
      },
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger";
    delBtn.textContent = "Delete track";
    body.appendChild(delBtn);

    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete track "${track.title}"?`)) return;
      await fetch(`/api/music/${albumId}/tracks/${track.id}`, { method: "DELETE" });
      const i = currentTracks.findIndex((t) => t.id === track.id);
      if (i !== -1) currentTracks.splice(i, 1);

      // Close the gap left behind instead of leaving e.g. 12, 14, 15 —
      // only the tracks whose number actually shifted need re-saving.
      const changed = currentTracks.filter((t, idx) => t.track_number !== idx + 1);
      currentTracks.forEach((t, idx) => {
        t.track_number = idx + 1;
      });
      renderTracks(albumId, currentTracks);
      await Promise.all(changed.map((t) => putTrack(albumId, t)));
    });

    enableSmoothDetails(details);

    return details;
  }

  function renderTracks(albumId, tracks) {
    currentAlbumId = albumId;
    currentTracks = tracks;
    tracksListEl.innerHTML = "";
    if (tracks.length === 0) {
      tracksListEl.innerHTML = `<p class="empty-msg">No tracks yet.</p>`;
      return;
    }
    for (const track of tracks) {
      tracksListEl.appendChild(buildTrackElement(albumId, track));
    }
  }

  function fillForm(album) {
    idEl.value = album.id;
    mbidEl.value = album.mbid || "";
    discogsIdEl.value = album.discogs_id || "";
    titleEl.value = album.title || "";
    englishTitleEl.value = album.english_title || "";
    showEnglishTitleEl.checked = !!album.show_english_title;
    artistEl.value = album.artist || "";
    releaseDateEl.value = album.release_date || "";
    countryEl.value = album.country || "";
    releaseTypeSelect.setValue(album.release_type || "album");
    coverEl.value = album.cover || "";
    notesEl.value = album.notes || "";
    notesEditor.load();
    thoughts = [...(album.thoughts || [])];
    tags = [...(album.tags || [])];
    favorite = !!album.favorite;
    favoriteOrder = album.favorite_order ?? null;
    thoughtsEditor.render();
    renderTags();
    coverUpload.updatePreview();
    importTracksBtn.hidden = !(album.mbid || album.discogs_id);
    markClean();
  }

  async function selectAlbum(id) {
    const res = await fetch(`/api/music/${id}`);
    if (!res.ok) return;
    const album = await res.json();
    fillForm(album);
    deleteBtn.hidden = false;
    searchPanel.hidden = true;
    tracksPanel.hidden = false;
    newTrackTitle.value = "";
    renderTracks(album.id, album.tracks || []);
    showDetail();
  }

  addBtn.addEventListener("click", () => {
    resetForm();
    showDetail();
  });

  backBtn.addEventListener("click", () => {
    if (isDirty() && !confirm("You have unsaved changes. Leave without saving?")) return;
    showBrowse();
    loadAlbums();
    favoritesPanel.refresh();
  });

  function buildPayload() {
    return {
      title: titleEl.value,
      english_title: englishTitleEl.value,
      show_english_title: showEnglishTitleEl.checked,
      artist: artistEl.value,
      release_date: releaseDateEl.value,
      country: countryEl.value,
      release_type: releaseTypeSelect.getValue(),
      cover: coverEl.value,
      notes: notesEl.value,
      tags: tags,
      favorite: favorite,
      favorite_order: favoriteOrder,
      thoughts: thoughts,
      mbid: mbidEl.value,
      discogs_id: discogsIdEl.value,
    };
  }

  const { isDirty, markClean } = createDirtyTracker(buildPayload, {
    isVisible: () => !detailEl.hidden,
    indicatorEl: document.getElementById("album-unsaved-indicator"),
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    if (!q) {
      searchResultsEl.innerHTML = "";
      return;
    }
    searchDebounce = setTimeout(async () => {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`);
      // MusicBrainz/Discogs latency varies a lot — an older, slower request
      // can resolve after a newer one, otherwise overwriting fresh results
      // with stale ones. Discard anything that isn't for the current query.
      if (searchInput.value.trim() !== q) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        searchResultsEl.innerHTML = `<p class="empty-msg">${err.detail || "Search unavailable."}</p>`;
        return;
      }
      const results = await res.json();
      if (searchInput.value.trim() !== q) return;
      searchResultsEl.innerHTML = "";
      for (const r of results) {
        const row = document.createElement("div");
        row.className = "search-result";
        const coverImg = r.cover ? `<img src="${r.cover}" alt="" />` : "<img alt=''/>";
        row.innerHTML = `${coverImg}<div><div class="result-title">${r.title}</div><div class="result-subtitle">${r.artist}</div></div>`;
        row.addEventListener("click", async () => {
          // MusicBrainz search results are lightweight — country/tags/an
          // English alias need one follow-up lookup. Discogs results are
          // already complete, so skip it there.
          let detail = {};
          if (r.mbid) {
            detail = await fetch(`/api/music/search-detail?mbid=${r.mbid}`).then((res) => res.json());
          }
          titleEl.value = r.title || "";
          artistEl.value = r.artist || "";
          releaseDateEl.value = r.release_date || "";
          countryEl.value = detail.country || r.country || "";
          coverEl.value = r.cover || "";
          releaseTypeSelect.setValue(r.release_type || "album");
          mbidEl.value = r.mbid || "";
          discogsIdEl.value = r.discogs_id || "";
          if (detail.english_title) englishTitleEl.value = detail.english_title;
          for (const tag of [...(detail.tags || []), ...(r.tags || [])]) {
            if (!tags.includes(tag)) tags.push(tag);
          }
          renderTags();
          coverUpload.updatePreview();
          // Stays hidden until the album is actually saved — importing
          // needs a real album id to write track files into.
          searchResultsEl.innerHTML = "";
          searchInput.value = r.title;
        });
        searchResultsEl.appendChild(row);
      }
    }, 300);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    const id = idEl.value;
    const res = await fetch(id ? `/api/music/${id}` : "/api/music", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const saved = await res.json();
    await selectAlbum(saved.id);
    favoritesPanel.refresh();
  });

  deleteBtn.addEventListener("click", async () => {
    const id = idEl.value;
    if (!id || !confirm("Delete this album and all its tracks?")) return;
    await fetch(`/api/music/${id}`, { method: "DELETE" });
    markClean();
    showBrowse();
    loadAlbums();
    favoritesPanel.refresh();
  });

  importTracksBtn.addEventListener("click", async () => {
    const id = idEl.value;
    if (!id) return;
    const res = await fetch(`/api/music/${id}/import-tracks`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Couldn't import the tracklist.");
      return;
    }
    const tracks = await res.json();
    currentTracks = tracks;
    renderTracks(id, tracks);
  });

  saveTrackBtn.addEventListener("click", async () => {
    const albumId = idEl.value;
    const title = newTrackTitle.value.trim();
    if (!albumId || !title) return;
    // Position is just "add to the end" — drag the handle afterward to reorder.
    // The server assigns the id from the title, independent of this number, so
    // a later reorder never has to touch this track's lyrics/thoughts files.
    const trackNumber = currentTracks.length + 1;
    await fetch(`/api/music/${albumId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_number: trackNumber, title, thoughts: [] }),
    });
    newTrackTitle.value = "";
    await selectAlbum(albumId);
    newTrackTitle.focus();
  });

  window.Diary = window.Diary || {};
  window.Diary.music = {
    showBrowse: () => {
      showBrowse();
      if (browseMode === "song") songMode.load();
      else loadAlbums();
      favoritesPanel.refresh();
    },
    openItem: (id) => selectAlbum(id),
    openTrack: (albumId, trackId) => openFavoriteTrack(packTrackId(albumId, trackId)),
    isDirty: () => isDirty(),
  };

  // Reflect whatever mode was persisted from a previous visit before the
  // initial load — setBrowseMode() itself would also re-fetch, which is
  // redundant with the loadAlbums()/songMode.load() call below on a fresh
  // page load, so just sync the hidden/active state here. The album
  // collectionView's own initial `state.view` already matches lastAlbumView()
  // (both read the same `view:music` localStorage key), so it doesn't need
  // an explicit setView() call on this first render.
  const isSongInitially = browseMode === "song";
  albumModeEl.hidden = isSongInitially;
  songModeEl.hidden = !isSongInitially;
  document
    .querySelectorAll("#music-browse [data-mode]")
    .forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === browseMode));

  if (isSongInitially) songMode.load();
  else loadAlbums();
})();
