(function () {
  const browseEl = document.getElementById("music-browse");
  const detailEl = document.getElementById("music-detail");
  const addBtn = document.getElementById("add-album-btn");
  const backBtn = document.getElementById("music-back-btn");
  const collectionEl = document.getElementById("music-collection");

  const form = document.getElementById("album-form");
  const idEl = document.getElementById("album-id");
  const titleEl = document.getElementById("album-title");
  const englishTitleEl = document.getElementById("album-english-title");
  const showEnglishTitleEl = document.getElementById("album-show-english-title");
  const artistEl = document.getElementById("album-artist");
  const yearEl = document.getElementById("album-year");
  const releaseTypeEl = document.getElementById("album-release-type");
  const coverEl = document.getElementById("album-cover");
  const coverPreviewEl = document.getElementById("album-cover-preview");
  const coverUploadEl = document.getElementById("album-cover-upload");
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

  let thoughts = [];
  let tags = [];
  let favorite = false;
  let currentAlbumId = null;
  let currentTracks = [];
  let draggingTrackId = null;

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

  async function setAlbumFavorite(id, value) {
    const full = await fetch(`/api/music/${id}`).then((r) => r.json());
    full.favorite = value;
    await fetch(`/api/music/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(full),
    });
  }

  const favoritesPanel = createFavoritesPanel({
    container: document.getElementById("music-favorites"),
    fetchAll: () => fetch("/api/music").then((r) => r.json()),
    toItem: (a) => ({ id: a.id, title: pickDisplayTitle(a), subtitle: a.artist, cover: a.cover, favorite: a.favorite }),
    setFavorite: setAlbumFavorite,
    onOpen: (id) => selectAlbum(id),
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
    titleEl.value = "";
    englishTitleEl.value = "";
    showEnglishTitleEl.checked = false;
    artistEl.value = "";
    yearEl.value = "";
    releaseTypeEl.value = "album";
    coverEl.value = "";
    notesEl.value = "";
    notesEditor.reset();
    thoughts = [];
    tags = [];
    favorite = false;
    thoughtsEditor.render();
    renderTags();
    updateCoverPreview();
    deleteBtn.hidden = true;
    tracksPanel.hidden = true;
    newTrackTitle.value = "";
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
    // lyrics/thoughts/credits/link always stay attached to the track that owns
    // them. Every field TrackIn knows about must be re-sent here, or a reorder
    // would silently reset whatever's missing back to its default.
    await Promise.all(
      currentTracks.map((t) =>
        fetch(`/api/music/${albumId}/tracks/${t.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            track_number: t.track_number,
            title: t.title,
            english_title: t.english_title || "",
            show_english_title: !!t.show_english_title,
            link: t.link || "",
            writers: t.writers || "",
            producers: t.producers || "",
            featuring: t.featuring || "",
            label: t.label || "",
            thoughts: t.thoughts,
          }),
        })
      )
    );
  }

  function buildTrackElement(albumId, track) {
    const details = document.createElement("details");
    details.className = "track-item";

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

    const titleDisplay = document.createElement("div");
    titleDisplay.className = "track-title-display";
    titleDisplay.textContent = track.title;
    body.appendChild(titleDisplay);

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
    linkSection.innerHTML = `<h4>Link</h4><input type="text" class="track-link" placeholder="Link to the song or video (YouTube, Spotify, etc.)" />`;
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
    lyricsSection.innerHTML = `<h4>Lyrics</h4><textarea class="lyrics-box" placeholder="Paste lyrics, or upload a .txt file..."></textarea><label class="upload-label" style="margin-top: 0.5rem;">Upload .txt<input type="file" accept=".txt" hidden /></label>`;
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
    linkInput.value = track.link || "";

    const writersInput = creditsSection.querySelector(".track-writers");
    const producersInput = creditsSection.querySelector(".track-producers");
    const featuringInput = creditsSection.querySelector(".track-featuring");
    const labelInput = creditsSection.querySelector(".track-label");
    writersInput.value = track.writers || "";
    producersInput.value = track.producers || "";
    featuringInput.value = track.featuring || "";
    labelInput.value = track.label || "";

    const lyricsBox = lyricsSection.querySelector(".lyrics-box");
    lyricsBox.value = track.lyrics || "";
    const uploadInput = lyricsSection.querySelector('input[type="file"]');
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
      await fetch(`/api/music/${albumId}/tracks/${track.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_number: track.track_number,
          title: track.title,
          english_title: track.english_title || "",
          show_english_title: !!track.show_english_title,
          link: track.link || "",
          writers: track.writers || "",
          producers: track.producers || "",
          featuring: track.featuring || "",
          label: track.label || "",
          thoughts: track.thoughts,
        }),
      });
    }

    // One consolidated Save for the whole track — alternative title, link,
    // credits, and lyrics — rather than a separate button per field group.
    trackSaveBtn.addEventListener("click", async () => {
      track.english_title = englishTitleInput.value;
      track.show_english_title = showEnglishTitleCheckbox.checked;
      track.link = linkInput.value;
      track.writers = writersInput.value;
      track.producers = producersInput.value;
      track.featuring = featuringInput.value;
      track.label = labelInput.value;
      await Promise.all([saveTrack(), saveLyrics()]);
      track.lyrics = lyricsBox.value;
      // The collapsed summary reflects the toggle immediately, without a full re-fetch.
      summary.querySelector(".ep-name").textContent = pickDisplayTitle(track) || "(untitled)";
    });

    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete track "${track.title}"?`)) return;
      await fetch(`/api/music/${albumId}/tracks/${track.id}`, { method: "DELETE" });
      const i = currentTracks.findIndex((t) => t.id === track.id);
      if (i !== -1) currentTracks.splice(i, 1);
      details.remove();
    });

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
    titleEl.value = album.title || "";
    englishTitleEl.value = album.english_title || "";
    showEnglishTitleEl.checked = !!album.show_english_title;
    artistEl.value = album.artist || "";
    yearEl.value = album.year || "";
    releaseTypeEl.value = album.release_type || "album";
    coverEl.value = album.cover || "";
    notesEl.value = album.notes || "";
    notesEditor.load();
    thoughts = [...(album.thoughts || [])];
    tags = [...(album.tags || [])];
    favorite = !!album.favorite;
    thoughtsEditor.render();
    renderTags();
    updateCoverPreview();
    markClean();
  }

  async function selectAlbum(id) {
    const res = await fetch(`/api/music/${id}`);
    if (!res.ok) return;
    const album = await res.json();
    fillForm(album);
    deleteBtn.hidden = false;
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
      year: yearEl.value,
      release_type: releaseTypeEl.value,
      cover: coverEl.value,
      notes: notesEl.value,
      tags: tags,
      favorite: favorite,
      thoughts: thoughts,
    };
  }

  const { isDirty, markClean } = createDirtyTracker(buildPayload, { isVisible: () => !detailEl.hidden });

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
    isDirty: () => isDirty(),
  };

  loadAlbums();
})();
