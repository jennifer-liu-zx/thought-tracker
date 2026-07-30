// Shared track-field editors, both used from music.js:
// - createTrackFieldsEditor: the full editor (title, alternative title,
//   link, duration, credits, lyrics, tags, thoughts) nested inline inside
//   an album's track list (buildTrackElement's expandable row).
// - createSongRowExpandBody: the reduced editor (tags + thoughts only) used
//   by Song View's rows (renderSongRow) — Song View is a lighter
//   browse/tag/thought surface, not a full editor. Star lives on the
//   collapsed row in both contexts (music.js), not in either editor here;
//   favourite isn't editable from any per-track UI, only the sidebar
//   Favourites panel. Tags/thoughts editing behavior is shared via
//   renderTagsSection/renderThoughtsSection so the two surfaces can't drift.

// Every full-track PUT must resend every field TrackIn knows about, or the
// API silently resets whatever's omitted back to its default — this
// happened for real with several call sites before this was consolidated
// into one shared builder (favorite/favorite_order/duration/composers kept
// getting dropped one at a time as fields were added over time).
function trackToPayload(t) {
  return {
    track_number: t.track_number,
    title: t.title,
    english_title: t.english_title || "",
    show_english_title: !!t.show_english_title,
    link: t.link || "",
    duration: t.duration || "",
    writers: t.writers || "",
    composers: t.composers || "",
    producers: t.producers || "",
    featuring: t.featuring || "",
    label: t.label || "",
    favorite: t.favorite,
    favorite_order: t.favorite_order,
    starred: t.starred,
    tags: t.tags || [],
    thoughts: t.thoughts,
  };
}

function putTrack(albumId, track) {
  return fetch(`/api/music/${albumId}/tracks/${track.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trackToPayload(track)),
  });
}

/** Toggles track.starred in place, cascading the favorite<->starred
 * invariant client-side (mirrors app/routers/music.py's _normalize_track,
 * so the UI never shows a contradictory state before a PUT resolves).
 * Unstarring must also un-favourite — favourite is a strict subset of
 * starred, so a track can't stay on the home lane once it leaves Song View. */
function toggleTrackStarred(track) {
  track.starred = !track.starred;
  if (!track.starred) track.favorite = false;
}

/** Sets track.favorite in place, cascading the same invariant the other
 * direction — favouriting implies starred. */
function applyTrackFavorite(track, value) {
  track.favorite = value;
  if (value) track.starred = true;
}

/**
 * Renders just the tags chip-editor into `container` — shared by the full
 * album-view editor and Song View's reduced expand, so the two surfaces
 * never drift on how tag editing behaves.
 */
function renderTagsSection({ container, track, saveTrack }) {
  container.innerHTML = `
    <div class="mini-section track-tags-section">
      <h4>Tags</h4>
      <div class="chip-list track-tags-list"></div>
      <div class="add-row">
        <input type="text" class="track-new-tag-text" placeholder="Add a tag..." />
        <button type="button" class="track-add-tag-btn">+ Add tag</button>
      </div>
    </div>
  `;

  createChipListEditor({
    container: container.querySelector(".track-tags-list"),
    getItems: () => track.tags || (track.tags = []),
    textInput: container.querySelector(".track-new-tag-text"),
    addBtn: container.querySelector(".track-add-tag-btn"),
    onChange: saveTrack,
  });
}

/**
 * Renders just the thoughts editor into `container` — shared the same way
 * as renderTagsSection. `scrollable` wraps the thoughts list in a
 * max-height scroll box (Song View's rows, so a long thought history
 * doesn't blow out a dense list; the full album-view editor doesn't need
 * this since it's already a dedicated per-track page section).
 */
function renderThoughtsSection({ container, track, saveTrack, scrollable }) {
  container.innerHTML = `
    <div class="mini-section">
      <h4>Thoughts</h4>
      <div class="${scrollable ? "thoughts-scroll " : ""}thoughts-list track-thoughts"></div>
      <div class="add-row">
        <input type="date" class="track-new-thought-date" />
        <textarea class="thought-textarea track-new-thought-text" placeholder="New thought..." rows="2"></textarea>
        <button type="button" class="track-add-thought-btn">+ Add thought</button>
      </div>
    </div>
  `;

  createThoughtsEditor({
    container: container.querySelector(".track-thoughts"),
    getThoughts: () => track.thoughts,
    dateInput: container.querySelector(".track-new-thought-date"),
    textInput: container.querySelector(".track-new-thought-text"),
    addBtn: container.querySelector(".track-add-thought-btn"),
    onChange: saveTrack,
  });
}

/**
 * Song View's reduced expand — tags + thoughts only. Credits, lyrics, the
 * link/duration fields, and the title stay album-view-only edits; Song
 * View is a lighter browse/tag/thought surface, not a full editor.
 */
function createSongRowExpandBody({ container, albumId, track, onSaved }) {
  async function saveTrack() {
    await putTrack(albumId, track);
    onSaved?.();
  }

  container.innerHTML = `<div class="song-tags-slot"></div><div class="song-thoughts-slot"></div>`;
  renderTagsSection({ container: container.querySelector(".song-tags-slot"), track, saveTrack });
  renderThoughtsSection({
    container: container.querySelector(".song-thoughts-slot"),
    track,
    saveTrack,
    scrollable: true,
  });
}

/**
 * Renders the shared track fields UI into `container` (an element the
 * caller already appended somewhere). `track` is a mutable TrackOut-shaped
 * object — this editor reads/writes its properties directly, same pattern
 * as the rest of this app's detail forms.
 *
 * onSaved (optional): fires after any successful save (title edit or full
 * save) — callers use this to refresh whatever summary display shows this
 * track's title elsewhere.
 */
function createTrackFieldsEditor({ container, albumId, track, onSaved }) {
  container.innerHTML = `
    <div class="track-title-view">
      <span class="track-title-display"></span>
      <button type="button" class="track-title-edit-btn" aria-label="Edit title">${PENCIL_ICON}</button>
    </div>
    <input type="text" class="track-title-input" placeholder="Track title" hidden />

    <div class="mini-section">
      <div class="field">
        <label>Alternative title</label>
        <input type="text" class="track-english-title" placeholder="Alternative title (optional)" />
      </div>
      <label class="checkbox-field">
        <input type="checkbox" class="track-show-english-title" />
        Show alternative title
      </label>
    </div>

    <div class="track-tags-slot"></div>

    <div class="mini-section">
      <h4>Link</h4>
      <div class="field-row">
        <input type="text" class="track-link" placeholder="Link to the song or video (YouTube, Spotify, etc.)" />
        <input type="text" class="track-duration" placeholder="Duration (e.g. 3:45)" style="max-width: 8rem;" />
      </div>
    </div>

    <div class="mini-section">
      <h4>Credits</h4>
      <div class="credits-fields">
        <div class="field">
          <label>Writer(s)</label>
          <input type="text" class="track-writers" placeholder="Writer(s)" />
        </div>
        <div class="field">
          <label>Composer(s)</label>
          <input type="text" class="track-composers" placeholder="Composer(s)" />
        </div>
        <div class="field">
          <label>Producer(s)</label>
          <input type="text" class="track-producers" placeholder="Producer(s)" />
        </div>
        <div class="field">
          <label>Featuring</label>
          <input type="text" class="track-featuring" placeholder="Featuring" />
        </div>
        <div class="field">
          <label>Label</label>
          <input type="text" class="track-label" placeholder="Label" />
        </div>
      </div>
    </div>

    <div class="mini-section">
      <h4>Lyrics</h4>
      <textarea class="lyrics-box" placeholder="Paste lyrics, or upload a .txt file..."></textarea>
      <div class="editor-actions" style="margin-top: 0.5rem;">
        <label class="upload-label">Upload .txt<input type="file" accept=".txt" hidden /></label>
        <button type="button" class="fetch-lyrics-btn">Fetch lyrics (LRCLIB)</button>
      </div>
    </div>

    <div class="editor-actions">
      <button type="button" class="track-save-btn">Save</button>
    </div>

    <div class="track-thoughts-slot"></div>
  `;

  const titleView = container.querySelector(".track-title-view");
  const titleInput = container.querySelector(".track-title-input");
  const titleDisplay = titleView.querySelector(".track-title-display");
  titleDisplay.textContent = track.title;

  titleView.querySelector(".track-title-edit-btn").addEventListener("click", () => {
    titleInput.value = track.title;
    titleView.hidden = true;
    titleInput.hidden = false;
    titleInput.focus();
  });

  async function saveTrack() {
    await putTrack(albumId, track);
  }

  renderTagsSection({ container: container.querySelector(".track-tags-slot"), track, saveTrack });

  const englishTitleInput = container.querySelector(".track-english-title");
  const showEnglishTitleCheckbox = container.querySelector(".track-show-english-title");
  englishTitleInput.value = track.english_title || "";
  showEnglishTitleCheckbox.checked = !!track.show_english_title;

  const linkInput = container.querySelector(".track-link");
  const durationInput = container.querySelector(".track-duration");
  linkInput.value = track.link || "";
  durationInput.value = track.duration || "";

  const writersInput = container.querySelector(".track-writers");
  const composersInput = container.querySelector(".track-composers");
  const producersInput = container.querySelector(".track-producers");
  const featuringInput = container.querySelector(".track-featuring");
  const labelInput = container.querySelector(".track-label");
  writersInput.value = track.writers || "";
  composersInput.value = track.composers || "";
  producersInput.value = track.producers || "";
  featuringInput.value = track.featuring || "";
  labelInput.value = track.label || "";

  const lyricsBox = container.querySelector(".lyrics-box");
  lyricsBox.value = track.lyrics || "";
  const uploadInput = container.querySelector('input[type="file"]');
  const fetchLyricsBtn = container.querySelector(".fetch-lyrics-btn");
  const trackSaveBtn = container.querySelector(".track-save-btn");

  uploadInput.addEventListener("change", () => {
    const file = uploadInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      lyricsBox.value = reader.result;
    };
    reader.readAsText(file);
  });

  fetchLyricsBtn.addEventListener("click", async () => {
    const res = await fetch(`/api/music/${albumId}/tracks/${track.id}/fetch-lyrics`);
    if (!res.ok) return;
    const { lyrics } = await res.json();
    if (!lyrics) {
      alert("LRCLIB didn't have a match for this song — try pasting lyrics manually.");
      return;
    }
    // A first pass only — the user reviews/corrects this before it's
    // actually saved, via the same consolidated Save button as everything else.
    lyricsBox.value = lyrics;
  });

  async function saveLyrics() {
    await fetch(`/api/music/${albumId}/tracks/${track.id}/lyrics`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyrics: lyricsBox.value }),
    });
  }

  // One consolidated Save for the whole track — alternative title, link,
  // credits, and lyrics — rather than a separate button per field group.
  trackSaveBtn.addEventListener("click", async () => {
    if (!titleInput.hidden && titleInput.value.trim()) {
      track.title = titleInput.value.trim();
    }
    track.english_title = englishTitleInput.value;
    track.show_english_title = showEnglishTitleCheckbox.checked;
    track.link = linkInput.value;
    track.duration = durationInput.value;
    track.writers = writersInput.value;
    track.composers = composersInput.value;
    track.producers = producersInput.value;
    track.featuring = featuringInput.value;
    track.label = labelInput.value;
    await Promise.all([saveTrack(), saveLyrics()]);
    track.lyrics = lyricsBox.value;
    titleDisplay.textContent = track.title;
    titleInput.hidden = true;
    titleView.hidden = false;
    onSaved?.();
  });

  renderThoughtsSection({ container: container.querySelector(".track-thoughts-slot"), track, saveTrack });
}
