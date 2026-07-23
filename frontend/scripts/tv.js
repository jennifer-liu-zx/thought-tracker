(function () {
  const browseEl = document.getElementById("tv-browse");
  const detailEl = document.getElementById("tv-detail");
  const addBtn = document.getElementById("add-show-btn");
  const backBtn = document.getElementById("tv-back-btn");
  const collectionEl = document.getElementById("tv-collection");

  const searchPanel = document.getElementById("show-search-panel");
  const searchInput = document.getElementById("show-search-input");
  const searchResultsEl = document.getElementById("show-search-results");

  const form = document.getElementById("show-form");
  const idEl = document.getElementById("show-id");
  const titleEl = document.getElementById("show-title");
  const englishTitleEl = document.getElementById("show-english-title");
  const showEnglishTitleEl = document.getElementById("show-show-english-title");
  const yearEl = document.getElementById("show-year");
  const coverEl = document.getElementById("show-cover");
  const coverPreviewEl = document.getElementById("show-cover-preview");
  const coverUploadEl = document.getElementById("show-cover-upload");
  const notesEl = document.getElementById("show-notes");
  const thoughtsEl = document.getElementById("show-thoughts");
  const newThoughtDateEl = document.getElementById("new-show-thought-date");
  const newThoughtTextEl = document.getElementById("new-show-thought-text");
  const addThoughtBtn = document.getElementById("add-show-thought-btn");
  const tagsEl = document.getElementById("show-tags");
  const newTagTextEl = document.getElementById("new-show-tag-text");
  const addTagBtn = document.getElementById("add-show-tag-btn");
  const castEl = document.getElementById("show-cast");
  const newCastTextEl = document.getElementById("new-show-cast-text");
  const addCastBtn = document.getElementById("add-show-cast-btn");
  const crewEl = document.getElementById("show-crew");
  const newCrewTextEl = document.getElementById("new-show-crew-text");
  const addCrewBtn = document.getElementById("add-show-crew-btn");
  const deleteBtn = document.getElementById("show-delete-btn");

  const episodesPanel = document.getElementById("episodes-panel");
  const episodesListEl = document.getElementById("episodes-list");
  const importSeasonNumberEl = document.getElementById("import-season-number");
  const importSeasonBtn = document.getElementById("import-season-btn");
  const manualEpSeason = document.getElementById("manual-ep-season");
  const manualEpEpisode = document.getElementById("manual-ep-episode");
  const manualEpName = document.getElementById("manual-ep-name");
  const manualEpAirdate = document.getElementById("manual-ep-airdate");
  const manualEpSaveBtn = document.getElementById("manual-ep-save-btn");

  let thoughts = [];
  let tags = [];
  let cast = [];
  let crew = [];
  let favorite = false;
  let searchDebounce = null;
  let tmdbId = null;

  const collectionView = createCollectionView({
    container: collectionEl,
    storageKey: "tv",
    onSelect: selectShow,
    sortOptions: [
      { value: "title-asc", label: "Title (A–Z)", cmp: (a, b) => a.title.localeCompare(b.title) },
      { value: "title-desc", label: "Title (Z–A)", cmp: (a, b) => b.title.localeCompare(a.title) },
      { value: "year-desc", label: "Year (Newest)", cmp: (a, b) => (b.year || "").localeCompare(a.year || "") },
      { value: "year-asc", label: "Year (Oldest)", cmp: (a, b) => (a.year || "").localeCompare(b.year || "") },
    ],
  });

  async function setShowFavorite(id, value) {
    const full = await fetch(`/api/tv/${id}`).then((r) => r.json());
    full.favorite = value;
    await fetch(`/api/tv/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(full),
    });
  }

  const favoritesPanel = createFavoritesPanel({
    container: document.getElementById("tv-favorites"),
    fetchAll: () => fetch("/api/tv").then((r) => r.json()),
    toItem: (s) => ({ id: s.id, title: pickDisplayTitle(s), subtitle: s.year, cover: s.poster, favorite: s.favorite }),
    setFavorite: setShowFavorite,
    onOpen: (id) => selectShow(id),
  });

  async function loadShows() {
    const res = await fetch("/api/tv");
    const shows = await res.json();
    collectionView.setItems(
      shows.map((s) => ({
        id: s.id,
        title: pickDisplayTitle(s),
        subtitle: `${s.year || ""}${s.year ? " · " : ""}${s.episode_count} episode${s.episode_count === 1 ? "" : "s"}`,
        cover: s.poster,
        year: s.year,
        tags: [...(s.tags || []), ...(s.cast || []), ...(s.crew || [])],
        keywords: [...(s.tags || []), ...(s.cast || []), ...(s.crew || []), s.title, s.english_title].join(" "),
      }))
    );
  }

  function updateCoverPreview() {
    coverPreviewEl.innerHTML = coverEl.value
      ? `<img src="${coverEl.value}" alt="" />`
      : "no poster";
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

  const castEditor = createChipListEditor({
    container: castEl,
    getItems: () => cast,
    textInput: newCastTextEl,
    addBtn: addCastBtn,
  });

  const crewEditor = createChipListEditor({
    container: crewEl,
    getItems: () => crew,
    textInput: newCrewTextEl,
    addBtn: addCrewBtn,
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
    yearEl.value = "";
    coverEl.value = "";
    notesEl.value = "";
    notesEditor.reset();
    tmdbId = null;
    thoughts = [];
    tags = [];
    cast = [];
    crew = [];
    favorite = false;
    thoughtsEditor.render();
    renderTags();
    castEditor.render();
    crewEditor.render();
    updateCoverPreview();
    deleteBtn.hidden = true;
    searchPanel.hidden = false;
    searchInput.value = "";
    searchResultsEl.innerHTML = "";
    episodesPanel.hidden = true;
    markClean();
  }

  // ---- Episodes rendering ----

  function buildEpisodeElement(showId, ep) {
    const details = document.createElement("details");
    details.className = "episode-item";

    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="ep-num">E${String(ep.episode).padStart(2, "0")}</span><span class="ep-name">${ep.name || "(untitled)"}</span><span class="ep-air-date">${ep.air_date || ""}</span>`;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "episode-body";

    const watchSection = document.createElement("div");
    watchSection.className = "mini-section";
    watchSection.innerHTML = `<h4>Watch dates</h4><div class="chip-list ep-watch-dates"></div><div class="add-row"><input type="date" class="ep-new-watch-date" /><button type="button" class="ep-add-watch-date-btn">+ Add date</button></div>`;
    body.appendChild(watchSection);

    const thoughtsSection = document.createElement("div");
    thoughtsSection.className = "mini-section";
    thoughtsSection.innerHTML = `<h4>Thoughts</h4><div class="thoughts-list ep-thoughts"></div><div class="add-row"><input type="date" class="ep-new-thought-date" /><textarea class="thought-textarea ep-new-thought-text" placeholder="New thought..." rows="2"></textarea><button type="button" class="ep-add-thought-btn">+ Add thought</button></div>`;
    body.appendChild(thoughtsSection);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "danger";
    delBtn.textContent = "Delete episode";
    body.appendChild(delBtn);

    details.appendChild(body);

    const watchDatesEl = watchSection.querySelector(".ep-watch-dates");
    const newWatchDateEl = watchSection.querySelector(".ep-new-watch-date");
    const addWatchDateBtn = watchSection.querySelector(".ep-add-watch-date-btn");
    const epThoughtsEl = thoughtsSection.querySelector(".ep-thoughts");
    const newEpThoughtDateEl = thoughtsSection.querySelector(".ep-new-thought-date");
    const newEpThoughtTextEl = thoughtsSection.querySelector(".ep-new-thought-text");
    const addEpThoughtBtn = thoughtsSection.querySelector(".ep-add-thought-btn");

    function renderWatchDates() {
      watchDatesEl.innerHTML = "";
      ep.watch_dates.forEach((date, i) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `${date} <button type="button" aria-label="remove">&times;</button>`;
        chip.querySelector("button").addEventListener("click", () => {
          ep.watch_dates.splice(i, 1);
          renderWatchDates();
          saveEpisode();
        });
        watchDatesEl.appendChild(chip);
      });
    }

    const epThoughtsEditor = createThoughtsEditor({
      container: epThoughtsEl,
      getThoughts: () => ep.thoughts,
      dateInput: newEpThoughtDateEl,
      textInput: newEpThoughtTextEl,
      addBtn: addEpThoughtBtn,
      onChange: saveEpisode,
    });

    async function saveEpisode() {
      await fetch(`/api/tv/${showId}/episodes/${ep.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: ep.season,
          episode: ep.episode,
          name: ep.name,
          air_date: ep.air_date,
          watch_dates: ep.watch_dates,
          thoughts: ep.thoughts,
        }),
      });
    }

    addWatchDateBtn.addEventListener("click", () => {
      const date = newWatchDateEl.value;
      if (!date || ep.watch_dates.includes(date)) return;
      ep.watch_dates.push(date);
      ep.watch_dates.sort();
      newWatchDateEl.value = "";
      renderWatchDates();
      saveEpisode();
    });

    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete episode ${ep.id}?`)) return;
      await fetch(`/api/tv/${showId}/episodes/${ep.id}`, { method: "DELETE" });
      details.remove();
    });

    renderWatchDates();
    enableSmoothDetails(details);

    return details;
  }

  function renderEpisodes(showId, episodes) {
    episodesListEl.innerHTML = "";
    const bySeason = new Map();
    for (const ep of episodes) {
      if (!bySeason.has(ep.season)) bySeason.set(ep.season, []);
      bySeason.get(ep.season).push(ep);
    }
    const seasonNumbers = [...bySeason.keys()].sort((a, b) => a - b);
    if (seasonNumbers.length === 0) {
      episodesListEl.innerHTML = `<p class="empty-msg">No episodes yet.</p>`;
      return;
    }
    for (const seasonNum of seasonNumbers) {
      const eps = bySeason.get(seasonNum);
      const seasonDetails = document.createElement("details");
      seasonDetails.className = "season-group";
      seasonDetails.open = true;
      const summary = document.createElement("summary");
      summary.innerHTML = `Season ${String(seasonNum).padStart(2, "0")} <span class="season-count">(${eps.length} episode${eps.length === 1 ? "" : "s"})</span>`;
      seasonDetails.appendChild(summary);
      const container = document.createElement("div");
      container.className = "episodes-in-season";
      for (const ep of eps) {
        container.appendChild(buildEpisodeElement(showId, ep));
      }
      seasonDetails.appendChild(container);
      episodesListEl.appendChild(seasonDetails);
      enableSmoothDetails(seasonDetails);
    }
  }

  function fillForm(show) {
    idEl.value = show.id;
    titleEl.value = show.title || "";
    englishTitleEl.value = show.english_title || "";
    showEnglishTitleEl.checked = !!show.show_english_title;
    yearEl.value = show.year || "";
    coverEl.value = show.poster || "";
    notesEl.value = show.notes || "";
    notesEditor.load();
    tmdbId = show.tmdb_id || null;
    thoughts = [...(show.thoughts || [])];
    tags = [...(show.tags || [])];
    cast = [...(show.cast || [])];
    crew = [...(show.crew || [])];
    favorite = !!show.favorite;
    thoughtsEditor.render();
    renderTags();
    castEditor.render();
    crewEditor.render();
    updateCoverPreview();
    markClean();
  }

  async function selectShow(id) {
    const res = await fetch(`/api/tv/${id}`);
    if (!res.ok) return;
    const show = await res.json();
    fillForm(show);
    deleteBtn.hidden = false;
    searchPanel.hidden = true;
    episodesPanel.hidden = false;
    renderEpisodes(show.id, show.episodes || []);
    showDetail();
  }

  addBtn.addEventListener("click", () => {
    resetForm();
    showDetail();
  });

  backBtn.addEventListener("click", () => {
    showBrowse();
    loadShows();
    favoritesPanel.refresh();
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    if (!q) {
      searchResultsEl.innerHTML = "";
      return;
    }
    searchDebounce = setTimeout(async () => {
      const res = await fetch(`/api/tv/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        searchResultsEl.innerHTML = `<p class="empty-msg">${err.detail || "Search unavailable."}</p>`;
        return;
      }
      const results = await res.json();
      searchResultsEl.innerHTML = "";
      for (const r of results) {
        const row = document.createElement("div");
        row.className = "search-result";
        const coverImg = r.poster ? `<img src="${r.poster}" alt="" />` : "<img alt=''/>";
        row.innerHTML = `${coverImg}<div><div class="result-title">${r.title}</div><div class="result-subtitle">${r.year}</div></div>`;
        row.addEventListener("click", () => {
          titleEl.value = r.title || "";
          yearEl.value = r.year || "";
          coverEl.value = r.poster || "";
          tmdbId = r.tmdb_id || null;
          updateCoverPreview();
          searchResultsEl.innerHTML = "";
          searchInput.value = r.title;
        });
        searchResultsEl.appendChild(row);
      }
    }, 300);
  });

  function buildPayload() {
    return {
      title: titleEl.value,
      english_title: englishTitleEl.value,
      show_english_title: showEnglishTitleEl.checked,
      year: yearEl.value,
      poster: coverEl.value,
      tmdb_id: tmdbId,
      notes: notesEl.value,
      tags: tags,
      cast: cast,
      crew: crew,
      favorite: favorite,
      thoughts: thoughts,
    };
  }

  const { isDirty, markClean } = createDirtyTracker(buildPayload, { isVisible: () => !detailEl.hidden });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    const id = idEl.value;
    const res = await fetch(id ? `/api/tv/${id}` : "/api/tv", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const saved = await res.json();
    await selectShow(saved.id);
    favoritesPanel.refresh();
  });

  deleteBtn.addEventListener("click", async () => {
    const id = idEl.value;
    if (!id || !confirm("Delete this show and all its episodes?")) return;
    await fetch(`/api/tv/${id}`, { method: "DELETE" });
    markClean();
    showBrowse();
    loadShows();
    favoritesPanel.refresh();
  });

  manualEpSaveBtn.addEventListener("click", async () => {
    const showId = idEl.value;
    const season = parseInt(manualEpSeason.value, 10);
    const episode = parseInt(manualEpEpisode.value, 10);
    if (!showId || !season || !episode) return;
    const episodeId = `s${String(season).padStart(2, "0")}e${String(episode).padStart(2, "0")}`;
    await fetch(`/api/tv/${showId}/episodes/${episodeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        season,
        episode,
        name: manualEpName.value,
        air_date: manualEpAirdate.value,
        watch_dates: [],
        thoughts: [],
      }),
    });
    // Keep the season, bump the episode number, and clear just the per-episode
    // fields — makes adding a whole season back-to-back a single repeated click.
    manualEpEpisode.value = episode + 1;
    manualEpName.value = "";
    manualEpAirdate.value = "";
    await selectShow(showId);
    manualEpName.focus();
  });

  importSeasonBtn.addEventListener("click", async () => {
    const showId = idEl.value;
    const seasonNumber = parseInt(importSeasonNumberEl.value, 10);
    if (!showId || !seasonNumber) return;
    const res = await fetch(`/api/tv/${showId}/import-season?season_number=${seasonNumber}`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Import failed.");
      return;
    }
    selectShow(showId);
  });

  window.Diary = window.Diary || {};
  window.Diary.tv = {
    showBrowse: () => {
      showBrowse();
      loadShows();
      favoritesPanel.refresh();
    },
    openItem: (id) => selectShow(id),
    isDirty: () => isDirty(),
  };

  loadShows();
})();
