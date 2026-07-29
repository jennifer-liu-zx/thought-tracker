// Maps a top-level tab to the window.Diary registry key(s) that live inside it.
// "Movies & TV" holds two independent subsections (movies, tv), so both must be
// checked/reset together.
const SECTION_REGISTRY_KEYS = {
  home: ["home"],
  movies: ["movies", "tv"],
  books: ["books"],
  music: ["music", "live-covers", "song-view"],
  journal: ["journal"],
};

function isSectionDirty(section) {
  const keys = SECTION_REGISTRY_KEYS[section] || [section];
  return keys.some((k) => window.Diary?.[k]?.isDirty?.());
}

function resetSectionToBrowse(section) {
  const keys = SECTION_REGISTRY_KEYS[section] || [section];
  keys.forEach((k) => window.Diary?.[k]?.showBrowse?.());
}

const brandHomeLink = document.getElementById("brand-home-link");
brandHomeLink.addEventListener("click", () => {
  document.querySelector('.nav-btn[data-section="home"]').click();
});
brandHomeLink.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    brandHomeLink.click();
  }
});

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const currentBtn = document.querySelector(".nav-btn.active");
    const currentSection = currentBtn ? currentBtn.dataset.section : null;

    if (currentSection && isSectionDirty(currentSection)) {
      if (!confirm("You have unsaved changes. Leave without saving?")) return;
    }

    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".section").forEach((s) => (s.hidden = true));
    btn.classList.add("active");
    document.getElementById(`section-${btn.dataset.section}`).hidden = false;

    // Always land on that tab's browse view — never wherever you left off.
    resetSectionToBrowse(btn.dataset.section);
  });
});

document.querySelectorAll(".subnav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const nav = btn.closest(".subnav");
    const currentBtn = nav.querySelector(".subnav-btn.active");
    const currentSub = currentBtn ? currentBtn.dataset.sub : null;

    if (currentSub && window.Diary?.[currentSub]?.isDirty?.()) {
      if (!confirm("You have unsaved changes. Leave without saving?")) return;
    }

    nav.querySelectorAll(".subnav-btn").forEach((b) => b.classList.remove("active"));
    nav.parentElement.querySelectorAll(":scope > .subsection").forEach((s) => (s.hidden = true));
    btn.classList.add("active");
    document.getElementById(`sub-${btn.dataset.sub}`).hidden = false;

    window.Diary?.[btn.dataset.sub]?.showBrowse?.();
  });
});
