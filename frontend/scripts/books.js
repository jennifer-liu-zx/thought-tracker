(function () {
  const browseEl = document.getElementById("books-browse");
  const detailEl = document.getElementById("books-detail");
  const addBtn = document.getElementById("add-book-btn");
  const backBtn = document.getElementById("books-back-btn");
  const collectionEl = document.getElementById("books-collection");

  const searchPanel = document.getElementById("book-search-panel");
  const searchInput = document.getElementById("book-search-input");
  const searchResultsEl = document.getElementById("book-search-results");

  const form = document.getElementById("book-form");
  const idEl = document.getElementById("book-id");
  const titleEl = document.getElementById("book-title");
  const englishTitleEl = document.getElementById("book-english-title");
  const showEnglishTitleEl = document.getElementById("book-show-english-title");
  const authorEl = document.getElementById("book-author");
  const publisherEl = document.getElementById("book-publisher");
  const publishDateEl = document.getElementById("book-publish-date");
  const isbnEl = document.getElementById("book-isbn");
  const pagesEl = document.getElementById("book-pages");
  const genreEl = document.getElementById("book-genre");
  const seriesEl = document.getElementById("book-series");
  const formatEl = document.getElementById("book-format");
  const statusEl = document.getElementById("book-status");
  const coverEl = document.getElementById("book-cover");
  const coverPreviewEl = document.getElementById("book-cover-preview");
  const coverUploadEl = document.getElementById("book-cover-upload");
  const notesEl = document.getElementById("book-notes");
  const readDatesEl = document.getElementById("book-read-dates");
  const newReadDateEl = document.getElementById("new-read-date");
  const newReadDateFormatEl = document.getElementById("new-read-date-format");
  const addReadDateBtn = document.getElementById("add-read-date-btn");
  const thoughtsEl = document.getElementById("book-thoughts");
  const newThoughtDateEl = document.getElementById("new-thought-date");
  const newThoughtTextEl = document.getElementById("new-thought-text");
  const addThoughtBtn = document.getElementById("add-thought-btn");
  const tagsEl = document.getElementById("book-tags");
  const newTagTextEl = document.getElementById("new-tag-text");
  const addTagBtn = document.getElementById("add-tag-btn");
  const deleteBtn = document.getElementById("book-delete-btn");
  const ratingEl = document.getElementById("book-rating");

  let readDates = [];
  let thoughts = [];
  let tags = [];
  let rating = null;
  let favorite = false;
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
    storageKey: "books",
    onSelect: selectBook,
    sortOptions: [
      { value: "title-asc", label: "Title (A–Z)", cmp: (a, b) => a.title.localeCompare(b.title) },
      { value: "title-desc", label: "Title (Z–A)", cmp: (a, b) => b.title.localeCompare(a.title) },
      { value: "author-asc", label: "Author (A–Z)", cmp: (a, b) => (a.author || "").localeCompare(b.author || "") },
      { value: "rating-desc", label: "Rating (Highest)", cmp: (a, b) => (b.rating || 0) - (a.rating || 0) },
    ],
  });

  async function setBookFavorite(id, value) {
    const full = await fetch(`/api/books/${id}`).then((r) => r.json());
    full.favorite = value;
    await fetch(`/api/books/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(full),
    });
  }

  const favoritesPanel = createFavoritesPanel({
    container: document.getElementById("books-favorites"),
    fetchAll: () => fetch("/api/books").then((r) => r.json()),
    toItem: (b) => ({ id: b.id, title: pickDisplayTitle(b), subtitle: b.author, cover: b.cover, favorite: b.favorite }),
    setFavorite: setBookFavorite,
    onOpen: (id) => selectBook(id),
  });

  async function loadBooks() {
    const res = await fetch("/api/books");
    const books = await res.json();
    collectionView.setItems(
      books.map((b) => ({
        id: b.id,
        title: pickDisplayTitle(b),
        subtitle: b.author,
        cover: b.cover,
        author: b.author,
        rating: b.rating,
        tags: b.tags || [],
        // Fold in whichever title isn't being shown, so search matches both.
        keywords: [...(b.tags || []), b.title, b.english_title].join(" "),
      }))
    );
  }

  function updateCoverPreview() {
    if (coverEl.value) {
      coverPreviewEl.innerHTML = `<img src="${coverEl.value}" alt="" />`;
    } else {
      coverPreviewEl.textContent = "no cover";
    }
  }

  function renderReadDates() {
    readDatesEl.innerHTML = "";
    readDates.forEach((entry, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${entry.date} <span class="chip-meta">(${entry.format})</span> <button type="button" aria-label="remove">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        readDates.splice(i, 1);
        renderReadDates();
      });
      readDatesEl.appendChild(chip);
    });
  }

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

  addReadDateBtn.addEventListener("click", () => {
    const date = newReadDateEl.value;
    const format = newReadDateFormatEl.value;
    if (!date || readDates.some((entry) => entry.date === date && entry.format === format)) return;
    readDates.push({ date, format });
    readDates.sort((a, b) => a.date.localeCompare(b.date));
    newReadDateEl.value = "";
    renderReadDates();
  });

  addTagBtn.addEventListener("click", () => {
    const tag = newTagTextEl.value.trim();
    if (!tag || tags.includes(tag)) return;
    tags.push(tag);
    newTagTextEl.value = "";
    renderTags();
  });

  const thoughtsEditor = createThoughtsEditor({
    container: thoughtsEl,
    getThoughts: () => thoughts,
    dateInput: newThoughtDateEl,
    textInput: newThoughtTextEl,
    addBtn: addThoughtBtn,
  });

  coverEl.addEventListener("input", updateCoverPreview);

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
    authorEl.value = "";
    publisherEl.value = "";
    publishDateEl.value = "";
    isbnEl.value = "";
    pagesEl.value = "";
    genreEl.value = "";
    seriesEl.value = "";
    formatEl.value = "physical";
    statusEl.value = "want_to_read";
    coverEl.value = "";
    notesEl.value = "";
    readDates = [];
    thoughts = [];
    tags = [];
    rating = null;
    ratingWidget.setValue(null);
    favorite = false;
    newReadDateFormatEl.value = "physical";
    newTagTextEl.value = "";
    renderReadDates();
    thoughtsEditor.render();
    renderTags();
    updateCoverPreview();
    deleteBtn.hidden = true;
    searchPanel.hidden = false;
    searchInput.value = "";
    searchResultsEl.innerHTML = "";
    markClean();
  }

  function fillForm(book) {
    idEl.value = book.id;
    titleEl.value = book.title || "";
    englishTitleEl.value = book.english_title || "";
    showEnglishTitleEl.checked = !!book.show_english_title;
    authorEl.value = book.author || "";
    publisherEl.value = book.publisher || "";
    publishDateEl.value = book.publish_date || "";
    isbnEl.value = book.isbn || "";
    pagesEl.value = book.pages || "";
    genreEl.value = book.genre || "";
    seriesEl.value = book.series || "";
    formatEl.value = book.format || "physical";
    statusEl.value = book.status || "want_to_read";
    coverEl.value = book.cover || "";
    notesEl.value = book.notes || "";
    readDates = [...(book.read_dates || [])];
    thoughts = [...(book.thoughts || [])];
    tags = [...(book.tags || [])];
    rating = book.rating || null;
    ratingWidget.setValue(rating);
    favorite = !!book.favorite;
    renderReadDates();
    thoughtsEditor.render();
    renderTags();
    updateCoverPreview();
    markClean();
  }

  async function selectBook(id) {
    const res = await fetch(`/api/books/${id}`);
    if (!res.ok) return;
    const book = await res.json();
    fillForm(book);
    deleteBtn.hidden = false;
    searchPanel.hidden = true;
    showDetail();
  }

  addBtn.addEventListener("click", () => {
    resetForm();
    showDetail();
  });

  backBtn.addEventListener("click", () => {
    showBrowse();
    loadBooks();
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    if (!q) {
      searchResultsEl.innerHTML = "";
      return;
    }
    searchDebounce = setTimeout(async () => {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const results = await res.json();
      searchResultsEl.innerHTML = "";
      for (const r of results) {
        const row = document.createElement("div");
        row.className = "search-result";
        const coverImg = r.cover ? `<img src="${r.cover}" alt="" />` : "<img alt=''/>";
        row.innerHTML = `${coverImg}<div><div class="result-title">${r.title}</div><div class="result-subtitle">${r.author}${r.publish_date ? " · " + r.publish_date : ""}</div></div>`;
        row.addEventListener("click", () => {
          titleEl.value = r.title || "";
          authorEl.value = r.author || "";
          publisherEl.value = r.publisher || "";
          publishDateEl.value = r.publish_date || "";
          isbnEl.value = r.isbn || "";
          pagesEl.value = r.pages || "";
          genreEl.value = r.genre || "";
          coverEl.value = r.cover || "";
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
      author: authorEl.value,
      publisher: publisherEl.value,
      publish_date: publishDateEl.value,
      isbn: isbnEl.value,
      pages: pagesEl.value ? parseInt(pagesEl.value, 10) : null,
      genre: genreEl.value,
      series: seriesEl.value,
      format: formatEl.value,
      status: statusEl.value,
      cover: coverEl.value,
      notes: notesEl.value,
      tags: tags,
      rating: rating,
      favorite: favorite,
      read_dates: readDates,
      thoughts: thoughts,
    };
  }

  const { isDirty, markClean } = createDirtyTracker(buildPayload, { isVisible: () => !detailEl.hidden });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    const id = idEl.value;
    const res = await fetch(id ? `/api/books/${id}` : "/api/books", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    markClean();
    showBrowse();
    loadBooks();
    favoritesPanel.refresh();
  });

  deleteBtn.addEventListener("click", async () => {
    const id = idEl.value;
    if (!id || !confirm("Delete this book?")) return;
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    markClean();
    showBrowse();
    loadBooks();
    favoritesPanel.refresh();
  });

  window.Diary = window.Diary || {};
  window.Diary.books = {
    showBrowse: () => {
      showBrowse();
      loadBooks();
      favoritesPanel.refresh();
    },
    openItem: (id) => selectBook(id),
    isDirty: () => isDirty(),
  };

  loadBooks();
})();
