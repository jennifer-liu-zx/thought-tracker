/**
 * Shared tag-filter dropdown: a button that opens a searchable checkbox list
 * of tags, used to narrow a collection to items matching ANY selected tag.
 * Builds its own markup into `mount` (an empty container the caller owns) —
 * callers keep owning their own item list and filtering; this widget only
 * owns tag *selection* state and calls `onChange` whenever it changes.
 */
function createTagFilterWidget({ mount, onChange }) {
  mount.innerHTML = `
    <div class="tag-filter-wrap">
      <button type="button" class="tag-filter-btn">All tags</button>
      <div class="tag-filter-panel" hidden>
        <input type="text" class="tag-filter-search" placeholder="Search tags..." />
        <div class="tag-filter-options"></div>
      </div>
    </div>
  `;

  const btn = mount.querySelector(".tag-filter-btn");
  const panel = mount.querySelector(".tag-filter-panel");
  const searchInput = mount.querySelector(".tag-filter-search");
  const optionsEl = mount.querySelector(".tag-filter-options");

  const state = {
    tagFilters: [], // empty = no filter; otherwise match ANY selected tag
    tagFilterQuery: "", // narrows the checkbox list itself, separate from any main search box
    allTags: [],
    allExtraTags: [],
  };

  function updateButtonLabel() {
    if (state.tagFilters.length === 0) btn.textContent = "All tags";
    else if (state.tagFilters.length === 1) btn.textContent = state.tagFilters[0];
    else btn.textContent = `${state.tagFilters.length} tags`;
  }

  // Rebuilds just the checkbox list (not the search input above it), so
  // typing in the tag-filter search box doesn't lose input focus.
  function renderOptions() {
    const q = state.tagFilterQuery.trim().toLowerCase();
    // extraTags (e.g. cast/crew) only ever surface once there's a query to
    // narrow them — the unfiltered list would otherwise be swamped with names.
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
        updateButtonLabel();
        onChange();
      });
    });

    updateButtonLabel();
  }

  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) searchInput.focus();
  });

  searchInput.addEventListener("input", (e) => {
    state.tagFilterQuery = e.target.value;
    renderOptions();
  });
  searchInput.addEventListener("click", (e) => e.stopPropagation());

  return {
    setAllTags(tags, extraTags) {
      state.allTags = tags;
      state.allExtraTags = extraTags || [];
      state.tagFilters = state.tagFilters.filter(
        (t) => state.allTags.includes(t) || state.allExtraTags.includes(t)
      );
      renderOptions();
    },
    getSelected() {
      return state.tagFilters;
    },
  };
}
