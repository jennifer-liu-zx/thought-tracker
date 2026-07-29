(function () {
  const browseEl = document.getElementById("song-view-browse");
  const detailEl = document.getElementById("song-view-detail");
  const collectionEl = document.getElementById("song-view-collection");
  const addBtn = document.getElementById("add-song-btn");
  const addPanel = document.getElementById("song-view-add-panel");
  const addSearchInput = document.getElementById("song-view-add-search");
  const addResultsEl = document.getElementById("song-view-add-results");
  const backBtn = document.getElementById("song-view-back-btn");
  const albumLinkEl = document.getElementById("song-view-album-link");
  const fieldsEl = document.getElementById("song-view-fields");

  let allTracks = []; // every track across every album, from GET /api/music/tracks
  let addPanelOpen = false;

  const collectionView = createCollectionView({
    container: collectionEl,
    storageKey: "song-view",
    onSelect: selectSong,
    coverAspect: "square",
    pageSize: 40,
  });

  async function loadTracks() {
    allTracks = await fetch("/api/music/tracks").then((r) => r.json());
    collectionView.setItems(
      allTracks
        .filter((t) => t.starred)
        .map((t) => ({
          id: packTrackId(t.album_id, t.id),
          title: pickDisplayTitle(t),
          subtitle: `${t.album_artist} — ${t.album_title}`,
          cover: t.album_cover,
          tags: t.tags || [],
          keywords: [...(t.tags || []), t.english_title, t.album_title].join(" "),
        }))
    );
  }

  function showBrowse() {
    detailEl.hidden = true;
    browseEl.hidden = false;
  }

  function showDetail() {
    browseEl.hidden = true;
    detailEl.hidden = false;
  }

  async function selectSong(compositeId) {
    const { albumId, trackId } = unpackTrackId(compositeId);
    const album = await fetch(`/api/music/${albumId}`).then((r) => r.json());
    const track = album.tracks.find((t) => t.id === trackId);
    if (!track) return;

    albumLinkEl.innerHTML = `Part of: <a href="#" class="song-view-album-open">${escapeHtml(album.title)}</a>`;
    albumLinkEl.querySelector(".song-view-album-open").addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector('.nav-btn[data-section="music"]').click();
      document.querySelector('.subnav-btn[data-sub="music"]').click();
      window.Diary.music.openTrack(albumId, trackId);
    });

    createTrackFieldsEditor({
      container: fieldsEl,
      albumId,
      track,
      onSaved: () => loadTracks(),
    });

    showDetail();
  }

  addBtn.addEventListener("click", () => {
    addPanelOpen = !addPanelOpen;
    addPanel.hidden = !addPanelOpen;
    addResultsEl.innerHTML = "";
    addSearchInput.value = "";
    if (addPanelOpen) addSearchInput.focus();
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
        addPanelOpen = false;
        await loadTracks();
      });
      addResultsEl.appendChild(row);
    }
  });

  backBtn.addEventListener("click", () => {
    showBrowse();
    loadTracks();
  });

  window.Diary = window.Diary || {};
  window.Diary["song-view"] = {
    showBrowse: () => {
      showBrowse();
      loadTracks();
    },
    isDirty: () => false, // every edit here saves instantly (star/favourite toggles, tag chips, the track Save button) — nothing to lose on navigation
  };

  loadTracks();
})();
