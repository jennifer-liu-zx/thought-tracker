const listEl = document.getElementById("journal-list");
const formEl = document.getElementById("journal-form");
const idEl = document.getElementById("entry-id");
const dateEl = document.getElementById("entry-date");
const titleEl = document.getElementById("entry-title");
const bodyEl = document.getElementById("entry-body");
const deleteBtn = document.getElementById("delete-btn");
const newEntryBtn = document.getElementById("new-entry-btn");
const unsavedIndicator = document.getElementById("unsaved-indicator");

let savedSnapshot = "";

function currentSnapshot() {
  return JSON.stringify({ date: dateEl.value, title: titleEl.value, body: bodyEl.value });
}

function isDirty() {
  return currentSnapshot() !== savedSnapshot;
}

function updateUnsavedIndicator() {
  unsavedIndicator.hidden = !isDirty();
}

function markClean() {
  savedSnapshot = currentSnapshot();
  updateUnsavedIndicator();
}

formEl.addEventListener("input", updateUnsavedIndicator);

async function loadEntries() {
  const res = await fetch("/api/journal");
  const entries = await res.json();
  listEl.innerHTML = "";
  for (const entry of entries) {
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
  bodyEl.value = entry.body;
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
  bodyEl.value = "";
  deleteBtn.hidden = true;
  markSelected(null);
  titleEl.focus();
  markClean();
}

newEntryBtn.addEventListener("click", resetForm);

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = { title: titleEl.value, date: dateEl.value, body: bodyEl.value };
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
