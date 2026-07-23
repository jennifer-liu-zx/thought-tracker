(function () {
  const browseEl = document.getElementById("movies-browse");
  const detailEl = document.getElementById("movies-detail");
  const addBtn = document.getElementById("add-movie-btn");
  const backBtn = document.getElementById("movies-back-btn");
  const collectionEl = document.getElementById("movies-collection");

  const searchPanel = document.getElementById("movie-search-panel");
  const searchInput = document.getElementById("movie-search-input");
  const searchResultsEl = document.getElementById("movie-search-results");

  const form = document.getElementById("movie-form");
  const idEl = document.getElementById("movie-id");
  const titleEl = document.getElementById("movie-title");
  const englishTitleEl = document.getElementById("movie-english-title");
  const showEnglishTitleEl = document.getElementById("movie-show-english-title");
  const yearEl = document.getElementById("movie-year");
  const coverEl = document.getElementById("movie-cover");
  const coverPreviewEl = document.getElementById("movie-cover-preview");
  const coverUploadEl = document.getElementById("movie-cover-upload");
  const coverRemoveBtn = document.getElementById("movie-cover-remove-btn");
  const notesEl = document.getElementById("movie-notes");
  const watchDatesEl = document.getElementById("movie-watch-dates");
  const newWatchDateEl = document.getElementById("new-watch-date");
  const newWatchDateCinemaEl = document.getElementById("new-watch-date-cinema");
  const addWatchDateBtn = document.getElementById("add-watch-date-btn");
  const thoughtsEl = document.getElementById("movie-thoughts");
  const newThoughtDateEl = document.getElementById("new-movie-thought-date");
  const newThoughtTextEl = document.getElementById("new-movie-thought-text");
  const addThoughtBtn = document.getElementById("add-movie-thought-btn");
  const tagsEl = document.getElementById("movie-tags");
  const newTagTextEl = document.getElementById("new-movie-tag-text");
  const addTagBtn = document.getElementById("add-movie-tag-btn");
  const castEl = document.getElementById("movie-cast");
  const newCastTextEl = document.getElementById("new-movie-cast-text");
  const addCastBtn = document.getElementById("add-movie-cast-btn");
  const crewEl = document.getElementById("movie-crew");
  const newCrewTextEl = document.getElementById("new-movie-crew-text");
  const addCrewBtn = document.getElementById("add-movie-crew-btn");
  const deleteBtn = document.getElementById("movie-delete-btn");
  const ratingEl = document.getElementById("movie-rating");

  let watchDates = [];
  let thoughts = [];
  let tags = [];
  let cast = [];
  let crew = [];
  let rating = null;
  let favorite = false;
  let favoriteOrder = null;
  let searchDebounce = null;

  const ratingWidget = createStarRating({
    container: ratingEl,
    value: null,
    onChange: (v) => {
      rating = v;
    },
  });

  const collectionView = createCollectionView({
    container: collectionEl,
    storageKey: "movies",
    onSelect: selectMovie,
    sortOptions: [
      { value: "title-asc", label: "Title (A–Z)", cmp: (a, b) => a.title.localeCompare(b.title) },
      { value: "title-desc", label: "Title (Z–A)", cmp: (a, b) => b.title.localeCompare(a.title) },
      { value: "year-desc", label: "Year (Newest)", cmp: (a, b) => (b.year || "").localeCompare(a.year || "") },
      { value: "year-asc", label: "Year (Oldest)", cmp: (a, b) => (a.year || "").localeCompare(b.year || "") },
      { value: "rating-desc", label: "Rating (Highest)", cmp: (a, b) => (b.rating || 0) - (a.rating || 0) },
    ],
  });

  async function setMovieFavorite(id, value) {
    const full = await fetch(`/api/movies/${id}`).then((r) => r.json());
    full.favorite = value;
    await fetch(`/api/movies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(full),
    });
  }

  const favoritesPanel = createFavoritesPanel({
    container: document.getElementById("movies-favorites"),
    fetchAll: () => fetch("/api/movies").then((r) => r.json()),
    toItem: (m) => ({
      id: m.id,
      title: pickDisplayTitle(m),
      subtitle: m.year,
      cover: m.poster,
      favorite: m.favorite,
      keywords: m.english_title,
    }),
    setFavorite: setMovieFavorite,
    onOpen: (id) => selectMovie(id),
  });

  async function loadMovies() {
    const res = await fetch("/api/movies");
    const movies = await res.json();
    collectionView.setItems(
      movies.map((m) => ({
        id: m.id,
        title: pickDisplayTitle(m),
        subtitle: m.year,
        cover: m.poster,
        year: m.year,
        rating: m.rating,
        tags: m.tags || [],
        extraTags: [...(m.cast || []), ...(m.crew || [])], // hidden from the default tag list, but shows up once you search for a name
        keywords: [...(m.tags || []), ...(m.cast || []), ...(m.crew || []), m.title, m.english_title].join(" "),
      }))
    );
  }

  function updateCoverPreview() {
    coverPreviewEl.innerHTML = coverEl.value
      ? `<img src="${coverEl.value}" alt="" />`
      : "no poster";
  }

  function renderWatchDates() {
    watchDatesEl.innerHTML = "";
    watchDates.forEach((wd, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      const cinemaLabel = wd.cinema ? " (cinema)" : "";
      chip.innerHTML = `${escapeHtml(wd.date)}${cinemaLabel} <button type="button" aria-label="remove">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        watchDates.splice(i, 1);
        renderWatchDates();
      });
      watchDatesEl.appendChild(chip);
    });
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

  addWatchDateBtn.addEventListener("click", () => {
    const date = newWatchDateEl.value;
    if (!date || watchDates.some((wd) => wd.date === date)) return;
    watchDates.push({ date, cinema: newWatchDateCinemaEl.checked });
    watchDates.sort((a, b) => a.date.localeCompare(b.date));
    newWatchDateEl.value = "";
    newWatchDateCinemaEl.checked = false;
    renderWatchDates();
  });

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
    titleEl.value = "";
    englishTitleEl.value = "";
    showEnglishTitleEl.checked = false;
    yearEl.value = "";
    coverEl.value = "";
    notesEl.value = "";
    notesEditor.reset();
    watchDates = [];
    thoughts = [];
    tags = [];
    cast = [];
    crew = [];
    rating = null;
    ratingWidget.setValue(null);
    favorite = false;
    favoriteOrder = null;
    renderWatchDates();
    thoughtsEditor.render();
    renderTags();
    castEditor.render();
    crewEditor.render();
    updateCoverPreview();
    deleteBtn.hidden = true;
    searchPanel.hidden = false;
    searchInput.value = "";
    searchResultsEl.innerHTML = "";
    markClean();
  }

  function fillForm(movie) {
    idEl.value = movie.id;
    titleEl.value = movie.title || "";
    englishTitleEl.value = movie.english_title || "";
    showEnglishTitleEl.checked = !!movie.show_english_title;
    yearEl.value = movie.year || "";
    coverEl.value = movie.poster || "";
    notesEl.value = movie.notes || "";
    notesEditor.load();
    watchDates = [...(movie.watch_dates || [])];
    thoughts = [...(movie.thoughts || [])];
    tags = [...(movie.tags || [])];
    cast = [...(movie.cast || [])];
    crew = [...(movie.crew || [])];
    rating = movie.rating || null;
    ratingWidget.setValue(rating);
    favorite = !!movie.favorite;
    favoriteOrder = movie.favorite_order ?? null;
    renderWatchDates();
    thoughtsEditor.render();
    renderTags();
    castEditor.render();
    crewEditor.render();
    updateCoverPreview();
    markClean();
  }

  async function selectMovie(id) {
    const res = await fetch(`/api/movies/${id}`);
    if (!res.ok) return;
    const movie = await res.json();
    fillForm(movie);
    deleteBtn.hidden = false;
    searchPanel.hidden = true;
    showDetail();
  }

  addBtn.addEventListener("click", () => {
    resetForm();
    showDetail();
  });

  backBtn.addEventListener("click", () => {
    if (isDirty() && !confirm("You have unsaved changes. Leave without saving?")) return;
    showBrowse();
    loadMovies();
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    if (!q) {
      searchResultsEl.innerHTML = "";
      return;
    }
    searchDebounce = setTimeout(async () => {
      const res = await fetch(`/api/movies/search?q=${encodeURIComponent(q)}`);
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
      notes: notesEl.value,
      tags: tags,
      cast: cast,
      crew: crew,
      rating: rating,
      favorite: favorite,
      favorite_order: favoriteOrder,
      watch_dates: watchDates,
      thoughts: thoughts,
    };
  }

  const { isDirty, markClean } = createDirtyTracker(buildPayload, {
    isVisible: () => !detailEl.hidden,
    indicatorEl: document.getElementById("movie-unsaved-indicator"),
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    const id = idEl.value;
    const res = await fetch(id ? `/api/movies/${id}` : "/api/movies", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    markClean();
    notesEditor.showSaved();
    showBrowse();
    loadMovies();
    favoritesPanel.refresh();
  });

  deleteBtn.addEventListener("click", async () => {
    const id = idEl.value;
    if (!id || !confirm("Delete this movie?")) return;
    await fetch(`/api/movies/${id}`, { method: "DELETE" });
    markClean();
    showBrowse();
    loadMovies();
    favoritesPanel.refresh();
  });

  window.Diary = window.Diary || {};
  window.Diary.movies = {
    showBrowse: () => {
      showBrowse();
      loadMovies();
      favoritesPanel.refresh();
    },
    openItem: (id) => selectMovie(id),
    isDirty: () => isDirty(),
  };

  loadMovies();
})();
