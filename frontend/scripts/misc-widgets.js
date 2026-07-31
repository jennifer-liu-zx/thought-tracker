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

/**
 * Wires a cover/poster upload form: a hidden text input holding the current
 * value (either an existing path or a data: URL), a file picker that reads
 * the chosen file into that input via FileReader, a remove button that
 * clears both, and a preview element kept in sync with all of the above.
 *
 * coverInput/uploadInput/removeBtn/previewEl: the existing form controls.
 * emptyText: shown in the preview when there's no cover (e.g. "no poster"
 * for movies/shows, "no cover" for books/albums/live-covers).
 *
 * updatePreview() is returned so callers can re-sync the preview after
 * setting coverInput.value programmatically (loading an existing item, or
 * picking a cover from a search result) — those don't fire coverInput's own
 * "input" event, unlike the user typing into it.
 */
function createCoverUpload({ coverInput, uploadInput, removeBtn, previewEl, emptyText }) {
  function updatePreview() {
    if (coverInput.value) {
      previewEl.innerHTML = `<img src="${coverInput.value}" alt="" />`;
    } else {
      previewEl.textContent = emptyText;
    }
  }

  coverInput.addEventListener("input", updatePreview);

  removeBtn.addEventListener("click", () => {
    coverInput.value = "";
    uploadInput.value = "";
    updatePreview();
  });

  uploadInput.addEventListener("change", () => {
    const file = uploadInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      coverInput.value = reader.result;
      updatePreview();
    };
    reader.readAsDataURL(file);
  });

  return { updatePreview };
}

/**
 * Wires the browse/detail pane toggle shared by every content-type page:
 * exactly one of `browseEl`/`detailEl` is visible at a time.
 */
function createBrowseDetailToggle({ browseEl, detailEl }) {
  return {
    showBrowse() {
      detailEl.hidden = true;
      browseEl.hidden = false;
    },
    showDetail() {
      browseEl.hidden = true;
      detailEl.hidden = false;
    },
  };
}
