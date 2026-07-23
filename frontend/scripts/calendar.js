(function () {
  const todayWidget = document.getElementById("today-widget");
  const todayWeekdayEl = document.getElementById("today-weekday");
  const todayDayEl = document.getElementById("today-widget-day");
  const todayMonthEl = document.getElementById("today-widget-month");

  const modal = document.getElementById("calendar-modal");
  const monthTitleEl = document.getElementById("calendar-month-title");
  const gridEl = document.getElementById("calendar-grid");
  const prevBtn = document.getElementById("calendar-prev-month");
  const nextBtn = document.getElementById("calendar-next-month");
  const closeBtn = document.getElementById("calendar-close-btn");
  const categoryFilterEl = document.getElementById("calendar-category-filter");

  const dayPanel = document.getElementById("calendar-day-panel");
  const dayPanelTitleEl = document.getElementById("calendar-day-panel-title");
  const dayPanelListEl = document.getElementById("calendar-day-panel-list");
  const dayPanelCloseBtn = document.getElementById("calendar-day-panel-close");

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const CATEGORY_LABELS = { movies_tv: "movie & tv", books: "book", music: "music", random: "random" };

  let viewYear;
  let viewMonth; // 1-12
  let lastCounts = {};
  let currentDayStr = null;
  let lastDayItems = [];

  function getActiveCategories() {
    return new Set(
      [...categoryFilterEl.querySelectorAll("input:checked")].map((cb) => cb.value)
    );
  }

  function todayLocalISO() {
    const d = new Date();
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d - offsetMs).toISOString().slice(0, 10);
  }

  function renderTodayWidget() {
    const now = new Date();
    todayWeekdayEl.textContent = WEEKDAY_NAMES[now.getDay()];
    todayDayEl.textContent = now.getDate();
    todayMonthEl.textContent = MONTH_NAMES[now.getMonth()];
  }

  async function openMonth(year, month) {
    viewYear = year;
    viewMonth = month;
    modal.hidden = false;
    dayPanel.hidden = true;
    currentDayStr = null;
    await renderMonth();
  }

  async function renderMonth() {
    monthTitleEl.textContent = `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`;
    const res = await fetch(`/api/calendar/counts?year=${viewYear}&month=${viewMonth}`);
    lastCounts = await res.json();
    renderGrid();
  }

  function renderGrid() {
    const activeCategories = getActiveCategories();
    gridEl.innerHTML = "";
    const startWeekday = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const todayStr = todayLocalISO();

    for (let i = 0; i < startWeekday; i++) {
      const blank = document.createElement("div");
      blank.className = "calendar-cell calendar-cell-empty";
      gridEl.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayCounts = lastCounts[dateStr] || {};
      const summaryLines = Object.entries(dayCounts)
        .filter(([cat, n]) => n > 0 && activeCategories.has(cat))
        .map(([cat, n]) => `${n} ${CATEGORY_LABELS[cat] || cat} thought${n === 1 ? "" : "s"}`);

      const cell = document.createElement("div");
      cell.className = "calendar-cell" + (dateStr === todayStr ? " calendar-cell-today" : "");
      cell.innerHTML = `
        <div class="calendar-cell-day">${day}</div>
        <div class="calendar-cell-summary">${summaryLines.map((l) => `<div>${escapeHtml(l)}</div>`).join("")}</div>
      `;
      cell.addEventListener("click", () => openDayPanel(dateStr));
      gridEl.appendChild(cell);
    }
  }

  async function openDayPanel(dateStr) {
    currentDayStr = dateStr;
    const res = await fetch(`/api/calendar/day/${dateStr}`);
    lastDayItems = await res.json();
    renderDayPanel();
    dayPanel.hidden = false;
  }

  function renderDayPanel() {
    const activeCategories = getActiveCategories();
    const items = lastDayItems.filter((item) => activeCategories.has(item.category));

    dayPanelTitleEl.textContent = currentDayStr;
    dayPanelListEl.innerHTML = "";

    if (items.length === 0) {
      dayPanelListEl.innerHTML = `<p class="empty-msg">No thoughts that day.</p>`;
    } else {
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "calendar-day-item";
        row.innerHTML = `
          <div class="calendar-day-item-category">${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</div>
          <div class="calendar-day-item-title">${escapeHtml(item.title)}</div>
          <div class="calendar-day-item-text">${escapeHtml(item.text)}</div>
        `;
        row.addEventListener("click", () => jumpToItem(item));
        dayPanelListEl.appendChild(row);
      }
    }
  }

  function jumpToItem(item) {
    modal.hidden = true;
    dayPanel.hidden = true;

    if (item.category === "movies_tv") {
      document.querySelector('.nav-btn[data-section="movies"]').click();
      if (item.type === "movie") {
        document.querySelector('.subnav-btn[data-sub="movies"]').click();
        window.Diary.movies.openItem(item.id);
      } else {
        // Show and episode thoughts both live on the show's own detail page.
        document.querySelector('.subnav-btn[data-sub="tv"]').click();
        window.Diary.tv.openItem(item.id);
      }
    } else if (item.category === "books") {
      document.querySelector('.nav-btn[data-section="books"]').click();
      window.Diary.books.openItem(item.id);
    } else if (item.category === "music") {
      document.querySelector('.nav-btn[data-section="music"]').click();
      if (item.type === "live_cover") {
        document.querySelector('.subnav-btn[data-sub="live-covers"]').click();
        window.Diary["live-covers"].openItem(item.id);
      } else {
        // Album and track thoughts both live on the album's own detail page.
        document.querySelector('.subnav-btn[data-sub="music"]').click();
        window.Diary.music.openItem(item.id);
      }
    } else if (item.category === "random") {
      document.querySelector('.nav-btn[data-section="journal"]').click();
      window.Diary.journal.openItem(item.id);
    }
  }

  todayWidget.addEventListener("click", () => {
    const now = new Date();
    openMonth(now.getFullYear(), now.getMonth() + 1);
  });

  prevBtn.addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 1) {
      viewMonth = 12;
      viewYear -= 1;
    }
    renderMonth();
  });

  nextBtn.addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 12) {
      viewMonth = 1;
      viewYear += 1;
    }
    renderMonth();
  });

  closeBtn.addEventListener("click", () => {
    modal.hidden = true;
  });

  dayPanelCloseBtn.addEventListener("click", () => {
    dayPanel.hidden = true;
  });

  categoryFilterEl.addEventListener("change", () => {
    renderGrid();
    if (currentDayStr && !dayPanel.hidden) {
      renderDayPanel();
    }
  });

  renderTodayWidget();
})();
