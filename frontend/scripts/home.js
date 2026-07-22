(function () {
  const booksLane = document.getElementById("home-books-lane");
  const moviesLane = document.getElementById("home-movies-lane");
  const musicLane = document.getElementById("home-music-lane");

  function renderLane(container, items, onOpen) {
    container.innerHTML = "";
    if (items.length === 0) {
      container.innerHTML = `<p class="empty-msg">No favourites yet — add some from the Favourites panel on that section's page.</p>`;
      return;
    }
    for (const item of items) {
      const el = document.createElement("div");
      el.className = "shelf-item";
      const coverHtml = item.cover
        ? `<img src="${escapeHtml(item.cover)}" alt="" class="cover-img" />`
        : `<div class="cover-placeholder">${escapeHtml((item.title || "?")[0])}</div>`;
      el.innerHTML = `
        <div class="cover">${coverHtml}</div>
        <div class="item-info">
          <div class="item-title">${escapeHtml(item.title)}</div>
          ${item.subtitle ? `<div class="item-subtitle">${escapeHtml(item.subtitle)}</div>` : ""}
        </div>
      `;
      el.addEventListener("click", () => onOpen(item));
      container.appendChild(el);
    }
  }

  function switchToSection(sectionName) {
    document.querySelector(`.nav-btn[data-section="${sectionName}"]`)?.click();
  }

  function switchToSubsection(subName) {
    document.querySelector(`.subnav-btn[data-sub="${subName}"]`)?.click();
  }

  async function loadBooksLane() {
    const res = await fetch("/api/books");
    const books = await res.json();
    const favs = books
      .filter((b) => b.favorite)
      .map((b) => ({ id: b.id, title: pickDisplayTitle(b), subtitle: b.author, cover: b.cover }));
    renderLane(booksLane, favs, (item) => {
      switchToSection("books");
      window.Diary.books.openItem(item.id);
    });
  }

  async function loadMoviesLane() {
    const [moviesRes, showsRes] = await Promise.all([fetch("/api/movies"), fetch("/api/tv")]);
    const movies = await moviesRes.json();
    const shows = await showsRes.json();
    const favMovies = movies
      .filter((m) => m.favorite)
      .map((m) => ({ id: m.id, title: pickDisplayTitle(m), subtitle: m.year, cover: m.poster, kind: "movies" }));
    const favShows = shows
      .filter((s) => s.favorite)
      .map((s) => ({ id: s.id, title: pickDisplayTitle(s), subtitle: s.year, cover: s.poster, kind: "tv" }));
    renderLane(moviesLane, [...favMovies, ...favShows], (item) => {
      switchToSection("movies");
      switchToSubsection(item.kind);
      window.Diary[item.kind].openItem(item.id);
    });
  }

  async function loadMusicLane() {
    const res = await fetch("/api/music");
    const albums = await res.json();
    const favs = albums
      .filter((a) => a.favorite)
      .map((a) => ({ id: a.id, title: pickDisplayTitle(a), subtitle: a.artist, cover: a.cover }));
    renderLane(musicLane, favs, (item) => {
      switchToSection("music");
      window.Diary.music.openItem(item.id);
    });
  }

  function loadAllLanes() {
    loadBooksLane();
    loadMoviesLane();
    loadMusicLane();
  }

  window.Diary = window.Diary || {};
  window.Diary.home = {
    showBrowse: () => loadAllLanes(),
    isDirty: () => false,
  };

  loadAllLanes();
})();
