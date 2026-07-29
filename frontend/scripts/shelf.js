/** Simple pencil glyph (tip pointing to the lower-left) used for every "edit"
 * affordance — one filled silhouette with no dividing line across the body,
 * as an inline SVG rather than a Unicode character so it renders identically
 * across platforms/fonts. */
const PENCIL_ICON = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;

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

/**
 * Renders a 5-star clickable rating widget into `container`, supporting
 * half-star precision (click the left half of a star for X.5, the right
 * half for X) plus an explicit clear ("×") control — clicking the exact
 * current value also clears it, same as before.
 * onChange(value) fires with 0.5-5 in 0.5 steps, or null.
 */
function createStarRating({ container, value, onChange }) {
  let current = value || null;

  function render() {
    container.innerHTML = "";

    const starsEl = document.createElement("span");
    starsEl.className = "star-rating-stars";
    for (let i = 1; i <= 5; i++) {
      const filledFraction = current ? Math.max(0, Math.min(1, current - (i - 1))) : 0;

      const wrapper = document.createElement("span");
      wrapper.className = "star-wrapper";
      wrapper.setAttribute("role", "button");
      wrapper.setAttribute("aria-label", `${i} star${i === 1 ? "" : "s"}`);

      const back = document.createElement("span");
      back.className = "star-back";
      back.textContent = "★";

      const front = document.createElement("span");
      front.className = "star-front";
      front.textContent = "★";
      front.style.width = `${filledFraction * 100}%`;

      wrapper.append(back, front);
      wrapper.addEventListener("click", (e) => {
        const rect = wrapper.getBoundingClientRect();
        const clickedLeftHalf = e.clientX - rect.left < rect.width / 2;
        const newValue = clickedLeftHalf ? i - 0.5 : i;
        current = current === newValue ? null : newValue;
        render();
        onChange(current);
      });
      starsEl.appendChild(wrapper);
    }
    container.appendChild(starsEl);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "star-clear-btn";
    clearBtn.setAttribute("aria-label", "Clear rating");
    clearBtn.textContent = "×";
    clearBtn.hidden = !current;
    clearBtn.addEventListener("click", () => {
      current = null;
      render();
      onChange(current);
    });
    container.appendChild(clearBtn);
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
 * Renders a simple add/remove chip list (tags, cast, crew, ...) into
 * `container`, backed by a plain array of strings.
 * getItems(): () => string[] — must return the caller's live, mutable array.
 * textInput/addBtn: the existing "add new entry" form controls.
 */
function createChipListEditor({ container, getItems, textInput, addBtn, onChange }) {
  function render() {
    const items = getItems();
    container.innerHTML = "";
    items.forEach((item, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${escapeHtml(item)} <button type="button" aria-label="remove">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        items.splice(i, 1);
        render();
        onChange?.();
      });
      container.appendChild(chip);
    });
  }

  addBtn.addEventListener("click", () => {
    const value = textInput.value.trim();
    const items = getItems();
    if (!value || items.includes(value)) return;
    items.push(value);
    textInput.value = "";
    render();
    onChange?.();
  });

  render();

  return { render };
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
/**
 * Wraps a notes/review <textarea> with a view/edit toggle: once notes have
 * been saved, they render as plain read-only text with no box around them
 * and a pencil button to re-enter edit mode, instead of always showing the
 * textarea. The textarea itself stays the source of truth (buildPayload()
 * still just reads textarea.value) — this only controls which of the two
 * is visible.
 */
function createNotesEditor({ container, textarea }) {
  function renderView() {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "notes-view-text";
    p.textContent = textarea.value;
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "notes-edit-btn";
    editBtn.setAttribute("aria-label", "Edit notes");
    editBtn.innerHTML = PENCIL_ICON;
    editBtn.addEventListener("click", enterEditMode);
    container.append(p, editBtn);
  }

  function enterEditMode() {
    textarea.hidden = false;
    container.hidden = true;
  }

  function enterViewMode() {
    if (!textarea.value.trim()) {
      enterEditMode();
      return;
    }
    renderView();
    textarea.hidden = true;
    container.hidden = false;
  }

  enterEditMode();

  return {
    /** Call right after a successful save to collapse into view mode. */
    showSaved: enterViewMode,
    /** Call on resetForm()/new-entry to go back to a blank edit box. */
    reset: enterEditMode,
    /** Call after loading an existing record — view mode if it has notes. */
    load: enterViewMode,
  };
}

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
            <button type="button" class="thought-edit-btn" aria-label="Edit thought">${PENCIL_ICON}</button>
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
 * indicatorEl (optional): an element (e.g. the "Unsaved changes" label) whose
 * `hidden` is kept in sync with isDirty() via a lightweight poll — cheap
 * enough given how many different actions (add tag, add thought, delete...)
 * can mark the form dirty, and simpler than wiring every one of them by hand.
 */
function createDirtyTracker(buildPayload, { isVisible, indicatorEl } = {}) {
  let savedSnapshot = "";
  const tracker = {
    isDirty() {
      return (isVisible ? isVisible() : true) && JSON.stringify(buildPayload()) !== savedSnapshot;
    },
    markClean() {
      savedSnapshot = JSON.stringify(buildPayload());
      if (indicatorEl) indicatorEl.hidden = true;
    },
  };

  if (indicatorEl) {
    setInterval(() => {
      indicatorEl.hidden = !tracker.isDirty();
    }, 400);
  }

  return tracker;
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
function createCollectionView({ container, storageKey, onSelect, sortOptions, coverAspect }) {
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
    view: validViews.includes(storedView) ? storedView : "grid",
    sort: localStorage.getItem(`sort:${storageKey}`) || sorts[0].value,
    tagFilters: [], // empty = no filter; otherwise match ANY selected tag
    tagFilterQuery: "", // narrows the checkbox list itself, separate from the main search box
    allTags: [],
  };

  function renderShell() {
    container.innerHTML = `
      <div class="collection-toolbar">
        <div class="toolbar-left">
          <input type="search" class="search-box" placeholder="Search..." />
          <div class="tag-filter-wrap">
            <button type="button" class="tag-filter-btn">All tags</button>
            <div class="tag-filter-panel" hidden>
              <input type="text" class="tag-filter-search" placeholder="Search tags..." />
              <div class="tag-filter-options"></div>
            </div>
          </div>
          <div class="custom-select sort-select"></div>
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

    createCustomSelect({
      container: container.querySelector(".sort-select"),
      options: sorts,
      value: state.sort,
      onChange: (value) => {
        state.sort = value;
        localStorage.setItem(`sort:${storageKey}`, state.sort);
        renderItems();
      },
    });

    const tagFilterBtn = container.querySelector(".tag-filter-btn");
    tagFilterBtn.addEventListener("click", () => {
      const panel = container.querySelector(".tag-filter-panel");
      panel.hidden = !panel.hidden;
      if (!panel.hidden) container.querySelector(".tag-filter-search").focus();
    });

    const tagFilterSearch = container.querySelector(".tag-filter-search");
    tagFilterSearch.addEventListener("input", (e) => {
      state.tagFilterQuery = e.target.value;
      renderTagFilterOptions();
    });
    tagFilterSearch.addEventListener("click", (e) => e.stopPropagation());

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

  function updateTagFilterButtonLabel() {
    const btn = container.querySelector(".tag-filter-btn");
    if (!btn) return;
    if (state.tagFilters.length === 0) btn.textContent = "All tags";
    else if (state.tagFilters.length === 1) btn.textContent = state.tagFilters[0];
    else btn.textContent = `${state.tagFilters.length} tags`;
  }

  function updateTagFilterOptions() {
    state.allTags = [...new Set(state.items.flatMap((it) => it.tags || []))].sort();
    state.allExtraTags = [...new Set(state.items.flatMap((it) => it.extraTags || []))].sort();
    state.tagFilters = state.tagFilters.filter(
      (t) => state.allTags.includes(t) || state.allExtraTags.includes(t)
    );
    renderTagFilterOptions();
  }

  // Rebuilds just the checkbox list (not the search input above it), so
  // typing in the tag-filter search box doesn't lose input focus.
  function renderTagFilterOptions() {
    const optionsEl = container.querySelector(".tag-filter-options");
    if (!optionsEl) return;
    const q = state.tagFilterQuery.trim().toLowerCase();
    // extraTags (cast/crew) only ever surface once there's a query to narrow
    // them — the unfiltered list would otherwise be swamped with names.
    const visibleTags = q
      ? [...state.allTags, ...state.allExtraTags].filter((t) => t.toLowerCase().includes(q))
      : state.allTags;

    optionsEl.innerHTML = visibleTags.length
      ? visibleTags
          .map(
            (t) => `
              <label class="tag-filter-option">
                <input type="checkbox" value="${escapeHtml(t)}" ${state.tagFilters.includes(t) ? "checked" : ""} />
                ${escapeHtml(t)}
              </label>
            `
          )
          .join("")
      : `<p class="tag-filter-empty">No matching tags.</p>`;

    optionsEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const checkedHere = [...optionsEl.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
        // Preserve selections currently hidden by the search filter — only
        // the visible set should be replaced by what's checked right now.
        const keptHidden = state.tagFilters.filter((t) => !visibleTags.includes(t));
        state.tagFilters = [...keptHidden, ...checkedHere];
        updateTagFilterButtonLabel();
        renderItems();
      });
    });

    updateTagFilterButtonLabel();
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

    if (state.tagFilters.length > 0) {
      filtered = filtered.filter((it) =>
        [...(it.tags || []), ...(it.extraTags || [])].some((t) => state.tagFilters.includes(t))
      );
    }

    const activeSort = sorts.find((s) => s.value === state.sort) || sorts[0];
    filtered = [...filtered].sort(activeSort.cmp);

    if (filtered.length === 0) {
      itemsEl.innerHTML = `<p class="empty-msg">No items${q || state.tagFilters.length > 0 ? " match your search/filter" : " yet"}.</p>`;
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

/**
 * Makes a single-row textarea grow to fit long title text instead of
 * overflowing off-page — used where a title needs to wrap across lines
 * (e.g. journal entry titles) rather than staying a fixed-width <input>.
 * Enter is blocked since a title is conceptually one line; it should only
 * wrap because of width, never because the user pressed Enter.
 */
function enableAutoGrowTextarea(textarea) {
  function measure() {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
  // Deferred a frame: callers often set .value right after un-hiding the
  // pane it lives in, and measuring in that same tick can catch the box at
  // a stale (e.g. still-collapsed) width, producing a wildly wrong height.
  function resize() {
    requestAnimationFrame(measure);
  }
  textarea.addEventListener("input", measure);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault();
  });
  resize();
  return { resize };
}

/**
 * Makes a <details> element (with exactly one non-summary child, its
 * collapsible content wrapper) open/close with a slide animation instead of
 * the browser's instant show/hide — used for the season/episode accordions.
 * Intercepts the summary click so we control timing via the Web Animations
 * API rather than the native instant toggle.
 */
function enableSmoothDetails(details, { duration = 300 } = {}) {
  const summary = details.querySelector(":scope > summary");
  const content = details.querySelector(":scope > summary ~ *");
  if (!summary || !content) return;

  let animating = false;

  summary.addEventListener("click", (e) => {
    e.preventDefault();
    if (animating) return;
    if (details.open) collapse();
    else expand();
  });

  function expand() {
    details.open = true;
    const target = content.scrollHeight;
    content.style.height = "0px";
    content.style.overflow = "hidden";
    animating = true;
    requestAnimationFrame(() => {
      const animation = content.animate([{ height: "0px" }, { height: `${target}px` }], {
        duration,
        easing: "ease",
      });
      animation.onfinish = () => {
        content.style.height = "";
        content.style.overflow = "";
        animating = false;
      };
    });
  }

  function collapse() {
    const startHeight = content.scrollHeight;
    content.style.height = `${startHeight}px`;
    content.style.overflow = "hidden";
    animating = true;
    requestAnimationFrame(() => {
      const animation = content.animate([{ height: `${startHeight}px` }, { height: "0px" }], {
        duration,
        easing: "ease",
      });
      animation.onfinish = () => {
        details.open = false;
        content.style.height = "";
        content.style.overflow = "";
        animating = false;
      };
    });
  }
}
