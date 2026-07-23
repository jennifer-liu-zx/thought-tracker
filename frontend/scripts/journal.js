const listEl = document.getElementById("journal-list");
const formEl = document.getElementById("journal-form");
const idEl = document.getElementById("entry-id");
const dateEl = document.getElementById("entry-date");
const titleEl = document.getElementById("entry-title");
const bodyEl = document.getElementById("entry-body");
const deleteBtn = document.getElementById("delete-btn");
const newEntryBtn = document.getElementById("new-entry-btn");
const unsavedIndicator = document.getElementById("unsaved-indicator");
const tagsEl = document.getElementById("entry-tags");
const newTagTextEl = document.getElementById("new-entry-tag-text");
const addTagBtn = document.getElementById("add-entry-tag-btn");

const searchInput = document.getElementById("journal-search-input");
const dateFromEl = document.getElementById("journal-filter-date-from");
const dateToEl = document.getElementById("journal-filter-date-to");
const tagFilterBtn = document.getElementById("journal-tag-filter-btn");
const tagFilterPanel = document.getElementById("journal-tag-filter-panel");
const tagFilterSearchEl = document.getElementById("journal-tag-filter-search");
const tagFilterOptionsEl = document.getElementById("journal-tag-filter-options");

const titleAutoGrow = enableAutoGrowTextarea(titleEl);

let tags = [];
let allEntries = [];
let allTags = [];
const filterState = { query: "", dateFrom: "", dateTo: "", tagFilters: [], tagFilterQuery: "" };

function buildPayload() {
  return { title: titleEl.value, date: dateEl.value, body: bodyEl.value, tags };
}

const { isDirty, markClean } = createDirtyTracker(buildPayload, { indicatorEl: unsavedIndicator });

const tagsEditor = createChipListEditor({
  container: tagsEl,
  getItems: () => tags,
  textInput: newTagTextEl,
  addBtn: addTagBtn,
});

function updateTagFilterButtonLabel() {
  if (filterState.tagFilters.length === 0) tagFilterBtn.textContent = "All tags";
  else if (filterState.tagFilters.length === 1) tagFilterBtn.textContent = filterState.tagFilters[0];
  else tagFilterBtn.textContent = `${filterState.tagFilters.length} tags`;
}

function renderTagFilterOptions() {
  const q = filterState.tagFilterQuery.trim().toLowerCase();
  const visibleTags = q ? allTags.filter((t) => t.toLowerCase().includes(q)) : allTags;

  tagFilterOptionsEl.innerHTML = visibleTags.length
    ? visibleTags
        .map(
          (t) => `
            <label class="tag-filter-option">
              <input type="checkbox" value="${escapeHtml(t)}" ${filterState.tagFilters.includes(t) ? "checked" : ""} />
              ${escapeHtml(t)}
            </label>
          `
        )
        .join("")
    : `<p class="tag-filter-empty">No matching tags.</p>`;

  tagFilterOptionsEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const checkedHere = [...tagFilterOptionsEl.querySelectorAll('input[type="checkbox"]:checked')].map(
        (c) => c.value
      );
      const keptHidden = filterState.tagFilters.filter((t) => !visibleTags.includes(t));
      filterState.tagFilters = [...keptHidden, ...checkedHere];
      updateTagFilterButtonLabel();
      renderList();
    });
  });

  updateTagFilterButtonLabel();
}

tagFilterBtn.addEventListener("click", () => {
  tagFilterPanel.hidden = !tagFilterPanel.hidden;
  if (!tagFilterPanel.hidden) tagFilterSearchEl.focus();
});

tagFilterSearchEl.addEventListener("input", (e) => {
  filterState.tagFilterQuery = e.target.value;
  renderTagFilterOptions();
});
tagFilterSearchEl.addEventListener("click", (e) => e.stopPropagation());

searchInput.addEventListener("input", (e) => {
  filterState.query = e.target.value;
  renderList();
});

dateFromEl.addEventListener("change", (e) => {
  filterState.dateFrom = e.target.value;
  renderList();
});

dateToEl.addEventListener("change", (e) => {
  filterState.dateTo = e.target.value;
  renderList();
});

async function loadEntries() {
  const res = await fetch("/api/journal");
  allEntries = await res.json();
  allTags = [...new Set(allEntries.flatMap((e) => e.tags || []))].sort();
  filterState.tagFilters = filterState.tagFilters.filter((t) => allTags.includes(t));
  renderTagFilterOptions();
  renderList();
}

function renderList() {
  const q = filterState.query.trim().toLowerCase();
  let filtered = allEntries;
  if (q) filtered = filtered.filter((e) => e.title.toLowerCase().includes(q));
  if (filterState.dateFrom) filtered = filtered.filter((e) => e.date >= filterState.dateFrom);
  if (filterState.dateTo) filtered = filtered.filter((e) => e.date <= filterState.dateTo);
  if (filterState.tagFilters.length > 0) {
    filtered = filtered.filter((e) => (e.tags || []).some((t) => filterState.tagFilters.includes(t)));
  }

  listEl.innerHTML = "";
  if (filtered.length === 0) {
    listEl.innerHTML = `<li class="empty-msg">No entries match your search/filter.</li>`;
    return;
  }
  for (const entry of filtered) {
    const li = document.createElement("li");
    li.dataset.id = entry.id;
    li.innerHTML = `<span class="entry-date">${entry.date}</span><span class="entry-title">${entry.title}</span>`;
    li.addEventListener("click", () => selectEntry(entry.id));
    listEl.appendChild(li);
  }
}

function markSelected(id) {
  listEl.querySelectorAll("li").forEach((li) => {
    li.classList.toggle("selected", li.dataset.id === id);
  });
}

async function selectEntry(id) {
  const res = await fetch(`/api/journal/${id}`);
  if (!res.ok) return;
  const entry = await res.json();
  idEl.value = entry.id;
  dateEl.value = entry.date;
  titleEl.value = entry.title;
  titleAutoGrow.resize();
  bodyEl.value = entry.body;
  tags = [...(entry.tags || [])];
  tagsEditor.render();
  deleteBtn.hidden = false;
  markSelected(id);
  markClean();
}

function todayLocalISO() {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d - offsetMs).toISOString().slice(0, 10);
}

function resetForm() {
  idEl.value = "";
  dateEl.value = todayLocalISO();
  titleEl.value = "";
  titleAutoGrow.resize();
  bodyEl.value = "";
  tags = [];
  tagsEditor.render();
  deleteBtn.hidden = true;
  markSelected(null);
  titleEl.focus();
  markClean();
}

newEntryBtn.addEventListener("click", resetForm);

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = buildPayload();
  const id = idEl.value;
  const res = await fetch(id ? `/api/journal/${id}` : "/api/journal", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const saved = await res.json();
  await loadEntries();
  selectEntry(saved.id);
});

deleteBtn.addEventListener("click", async () => {
  const id = idEl.value;
  if (!id || !confirm("Delete this entry?")) return;
  await fetch(`/api/journal/${id}`, { method: "DELETE" });
  await loadEntries();
  resetForm();
});

window.Diary = window.Diary || {};
window.Diary.journal = {
  showBrowse: () => {
    resetForm();
    loadEntries();
  },
  openItem: (id) => selectEntry(id),
  isDirty: () => isDirty(),
};

resetForm();
loadEntries();
