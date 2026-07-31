(function () {
  const booksLane = document.getElementById("home-books-lane");
  const moviesLane = document.getElementById("home-movies-lane");
  const musicLane = document.getElementById("home-music-lane");

  const KIND_API = {
    books: "/api/books",
    movies: "/api/movies",
    tv: "/api/tv",
    music: "/api/music",
  };

  function sortByFavoriteOrder(items) {
    // Items without a saved position (never dragged yet) fall back to
    // alphabetical and sort after anything that HAS been manually ordered.
    return [...items].sort((a, b) => {
      const ao = a.favorite_order;
      const bo = b.favorite_order;
      if (ao == null && bo == null) return a.title.localeCompare(b.title);
      if (ao == null) return 1;
      if (bo == null) return -1;
      return ao - bo;
    });
  }

  // Music favourites are individual songs, not albums, so a favourited item
  // lives at a nested endpoint (/api/music/{albumId}/tracks/{trackId})
  // rather than the flat /api/music/{id} every other kind uses.
  async function persistTrackOrder(item, index) {
    const album = await fetch(`/api/music/${item.albumId}`).then((r) => r.json());
    const track = album.tracks.find((t) => t.id === item.trackId);
    if (!track) return;
    track.favorite_order = index;
    await putTrack(item.albumId, track);
  }

  async function persistOrder(orderedItems) {
    // Re-numbers every item in this lane and writes each one back — same
    // "full re-send" approach as track/episode drag-reorder, since these
    // are plain PUTs against each item's own update endpoint rather than a
    // dedicated reorder route.
    await Promise.all(
      orderedItems.map(async (item, index) => {
        if (item.favorite_order === index) return; // unchanged, skip the round-trip
        if (item.kind === "music_track") {
          await persistTrackOrder(item, index);
        } else {
          const base = KIND_API[item.kind];
          const full = await fetch(`${base}/${item.id}`).then((r) => r.json());
          full.favorite_order = index;
          await fetch(`${base}/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(full),
          });
        }
        item.favorite_order = index;
      })
    );
  }

  /**
   * Pointer-driven drag-to-reorder for a row of .shelf-item elements, with a
   * FLIP animation so siblings slide out of the way as the dragged item
   * passes over them (the dragged item itself follows the pointer directly,
   * rather than the browser's native drag ghost image).
   */
  function makeLaneSortable(container, items, onOrderChange) {
    let dragEl = null;
    let placeholder = null;
    let pointerOffsetX = 0;
    let pointerOffsetY = 0;
    let startedDrag = false;
    let downX = 0;
    let downY = 0;

    function itemEls() {
      return [...container.querySelectorAll(":scope > .shelf-item")];
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      const el = e.target.closest(".shelf-item");
      if (!el || el.parentElement !== container) return;

      downX = e.clientX;
      downY = e.clientY;
      const rect = el.getBoundingClientRect();
      pointerOffsetX = e.clientX - rect.left;
      pointerOffsetY = e.clientY - rect.top;
      startedDrag = false;

      const candidate = el;

      function beginDrag() {
        startedDrag = true;
        dragEl = candidate;
        dragEl.setPointerCapture?.(e.pointerId);

        placeholder = document.createElement("div");
        placeholder.className = "shelf-item shelf-item-placeholder";
        placeholder.style.width = `${rect.width}px`;
        placeholder.style.height = `${rect.height}px`;
        dragEl.after(placeholder);

        dragEl.classList.add("dragging");
        dragEl.style.position = "fixed";
        dragEl.style.left = `${rect.left}px`;
        dragEl.style.top = `${rect.top}px`;
        dragEl.style.width = `${rect.width}px`;
        dragEl.style.zIndex = "50";
        dragEl.style.pointerEvents = "none";
      }

      function onMove(ev) {
        if (!startedDrag) {
          if (Math.hypot(ev.clientX - downX, ev.clientY - downY) < 6) return;
          beginDrag();
        }

        dragEl.style.left = `${ev.clientX - pointerOffsetX}px`;
        dragEl.style.top = `${ev.clientY - pointerOffsetY}px`;

        // Find which sibling the pointer is currently over (horizontally,
        // since this is a horizontal shelf lane) and move the placeholder
        // there, FLIP-animating every real item that has to shift.
        const siblings = itemEls().filter((it) => it !== dragEl && it !== placeholder);
        let target = null;
        for (const sib of siblings) {
          const r = sib.getBoundingClientRect();
          if (ev.clientX < r.left + r.width / 2) {
            target = sib;
            break;
          }
        }

        if (target === placeholder.nextSibling) return; // already in the right slot
        if (target && target === placeholder) return;

        const before = new Map(itemEls().map((it) => [it, it.getBoundingClientRect()]));

        if (target) container.insertBefore(placeholder, target);
        else container.appendChild(placeholder);

        for (const it of itemEls()) {
          if (it === dragEl) continue;
          const from = before.get(it);
          const to = it.getBoundingClientRect();
          if (!from) continue;
          const dx = from.left - to.left;
          if (dx) {
            it.style.transition = "none";
            it.style.transform = `translateX(${dx}px)`;
            requestAnimationFrame(() => {
              it.style.transition = "transform 180ms ease";
              it.style.transform = "";
            });
          }
        }
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (!startedDrag) return;

        container.insertBefore(dragEl, placeholder);
        placeholder.remove();
        placeholder = null;

        dragEl.style.position = "";
        dragEl.style.left = "";
        dragEl.style.top = "";
        dragEl.style.width = "";
        dragEl.style.zIndex = "";
        dragEl.style.pointerEvents = "";
        dragEl.classList.remove("dragging");
        dragEl = null;

        const newOrderIds = itemEls().map((it) => it.dataset.id);
        const reordered = newOrderIds.map((id) => items.find((it) => String(it.id) === id));
        onOrderChange(reordered);
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }

    container.addEventListener("pointerdown", onPointerDown);
  }

  function renderLane(container, items, onOpen) {
    container.innerHTML = "";
    if (items.length === 0) {
      container.innerHTML = `<p class="empty-msg">No favourites yet — add some from the Favourites panel on that section's page.</p>`;
      return;
    }
    const sorted = sortByFavoriteOrder(items);
    for (const item of sorted) {
      const el = document.createElement("div");
      el.className = "shelf-item";
      el.dataset.id = String(item.id);
      el.innerHTML = `
        <div class="cover">${buildCoverHtml(item)}</div>
        <div class="item-info">
          <div class="item-title">${escapeHtml(item.title)}</div>
          ${item.subtitle ? `<div class="item-subtitle">${escapeHtml(item.subtitle)}</div>` : ""}
        </div>
      `;
      el.addEventListener("click", () => {
        if (el.classList.contains("dragging") || container.querySelector(".dragging")) return;
        onOpen(item);
      });
      container.appendChild(el);
    }
    makeLaneSortable(container, sorted, (reordered) => persistOrder(reordered));
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
      .map((b) => ({
        id: b.id,
        title: pickDisplayTitle(b),
        subtitle: b.author,
        cover: b.cover,
        favorite_order: b.favorite_order,
        kind: "books",
      }));
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
      .map((m) => ({
        id: m.id,
        title: pickDisplayTitle(m),
        subtitle: m.year,
        cover: m.poster,
        favorite_order: m.favorite_order,
        kind: "movies",
      }));
    const favShows = shows
      .filter((s) => s.favorite)
      .map((s) => ({
        id: s.id,
        title: pickDisplayTitle(s),
        subtitle: s.year,
        cover: s.poster,
        favorite_order: s.favorite_order,
        kind: "tv",
      }));
    renderLane(moviesLane, [...favMovies, ...favShows], (item) => {
      switchToSection("movies");
      switchToSubsection(item.kind);
      window.Diary[item.kind].openItem(item.id);
    });
  }

  async function loadMusicLane() {
    // Favourites here are individual songs (matching the Albums favourites
    // panel), not whole albums — so this reads the flattened tracks
    // endpoint rather than /api/music.
    const res = await fetch("/api/music/tracks");
    const tracks = await res.json();
    const favs = tracks
      .filter((t) => t.favorite)
      .map((t) => ({
        id: `${t.album_id}::${t.id}`,
        title: pickDisplayTitle(t),
        cover: t.album_cover,
        favorite_order: t.favorite_order,
        kind: "music_track",
        albumId: t.album_id,
        trackId: t.id,
      }));
    renderLane(musicLane, favs, (item) => {
      switchToSection("music");
      switchToSubsection("music");
      window.Diary.music.openTrack(item.albumId, item.trackId);
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
