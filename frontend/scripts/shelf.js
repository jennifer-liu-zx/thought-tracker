function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/** Picks which title a browse/list/swimlane view should show for an item that
 * has both an original `title` and an optional `english_title` + toggle. */
function pickDisplayTitle(item) {
  return item.show_english_title && item.english_title ? item.english_title : item.title;
}

/** Cover image, or a single-letter placeholder — shared by every place that
 * renders an item's cover (collection grid/list, favourites panel, home swimlanes). */
function buildCoverHtml(item) {
  return item.cover
    ? `<img src="${escapeHtml(item.cover)}" alt="" class="cover-img" />`
    : `<div class="cover-placeholder">${escapeHtml((item.title || "?")[0])}</div>`;
}

/**
 * Renders a "Favourites" sidebar panel into `container` (an <aside>): a list of
 * currently-favourited items, a "+" that opens a search box to add more (from
 * items already in this section — no separate favourites endpoint), and an "x"
 * on each thumbnail to remove it from favourites.
 *
 * fetchAll(): () => Promise<rawItem[]> — the section's existing list endpoint.
 * toItem(rawItem): maps a raw item to { id, title, subtitle, cover, favorite }.
 * setFavorite(id, value): (id, bool) => Promise<void> — persists the toggle.
 * onOpen(id): fires when a favourite thumbnail is clicked.
 */
function createFavoritesPanel({ container, fetchAll, toItem, setFavorite, onOpen }) {
  let allItems = [];
  let searchOpen = false;

  async function refresh() {
    const raw = await fetchAll();
    allItems = raw.map(toItem);
    render();
  }

  function render() {
    const favorites = allItems.filter((it) => it.favorite);

    container.innerHTML = `
      <div class="favorites-header">
        <h3>Favourites</h3>
        <button type="button" class="add-favorite-btn" aria-label="Add favourite">+</button>
      </div>
      <div class="favorite-search" ${searchOpen ? "" : "hidden"}>
        <input type="search" class="favorite-search-input" placeholder="Search to add..." />
        <div class="favorite-search-results"></div>
      </div>
      <div class="favorites-list"></div>
    `;

    const addBtn = container.querySelector(".add-favorite-btn");
    const searchPanel = container.querySelector(".favorite-search");
    const searchInput = container.querySelector(".favorite-search-input");
    const searchResults = container.querySelector(".favorite-search-results");
    const listEl = container.querySelector(".favorites-list");

    addBtn.addEventListener("click", () => {
      searchOpen = !searchOpen;
      searchPanel.hidden = !searchOpen;
      if (searchOpen) searchInput.focus();
    });

    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      searchResults.innerHTML = "";
      if (!q) return;
      const matches = allItems.filter((it) => !it.favorite && it.title.toLowerCase().includes(q)).slice(0, 8);
      for (const item of matches) {
        const row = document.createElement("div");
        row.className = "favorite-search-result";
        row.textContent = item.title;
        row.addEventListener("click", async () => {
          await setFavorite(item.id, true);
          searchInput.value = "";
          searchResults.innerHTML = "";
          await refresh();
        });
        searchResults.appendChild(row);
      }
    });

    if (favorites.length === 0) {
      listEl.innerHTML = `<p class="empty-msg">No favourites yet.</p>`;
      return;
    }

    for (const item of favorites) {
      const el = document.createElement("div");
      el.className = "favorite-item";
      el.innerHTML = `
        <div class="favorite-cover">
          ${buildCoverHtml(item)}
          <button type="button" class="remove-favorite-btn" aria-label="Remove favourite">&times;</button>
        </div>
        <div class="item-title">${escapeHtml(item.title)}</div>
      `;
      el.querySelector(".favorite-cover").addEventListener("click", (e) => {
        if (e.target.closest(".remove-favorite-btn")) return;
        onOpen(item.id);
      });
      el.querySelector(".remove-favorite-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        await setFavorite(item.id, false);
        await refresh();
      });
      listEl.appendChild(el);
    }
  }

  refresh();

  return { refresh };
}

/**
 * Renders a 5-star clickable rating widget into `container`.
 * Clicking the currently-set star clears the rating back to none.
 * onChange(value) fires with 1-5 or null.
 */
function createStarRating({ container, value, onChange }) {
  let current = value || null;

  function render() {
    container.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("span");
      star.className = "star" + (current && i <= current ? " filled" : "");
      star.textContent = current && i <= current ? "★" : "☆";
      star.setAttribute("role", "button");
      star.setAttribute("aria-label", `${i} star${i === 1 ? "" : "s"}`);
      star.addEventListener("click", () => {
        current = current === i ? null : i;
        render();
        onChange(current);
      });
      container.appendChild(star);
    }
  }

  render();

  return {
    setValue(v) {
      current = v || null;
      render();
    },
  };
}

/**
 * Renders an editable list of {date, text} thoughts into `container`, kept
 * sorted most-recent-first, with inline edit (not just delete), and a
 * "Show all" toggle once there are more than `collapseAt` entries.
 *
 * getThoughts(): () => thought[] — must return the caller's live, mutable
 * array (e.g. the outer `thoughts` variable, or `ep.thoughts` /
 * `track.thoughts`) — this sorts and splices that array in place rather than
 * replacing the reference, so callers don't need a setter.
 * dateInput/textInput/addBtn: the existing "new thought" form controls.
 * onChange (optional): fires after every add/edit/delete — e.g. episodes and
 * tracks persist immediately (PUT per change) instead of waiting for a form's
 * own Save button.
 */
function createThoughtsEditor({ container, getThoughts, dateInput, textInput, addBtn, onChange, collapseAt = 4 }) {
  let expanded = false;

  function render() {
    const thoughts = getThoughts();
    thoughts.sort((a, b) => b.date.localeCompare(a.date));
    container.innerHTML = "";

    const visible = expanded ? thoughts : thoughts.slice(0, collapseAt);
    for (const t of visible) {
      const row = document.createElement("div");
      row.className = "thought-item";
      row.innerHTML = `
        <div class="thought-view">
          <span class="thought-date">${escapeHtml(t.date)}</span>
          <span class="thought-text">${escapeHtml(t.text)}</span>
          <span class="thought-actions">
            <button type="button" class="thought-edit-btn" aria-label="edit">edit</button>
            <button type="button" class="thought-delete-btn" aria-label="remove">&times;</button>
          </span>
        </div>
        <div class="thought-edit-form" hidden>
          <input type="date" class="thought-edit-date" value="${escapeHtml(t.date)}" />
          <textarea class="thought-textarea thought-edit-text" rows="2">${escapeHtml(t.text)}</textarea>
          <div class="thought-edit-actions">
            <button type="button" class="thought-save-btn">Save</button>
            <button type="button" class="thought-cancel-btn">Cancel</button>
          </div>
        </div>
      `;

      const viewEl = row.querySelector(".thought-view");
      const editEl = row.querySelector(".thought-edit-form");

      row.querySelector(".thought-edit-btn").addEventListener("click", () => {
        viewEl.hidden = true;
        editEl.hidden = false;
      });
      row.querySelector(".thought-cancel-btn").addEventListener("click", () => {
        viewEl.hidden = false;
        editEl.hidden = true;
      });
      row.querySelector(".thought-save-btn").addEventListener("click", () => {
        const date = row.querySelector(".thought-edit-date").value;
        const text = row.querySelector(".thought-edit-text").value.trim();
        if (!date || !text) return;
        const idx = thoughts.indexOf(t);
        thoughts[idx] = { date, text };
        render();
        if (onChange) onChange();
      });
      row.querySelector(".thought-delete-btn").addEventListener("click", () => {
        if (!confirm("Delete this thought?")) return;
        thoughts.splice(thoughts.indexOf(t), 1);
        render();
        if (onChange) onChange();
      });

      container.appendChild(row);
    }

    if (thoughts.length > collapseAt) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "thoughts-toggle";
      toggle.textContent = expanded ? "Show fewer" : `Show all ${thoughts.length}`;
      toggle.addEventListener("click", () => {
        expanded = !expanded;
        render();
      });
      container.appendChild(toggle);
    }
  }

  addBtn.addEventListener("click", () => {
    const date = dateInput.value;
    const text = textInput.value.trim();
    if (!date || !text) return;
    getThoughts().push({ date, text });
    dateInput.value = "";
    textInput.value = "";
    render();
    if (onChange) onChange();
  });

  render();

  return { render };
}

/**
 * Tracks whether a form's current values differ from its last-saved state,
 * without needing per-field input listeners — dirtiness is computed on demand
 * from buildPayload(), the same shape every detail-view PUT/POST body uses.
 *
 * buildPayload(): () => object — the current form state.
 * isVisible (optional): () => bool — gates isDirty (e.g. only while the detail
 * view is shown, not the browse view); defaults to always true.
 */
function createDirtyTracker(buildPayload, { isVisible } = {}) {
  let savedSnapshot = "";
  return {
    isDirty() {
      return (isVisible ? isVisible() : true) && JSON.stringify(buildPayload()) !== savedSnapshot;
    },
    markClean() {
      savedSnapshot = JSON.stringify(buildPayload());
    },
  };
}

const DEFAULT_SORT_OPTIONS = [
  { value: "title-asc", label: "Title (A–Z)", cmp: (a, b) => a.title.localeCompare(b.title) },
  { value: "title-desc", label: "Title (Z–A)", cmp: (a, b) => b.title.localeCompare(a.title) },
];

/**
 * Renders a searchable, sortable, tag-filterable collection browser
 * (grid / list views) into `container`.
 *
 * items: [{ id, title, subtitle, cover, tags, keywords }]. `tags` drives the tag
 * filter dropdown; `keywords` is extra text (e.g. tags) folded into search matching
 * without necessarily being shown as the subtitle.
 *
 * onSelect(id) fires on item click. View/sort/filter choices persist per storageKey.
 * sortOptions (optional): [{ value, label, cmp(a, b) }] — defaults to title A-Z/Z-A.
 * coverAspect (optional): "portrait" (default, 2:3 — books/movies/shows) or "square" (albums).
 */
function createCollectionView({ container, storageKey, onSelect, sortOptions, coverAspect }) {
  const sorts = sortOptions && sortOptions.length ? sortOptions : DEFAULT_SORT_OPTIONS;

  if (coverAspect === "square") {
    container.classList.add("cover-aspect-square");
  }

  const validViews = ["grid", "list"];
  const storedView = localStorage.getItem(`view:${storageKey}`);

  const state = {
    items: [],
    query: "",
    view: validViews.includes(storedView) ? storedView : "grid",
    sort: localStorage.getItem(`sort:${storageKey}`) || sorts[0].value,
    tagFilter: "all",
  };

  function renderShell() {
    const sortOptionsHtml = sorts
      .map((s) => `<option value="${escapeHtml(s.value)}">${escapeHtml(s.label)}</option>`)
      .join("");

    container.innerHTML = `
      <div class="collection-toolbar">
        <div class="toolbar-left">
          <input type="search" class="search-box" placeholder="Search..." />
          <select class="tag-filter">
            <option value="all">All tags</option>
          </select>
          <select class="sort-select">${sortOptionsHtml}</select>
        </div>
        <div class="view-toggle">
          <button type="button" data-view="grid">Grid</button>
          <button type="button" data-view="list">List</button>
        </div>
      </div>
      <div class="collection"></div>
    `;

    const searchInput = container.querySelector(".search-box");
    searchInput.value = state.query;
    searchInput.addEventListener("input", (e) => {
      state.query = e.target.value;
      renderItems();
    });

    const sortSelect = container.querySelector(".sort-select");
    sortSelect.value = state.sort;
    sortSelect.addEventListener("change", (e) => {
      state.sort = e.target.value;
      localStorage.setItem(`sort:${storageKey}`, state.sort);
      renderItems();
    });

    const tagFilter = container.querySelector(".tag-filter");
    tagFilter.addEventListener("change", (e) => {
      state.tagFilter = e.target.value;
      renderItems();
    });

    container.querySelectorAll(".view-toggle button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === state.view);
      btn.addEventListener("click", () => {
        state.view = btn.dataset.view;
        localStorage.setItem(`view:${storageKey}`, state.view);
        container
          .querySelectorAll(".view-toggle button")
          .forEach((b) => b.classList.toggle("active", b === btn));
        renderItems();
      });
    });

    renderItems();
  }

  function updateTagFilterOptions() {
    const tagFilter = container.querySelector(".tag-filter");
    if (!tagFilter) return;
    const uniqueTags = [...new Set(state.items.flatMap((it) => it.tags || []))].sort();
    const previous = state.tagFilter;
    tagFilter.innerHTML =
      `<option value="all">All tags</option>` +
      uniqueTags.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    state.tagFilter = uniqueTags.includes(previous) ? previous : "all";
    tagFilter.value = state.tagFilter;
  }

  function renderItems() {
    const itemsEl = container.querySelector(".collection");
    itemsEl.className = `collection view-${state.view}`;
    itemsEl.innerHTML = "";

    const q = state.query.trim().toLowerCase();
    let filtered = !q
      ? state.items
      : state.items.filter((it) =>
          `${it.title} ${it.subtitle || ""} ${it.keywords || ""}`.toLowerCase().includes(q)
        );

    if (state.tagFilter !== "all") {
      filtered = filtered.filter((it) => (it.tags || []).includes(state.tagFilter));
    }

    const activeSort = sorts.find((s) => s.value === state.sort) || sorts[0];
    filtered = [...filtered].sort(activeSort.cmp);

    if (filtered.length === 0) {
      itemsEl.innerHTML = `<p class="empty-msg">No items${q || state.tagFilter !== "all" ? " match your search/filter" : " yet"}.</p>`;
      return;
    }

    for (const item of filtered) {
      const el = document.createElement("div");
      el.className = "item";
      el.dataset.id = item.id;
      el.innerHTML = `
        <div class="cover">${buildCoverHtml(item)}</div>
        <div class="item-info">
          <div class="item-title">${escapeHtml(item.title)}</div>
          ${item.subtitle ? `<div class="item-subtitle">${escapeHtml(item.subtitle)}</div>` : ""}
        </div>
      `;
      el.addEventListener("click", () => onSelect(item.id));
      itemsEl.appendChild(el);
    }
  }

  renderShell();

  return {
    setItems(items) {
      state.items = items;
      updateTagFilterOptions();
      renderItems();
    },
  };
}
