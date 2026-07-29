(function () {
  const browseEl = document.getElementById("music-browse");
  const detailEl = document.getElementById("music-detail");
  const addBtn = document.getElementById("add-album-btn");
  const backBtn = document.getElementById("music-back-btn");
  const collectionEl = document.getElementById("music-collection");

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

  const RELEASE_TYPE_LABELS = { ep: "EP", single: "Single", live: "Live" };

  // The Albums favourites panel favourites individual songs, not whole
  // albums — a composite "albumId::trackId" id carries both halves through
  // createFavoritesPanel's generic {id} interface, split back apart here.
  function packTrackId(albumId, trackId) {
    return `${albumId}::${trackId}`;
  }

  function unpackTrackId(compositeId) {
    const [albumId, trackId] = compositeId.split("::");
    return { albumId, trackId };
  }

  // Every full-track PUT (favoriting, reordering, renumbering after a
  // delete, the track's own Save button) must resend every field TrackIn
  // knows about, or the API silently resets whatever's omitted back to its
  // default — this happened for real with several of these call sites
  // (favorite/favorite_order/duration/composers kept getting dropped one at
  // a time as fields were added over time). One shared builder instead of
  // N duplicated field lists closes off that whole bug class.
  function trackToPayload(t) {
    return {
      track_number: t.track_number,
      title: t.title,
      english_title: t.english_title || "",
      show_english_title: !!t.show_english_title,
      link: t.link || "",
      duration: t.duration || "",
      writers: t.writers || "",
      composers: t.composers || "",
      producers: t.producers || "",
      featuring: t.featuring || "",
      label: t.label || "",
      favorite: t.favorite,
      favorite_order: t.favorite_order,
      thoughts: t.thoughts,
    };
  }

  function putTrack(albumId, trackId, t) {
    return fetch(`/api/music/${albumId}/tracks/${trackId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trackToPayload(t)),
    });
  }

  async function setTrackFavorite(compositeId, value) {
    const { albumId, trackId } = unpackTrackId(compositeId);
    const album = await fetch(`/api/music/${albumId}`).then((r) => r.json());
    const track = album.tracks.find((t) => t.id === trackId);
    if (!track) return;
    track.favorite = value;
    await putTrack(albumId, trackId, track);
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
    await Promise.all(currentTracks.map((t) => putTrack(albumId, t.id, t)));
  }

  function buildTrackElement(albumId, track) {
    const details = document.createElement("details");
    details.className = "track-item";
    details.dataset.trackId = track.id;

    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="drag-handle" draggable="true" title="Drag to reorder">⠿</span><span class="ep-num">${String(track.track_number).padStart(2, "0")}</span><span class="ep-name">${escapeHtml(pickDisplayTitle(track)) || "(untitled)"}</span>`;
    details.appendChild(summary);

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

    const titleView = document.createElement("div");
    titleView.className = "track-title-view";
    titleView.innerHTML = `
      <span class="track-title-display"></span>
      <button type="button" class="track-title-edit-btn" aria-label="Edit title">${PENCIL_ICON}</button>
    `;
    body.appendChild(titleView);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "track-title-input";
    titleInput.placeholder = "Track title";
    titleInput.hidden = true;
    body.appendChild(titleInput);

    const titleDisplay = titleView.querySelector(".track-title-display");
    titleDisplay.textContent = track.title;

    titleView.querySelector(".track-title-edit-btn").addEventListener("click", () => {
      titleInput.value = track.title;
      titleView.hidden = true;
      titleInput.hidden = false;
      titleInput.focus();
    });

    const englishTitleSection = document.createElement("div");
    englishTitleSection.className = "mini-section";
    englishTitleSection.innerHTML = `
      <div class="field">
        <label>Alternative title</label>
        <input type="text" class="track-english-title" placeholder="Alternative title (optional)" />
      </div>
      <label class="checkbox-field">
        <input type="checkbox" class="track-show-english-title" />
        Show alternative title
      </label>
    `;
    body.appendChild(englishTitleSection);

    const linkSection = document.createElement("div");
    linkSection.className = "mini-section";
    linkSection.innerHTML = `
      <h4>Link</h4>
      <div class="field-row">
        <input type="text" class="track-link" placeholder="Link to the song or video (YouTube, Spotify, etc.)" />
        <input type="text" class="track-duration" placeholder="Duration (e.g. 3:45)" style="max-width: 8rem;" />
      </div>
    `;
    body.appendChild(linkSection);

    const creditsSection = document.createElement("div");
    creditsSection.className = "mini-section";
    creditsSection.innerHTML = `
      <h4>Credits</h4>
      <div class="credits-fields">
        <div class="field">
          <label>Writer(s)</label>
          <input type="text" class="track-writers" placeholder="Writer(s)" />
        </div>
        <div class="field">
          <label>Composer(s)</label>
          <input type="text" class="track-composers" placeholder="Composer(s)" />
        </div>
        <div class="field">
          <label>Producer(s)</label>
          <input type="text" class="track-producers" placeholder="Producer(s)" />
        </div>
        <div class="field">
          <label>Featuring</label>
          <input type="text" class="track-featuring" placeholder="Featuring" />
        </div>
        <div class="field">
          <label>Label</label>
          <input type="text" class="track-label" placeholder="Label" />
        </div>
      </div>
    `;
    body.appendChild(creditsSection);

    const lyricsSection = document.createElement("div");
    lyricsSection.className = "mini-section";
    lyricsSection.innerHTML = `
      <h4>Lyrics</h4>
      <textarea class="lyrics-box" placeholder="Paste lyrics, or upload a .txt file..."></textarea>
      <div class="editor-actions" style="margin-top: 0.5rem;">
        <label class="upload-label">Upload .txt<input type="file" accept=".txt" hidden /></label>
        <button type="button" class="fetch-lyrics-btn">Fetch lyrics (LRCLIB)</button>
      </div>
    `;
    body.appendChild(lyricsSection);

    const trackSaveRow = document.createElement("div");
    trackSaveRow.className = "editor-actions";
    trackSaveRow.innerHTML = `<button type="button" class="track-save-btn">Save</button>`;
    body.appendChild(trackSaveRow);

    const thoughtsSection = document.createElement("div");
    thoughtsSection.className = "mini-section";
    thoughtsSection.innerHTML = `<h4>Thoughts</h4><div class="thoughts-list track-thoughts"></div><div class="add-row"><input type="date" class="track-new-thought-date" /><textarea class="thought-textarea track-new-thought-text" placeholder="New thought..." rows="2"></textarea><button type="button" class="track-add-thought-btn">+ Add thought</button></div>`;
    body.appendChild(thoughtsSection);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger";
    delBtn.textContent = "Delete track";
    body.appendChild(delBtn);

    details.appendChild(body);

    const englishTitleInput = englishTitleSection.querySelector(".track-english-title");
    const showEnglishTitleCheckbox = englishTitleSection.querySelector(".track-show-english-title");
    englishTitleInput.value = track.english_title || "";
    showEnglishTitleCheckbox.checked = !!track.show_english_title;

    const linkInput = linkSection.querySelector(".track-link");
    const durationInput = linkSection.querySelector(".track-duration");
    linkInput.value = track.link || "";
    durationInput.value = track.duration || "";

    const writersInput = creditsSection.querySelector(".track-writers");
    const composersInput = creditsSection.querySelector(".track-composers");
    const producersInput = creditsSection.querySelector(".track-producers");
    const featuringInput = creditsSection.querySelector(".track-featuring");
    const labelInput = creditsSection.querySelector(".track-label");
    writersInput.value = track.writers || "";
    composersInput.value = track.composers || "";
    producersInput.value = track.producers || "";
    featuringInput.value = track.featuring || "";
    labelInput.value = track.label || "";

    const lyricsBox = lyricsSection.querySelector(".lyrics-box");
    lyricsBox.value = track.lyrics || "";
    const uploadInput = lyricsSection.querySelector('input[type="file"]');
    const fetchLyricsBtn = lyricsSection.querySelector(".fetch-lyrics-btn");
    const trackSaveBtn = trackSaveRow.querySelector(".track-save-btn");
    const trackThoughtsEl = thoughtsSection.querySelector(".track-thoughts");
    const newTrackThoughtDateEl = thoughtsSection.querySelector(".track-new-thought-date");
    const newTrackThoughtTextEl = thoughtsSection.querySelector(".track-new-thought-text");
    const addTrackThoughtBtn = thoughtsSection.querySelector(".track-add-thought-btn");

    uploadInput.addEventListener("change", () => {
      const file = uploadInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        lyricsBox.value = reader.result;
      };
      reader.readAsText(file);
    });

    fetchLyricsBtn.addEventListener("click", async () => {
      const res = await fetch(`/api/music/${albumId}/tracks/${track.id}/fetch-lyrics`);
      if (!res.ok) return;
      const { lyrics } = await res.json();
      if (!lyrics) {
        alert("LRCLIB didn't have a match for this song — try pasting lyrics manually.");
        return;
      }
      // A first pass only — the user reviews/corrects this before it's
      // actually saved, via the same consolidated Save button as everything else.
      lyricsBox.value = lyrics;
    });

    async function saveLyrics() {
      await fetch(`/api/music/${albumId}/tracks/${track.id}/lyrics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: lyricsBox.value }),
      });
    }

    const trackThoughtsEditor = createThoughtsEditor({
      container: trackThoughtsEl,
      getThoughts: () => track.thoughts,
      dateInput: newTrackThoughtDateEl,
      textInput: newTrackThoughtTextEl,
      addBtn: addTrackThoughtBtn,
      onChange: saveTrack,
    });

    async function saveTrack() {
      await putTrack(albumId, track.id, track);
    }

    // One consolidated Save for the whole track — alternative title, link,
    // credits, and lyrics — rather than a separate button per field group.
    trackSaveBtn.addEventListener("click", async () => {
      if (!titleInput.hidden && titleInput.value.trim()) {
        track.title = titleInput.value.trim();
      }
      track.english_title = englishTitleInput.value;
      track.show_english_title = showEnglishTitleCheckbox.checked;
      track.link = linkInput.value;
      track.duration = durationInput.value;
      track.writers = writersInput.value;
      track.composers = composersInput.value;
      track.producers = producersInput.value;
      track.featuring = featuringInput.value;
      track.label = labelInput.value;
      await Promise.all([saveTrack(), saveLyrics()]);
      track.lyrics = lyricsBox.value;
      // Back to view mode, showing whatever title just got saved.
      titleDisplay.textContent = track.title;
      titleInput.hidden = true;
      titleView.hidden = false;
      // The collapsed summary reflects the toggle immediately, without a full re-fetch.
      summary.querySelector(".ep-name").textContent = pickDisplayTitle(track) || "(untitled)";
    });

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
      await Promise.all(changed.map((t) => putTrack(albumId, t.id, t)));
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
      loadAlbums();
      favoritesPanel.refresh();
    },
    openItem: (id) => selectAlbum(id),
    openTrack: (albumId, trackId) => openFavoriteTrack(packTrackId(albumId, trackId)),
    isDirty: () => isDirty(),
  };

  loadAlbums();
})();
