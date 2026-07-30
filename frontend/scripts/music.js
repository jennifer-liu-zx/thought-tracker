(function () {
  const browseEl = document.getElementById("music-browse");
  const detailEl = document.getElementById("music-detail");
  const addBtn = document.getElementById("add-album-btn");
  const backBtn = document.getElementById("music-back-btn");
  const collectionEl = document.getElementById("music-collection");

  const modeToggleBtns = document.querySelectorAll("#music-browse .mode-toggle-btn");
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
  let mode = localStorage.getItem("music-mode") === "song" ? "song" : "album";
  let allTracks = []; // every track across every album, from GET /api/music/tracks — Song view mode's data

  const collectionView = createCollectionView({
    container: collectionEl,
    storageKey: "music",
    onSelect: selectAlbum,
    coverAspect: "square",
    sortOptions: [
      { value: "title-asc", label: "Title (A–Z)", cmp: (a, b) => a.title.localeCompare(b.title) },
      { value: "title-desc", label: "Title (Z–A)", cmp: (a, b) => b.title.localeCompare(a.title) },
      { value: "artist-asc", label: "Artist (A–Z)", cmp: (a, b) => (a.artist || "").localeCompare(b.artist || "") },
    ],
  });

  // ---- Song view mode ----

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
      setMode("album");
      window.Diary.music.openTrack(t.album_id, t.id);
    });

    const starEl = summary.querySelector(".song-item-star");
    starEl.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTrackStarred(t);
      await putTrack(t.album_id, t);
      await loadSongs(); // refresh — an unstarred track drops out of this list
      favoritesPanel.refresh();
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

  const songsCollectionView = createCollectionView({
    container: songsCollectionEl,
    storageKey: "music-songs",
    onSelect: () => {},
    coverAspect: "square",
    pageSize: 40,
    forceView: "list",
    renderItem: renderSongRow,
  });

  async function loadSongs() {
    allTracks = await fetch("/api/music/tracks").then((r) => r.json());
    songsCollectionView.setItems(
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

  function setMode(next) {
    mode = next;
    localStorage.setItem("music-mode", mode);
    albumModeEl.hidden = mode !== "album";
    songModeEl.hidden = mode !== "song";
    modeToggleBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
    if (mode === "album") loadAlbums();
    else loadSongs();
  }

  modeToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  addSongBtn.addEventListener("click", () => {
    const willOpen = songAddPanel.hidden;
    songAddPanel.hidden = !willOpen;
    songAddResultsEl.innerHTML = "";
    songAddSearchInput.value = "";
    if (willOpen) songAddSearchInput.focus();
  });

  songAddSearchInput.addEventListener("input", () => {
    const q = songAddSearchInput.value.trim().toLowerCase();
    songAddResultsEl.innerHTML = "";
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
        songAddPanel.hidden = true;
        await loadSongs();
      });
      songAddResultsEl.appendChild(row);
    }
  });

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

  function updateCoverPreview() {
    coverPreviewEl.innerHTML = coverEl.value
      ? `<img src="${coverEl.value}" alt="" />`
      : "no cover";
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

  coverEl.addEventListener("input", updateCoverPreview);

  coverRemoveBtn.addEventListener("click", () => {
    coverEl.value = "";
    coverUploadEl.value = "";
    updateCoverPreview();
  });

  coverUploadEl.addEventListener("change", () => {
    const file = coverUploadEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      coverEl.value = reader.result;
      updateCoverPreview();
    };
    reader.readAsDataURL(file);
  });

  function showBrowse() {
    detailEl.hidden = true;
    browseEl.hidden = false;
  }

  function showDetail() {
    browseEl.hidden = true;
    detailEl.hidden = false;
  }

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
    updateCoverPreview();
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
    updateCoverPreview();
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
          updateCoverPreview();
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
      if (mode === "album") loadAlbums();
      else loadSongs();
      favoritesPanel.refresh();
    },
    openItem: (id) => selectAlbum(id),
    openTrack: (albumId, trackId) => openFavoriteTrack(packTrackId(albumId, trackId)),
    isDirty: () => isDirty(),
  };

  // Reflect whatever mode was persisted from a previous visit before the
  // initial load — setMode() itself would also flip modeToggleBtns'
  // active class and re-fetch, which is redundant with the loadAlbums()
  // call below on a fresh page load, so just sync the hidden/active state here.
  albumModeEl.hidden = mode !== "album";
  songModeEl.hidden = mode !== "song";
  modeToggleBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));

  if (mode === "album") loadAlbums();
  else loadSongs();
})();
