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
      const matches = allItems
        .filter((it) => !it.favorite && `${it.title} ${it.keywords || ""}`.toLowerCase().includes(q))
        .slice(0, 8);
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

const DEFAULT_SORT_OPTIONS = [
  { value: "title-asc", label: "Title (A–Z)", cmp: (a, b) => a.title.localeCompare(b.title) },
  { value: "title-desc", label: "Title (Z–A)", cmp: (a, b) => b.title.localeCompare(a.title) },
];

/**
 * Renders a searchable, sortable, tag-filterable collection browser
 * (grid / list views) into `container`.
 *
 * items: [{ id, title, subtitle, cover, tags, extraTags, keywords }]. `tags` drives
 * the tag filter dropdown's default (always-visible) list; `extraTags` (e.g. cast/crew
 * names) stays out of that default list — too many to browse — but shows up as
 * matching filter options once the user types in the tag-filter search box, and
 * can still be selected to filter the collection like any other tag. `keywords` is
 * extra text folded into the main search box's matching without being shown as
 * the subtitle.
 *
 * onSelect(id) fires on item click. View/sort/filter choices persist per storageKey.
 * sortOptions (optional): [{ value, label, cmp(a, b) }] — defaults to title A-Z/Z-A.
 * coverAspect (optional): "portrait" (default, 2:3 — books/movies/shows), "square" (albums),
 * or "landscape" (16:9 — Live & Covers video thumbnails).
 */
function createCollectionView({
  container,
  storageKey,
  onSelect,
  sortOptions,
  coverAspect,
  pageSize,
  renderItem,
  forceView,
}) {
  const sorts = sortOptions && sortOptions.length ? sortOptions : DEFAULT_SORT_OPTIONS;

  if (coverAspect === "square") {
    container.classList.add("cover-aspect-square");
  } else if (coverAspect === "landscape") {
    container.classList.add("cover-aspect-landscape");
  }

  const validViews = ["grid", "list"];
  const storedView = localStorage.getItem(`view:${storageKey}`);

  const state = {
    items: [],
    query: "",
    view: forceView || (validViews.includes(storedView) ? storedView : "grid"),
    sort: localStorage.getItem(`sort:${storageKey}`) || sorts[0].value,
    page: 0,
  };

  let tagFilterWidget = null;

  function renderShell() {
    container.innerHTML = `
      <div class="collection-toolbar">
        <div class="toolbar-left">
          <input type="search" class="search-box" placeholder="Search..." />
          <div class="tag-filter-mount"></div>
          <div class="custom-select sort-select"></div>
        </div>
        ${
          forceView
            ? ""
            : `<div class="view-toggle">
                <button type="button" data-view="grid">Grid</button>
                <button type="button" data-view="list">List</button>
              </div>`
        }
      </div>
      <div class="collection"></div>
      <div class="pagination"></div>
    `;

    const searchInput = container.querySelector(".search-box");
    searchInput.value = state.query;
    searchInput.addEventListener("input", (e) => {
      state.query = e.target.value;
      state.page = 0;
      renderItems();
    });

    createCustomSelect({
      container: container.querySelector(".sort-select"),
      options: sorts,
      value: state.sort,
      onChange: (value) => {
        state.sort = value;
        localStorage.setItem(`sort:${storageKey}`, state.sort);
        state.page = 0;
        renderItems();
      },
    });

    tagFilterWidget = createTagFilterWidget({
      mount: container.querySelector(".tag-filter-mount"),
      onChange: () => {
        state.page = 0;
        renderItems();
      },
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
    const allTags = [...new Set(state.items.flatMap((it) => it.tags || []))].sort();
    const allExtraTags = [...new Set(state.items.flatMap((it) => it.extraTags || []))].sort();
    tagFilterWidget.setAllTags(allTags, allExtraTags);
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

    const tagFilters = tagFilterWidget.getSelected();
    if (tagFilters.length > 0) {
      filtered = filtered.filter((it) =>
        [...(it.tags || []), ...(it.extraTags || [])].some((t) => tagFilters.includes(t))
      );
    }

    const activeSort = sorts.find((s) => s.value === state.sort) || sorts[0];
    filtered = [...filtered].sort(activeSort.cmp);

    if (filtered.length === 0) {
      itemsEl.innerHTML = `<p class="empty-msg">No items${q || tagFilters.length > 0 ? " match your search/filter" : " yet"}.</p>`;
      renderPagination(0);
      return;
    }

    const totalPages = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
    state.page = Math.min(state.page, totalPages - 1);
    const pageItems = pageSize ? filtered.slice(state.page * pageSize, (state.page + 1) * pageSize) : filtered;

    for (const item of pageItems) {
      if (renderItem) {
        // Custom rows are fully self-contained — they wire their own click
        // behavior (e.g. a native <details> expand plus separate star/link
        // sub-clicks), rather than the whole-row-click-to-onSelect below.
        itemsEl.appendChild(renderItem(item, onSelect));
        continue;
      }
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

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const paginationEl = container.querySelector(".pagination");
    if (!paginationEl) return;
    if (!pageSize || totalPages <= 1) {
      paginationEl.innerHTML = "";
      return;
    }
    paginationEl.innerHTML = `
      <button type="button" class="pagination-prev" aria-label="Previous page" ${state.page === 0 ? "disabled" : ""}>&larr;</button>
      <span class="pagination-label">Page ${state.page + 1} of ${totalPages}</span>
      <button type="button" class="pagination-next" aria-label="Next page" ${state.page >= totalPages - 1 ? "disabled" : ""}>&rarr;</button>
    `;
    paginationEl.querySelector(".pagination-prev").addEventListener("click", () => {
      state.page = Math.max(0, state.page - 1);
      renderItems();
    });
    paginationEl.querySelector(".pagination-next").addEventListener("click", () => {
      state.page = Math.min(totalPages - 1, state.page + 1);
      renderItems();
    });
  }

  renderShell();

  return {
    setItems(items) {
      state.items = items;
      state.page = 0;
      updateTagFilterOptions();
      renderItems();
    },
  };
}

/**
 * A single-choice dropdown styled to match the site's own look, in place of
 * a native <select> — browsers render an open <select>'s option list as
 * OS-level chrome that CSS cannot restyle or reposition, so it always looks
 * like a foreign control dropped onto the page. `options` is a list of
 * {value, label}. Mimics the bit of <select>'s surface callers need
 * (get/set value, change callback) since it isn't a real <select> element.
 */
function createCustomSelect({ container, options, value, onChange }) {
  let current = value;

  function labelFor(v) {
    const opt = options.find((o) => o.value === v);
    return opt ? opt.label : "";
  }

  function render() {
    container.innerHTML = `
      <button type="button" class="custom-select-btn">${escapeHtml(labelFor(current))}</button>
      <div class="custom-select-panel" hidden>
        ${options
          .map(
            (o) =>
              `<div class="custom-select-option${o.value === current ? " active" : ""}" data-value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</div>`
          )
          .join("")}
      </div>
    `;

    const btn = container.querySelector(".custom-select-btn");
    const panel = container.querySelector(".custom-select-panel");

    btn.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
    });

    panel.querySelectorAll(".custom-select-option").forEach((el) => {
      el.addEventListener("click", () => {
        current = el.dataset.value;
        render();
        onChange(current);
      });
    });
  }

  render();

  return {
    getValue: () => current,
    setValue: (v) => {
      current = v;
      render();
    },
  };
}
