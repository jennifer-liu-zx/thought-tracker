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
