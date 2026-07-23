(function () {
  const browseEl = document.getElementById("live-covers-browse");
  const detailEl = document.getElementById("live-covers-detail");
  const addBtn = document.getElementById("add-live-cover-btn");
  const backBtn = document.getElementById("live-covers-back-btn");
  const collectionEl = document.getElementById("live-covers-collection");

  const form = document.getElementById("live-cover-form");
  const idEl = document.getElementById("live-cover-id");
  const titleEl = document.getElementById("live-cover-title");
  const englishTitleEl = document.getElementById("live-cover-english-title");
  const showEnglishTitleEl = document.getElementById("live-cover-show-english-title");
  const artistEl = document.getElementById("live-cover-artist");
  const originalArtistEl = document.getElementById("live-cover-original-artist");
  const yearEl = document.getElementById("live-cover-year");
  const linkEl = document.getElementById("live-cover-link");
  const coverEl = document.getElementById("live-cover-cover");
  const coverPreviewEl = document.getElementById("live-cover-cover-preview");
  const coverUploadEl = document.getElementById("live-cover-cover-upload");
  const coverRemoveBtn = document.getElementById("live-cover-cover-remove-btn");
  const notesEl = document.getElementById("live-cover-notes");
  const thoughtsEl = document.getElementById("live-cover-thoughts");
  const newThoughtDateEl = document.getElementById("new-live-cover-thought-date");
  const newThoughtTextEl = document.getElementById("new-live-cover-thought-text");
  const addThoughtBtn = document.getElementById("add-live-cover-thought-btn");
  const tagsEl = document.getElementById("live-cover-tags");
  const newTagTextEl = document.getElementById("new-live-cover-tag-text");
  const addTagBtn = document.getElementById("add-live-cover-tag-btn");
  const deleteBtn = document.getElementById("live-cover-delete-btn");

  let thoughts = [];
  let tags = [];
  let favorite = false;

  const collectionView = createCollectionView({
    container: collectionEl,
    storageKey: "live-covers",
    onSelect: selectEntry,
    coverAspect: "landscape",
    sortOptions: [
      { value: "title-asc", label: "Title (A–Z)", cmp: (a, b) => a.title.localeCompare(b.title) },
      { value: "title-desc", label: "Title (Z–A)", cmp: (a, b) => b.title.localeCompare(a.title) },
      { value: "year-desc", label: "Year (Newest)", cmp: (a, b) => (b.year || "").localeCompare(a.year || "") },
      { value: "year-asc", label: "Year (Oldest)", cmp: (a, b) => (a.year || "").localeCompare(b.year || "") },
    ],
  });

  async function setEntryFavorite(id, value) {
    const full = await fetch(`/api/live-covers/${id}`).then((r) => r.json());
    full.favorite = value;
    await fetch(`/api/live-covers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(full),
    });
  }

  const favoritesPanel = createFavoritesPanel({
    container: document.getElementById("live-covers-favorites"),
    fetchAll: () => fetch("/api/live-covers").then((r) => r.json()),
    toItem: (e) => ({
      id: e.id,
      title: pickDisplayTitle(e),
      subtitle: e.artist,
      cover: e.cover,
      favorite: e.favorite,
    }),
    setFavorite: setEntryFavorite,
    onOpen: (id) => selectEntry(id),
  });

  async function loadEntries() {
    const res = await fetch("/api/live-covers");
    const entries = await res.json();
    collectionView.setItems(
      entries.map((e) => ({
        id: e.id,
        title: pickDisplayTitle(e),
        subtitle: e.artist,
        cover: e.cover,
        year: e.year,
        tags: e.tags || [],
        keywords: [...(e.tags || []), e.title, e.english_title, e.original_artist].join(" "),
      }))
    );
  }

  function updateCoverPreview() {
    coverPreviewEl.innerHTML = coverEl.value ? `<img src="${coverEl.value}" alt="" />` : "no cover";
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

  const tagsEditor = createChipListEditor({
    container: tagsEl,
    getItems: () => tags,
    textInput: newTagTextEl,
    addBtn: addTagBtn,
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
    artistEl.value = "";
    originalArtistEl.value = "";
    yearEl.value = "";
    linkEl.value = "";
    coverEl.value = "";
    notesEl.value = "";
    notesEditor.reset();
    thoughts = [];
    tags = [];
    favorite = false;
    thoughtsEditor.render();
    tagsEditor.render();
    updateCoverPreview();
    deleteBtn.hidden = true;
    markClean();
  }

  function fillForm(entry) {
    idEl.value = entry.id;
    titleEl.value = entry.title || "";
    englishTitleEl.value = entry.english_title || "";
    showEnglishTitleEl.checked = !!entry.show_english_title;
    artistEl.value = entry.artist || "";
    originalArtistEl.value = entry.original_artist || "";
    yearEl.value = entry.year || "";
    linkEl.value = entry.link || "";
    coverEl.value = entry.cover || "";
    notesEl.value = entry.notes || "";
    notesEditor.load();
    thoughts = [...(entry.thoughts || [])];
    tags = [...(entry.tags || [])];
    favorite = !!entry.favorite;
    thoughtsEditor.render();
    tagsEditor.render();
    updateCoverPreview();
    markClean();
  }

  async function selectEntry(id) {
    const res = await fetch(`/api/live-covers/${id}`);
    if (!res.ok) return;
    const entry = await res.json();
    fillForm(entry);
    deleteBtn.hidden = false;
    showDetail();
  }

  addBtn.addEventListener("click", () => {
    resetForm();
    showDetail();
  });

  backBtn.addEventListener("click", () => {
    if (isDirty() && !confirm("You have unsaved changes. Leave without saving?")) return;
    showBrowse();
    loadEntries();
  });

  function buildPayload() {
    return {
      title: titleEl.value,
      english_title: englishTitleEl.value,
      show_english_title: showEnglishTitleEl.checked,
      artist: artistEl.value,
      original_artist: originalArtistEl.value,
      year: yearEl.value,
      link: linkEl.value,
      cover: coverEl.value,
      notes: notesEl.value,
      tags: tags,
      favorite: favorite,
      thoughts: thoughts,
    };
  }

  const { isDirty, markClean } = createDirtyTracker(buildPayload, {
    isVisible: () => !detailEl.hidden,
    indicatorEl: document.getElementById("live-cover-unsaved-indicator"),
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    const id = idEl.value;
    const res = await fetch(id ? `/api/live-covers/${id}` : "/api/live-covers", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    markClean();
    notesEditor.showSaved();
    showBrowse();
    loadEntries();
    favoritesPanel.refresh();
  });

  deleteBtn.addEventListener("click", async () => {
    const id = idEl.value;
    if (!id || !confirm("Delete this track?")) return;
    await fetch(`/api/live-covers/${id}`, { method: "DELETE" });
    markClean();
    showBrowse();
    loadEntries();
    favoritesPanel.refresh();
  });

  window.Diary = window.Diary || {};
  window.Diary["live-covers"] = {
    showBrowse: () => {
      showBrowse();
      loadEntries();
      favoritesPanel.refresh();
    },
    openItem: (id) => selectEntry(id),
    isDirty: () => isDirty(),
  };

  loadEntries();
})();
