import OBR from "@owlbear-rodeo/sdk";
import { playThemeSong, stopThemeSong, pauseThemeSong, resumeThemeSong, hasVideoId } from "./youtube.js";

const ROOM_KEY = "com.initiativebard/state";

let currentState = { currentIndex: 0, round: 1 };
let allItems = [];
let currentSongUrl = "";
let songModalTargetId = null;
let isMusicPaused = false;
let isGM = false;

function metaKey(EXT_ID) {
  return `${EXT_ID}/metadata`;
}

function getTokenName(item) {
  // Prefer the label text the user typed under the token
  const plain = item.text?.plainText?.trim();
  if (plain) return plain;
  // Fall back to the file name
  return item.name;
}

function getInitiativeItems(items, META_KEY) {
  return items
    .filter((item) => item.metadata[META_KEY] !== undefined)
    .sort((a, b) => {
      const aVal = Number(a.metadata[META_KEY]?.initiative ?? 0);
      const bVal = Number(b.metadata[META_KEY]?.initiative ?? 0);
      return bVal - aVal;
    });
}

async function loadState() {
  try {
    const meta = await OBR.room.getMetadata();
    const state = meta[ROOM_KEY];
    if (state) currentState = state;
  } catch (e) {}
}

async function saveState() {
  try {
    await OBR.room.setMetadata({ [ROOM_KEY]: currentState });
  } catch (e) {}
}

let lastHighlightedId = null;

async function highlightToken(item) {
  try {
    if (lastHighlightedId) {
      await OBR.scene.items.updateItems([lastHighlightedId], (items) => {
        for (const i of items) i.outlined = false;
      });
    }
    if (!item) { lastHighlightedId = null; return; }
    await OBR.scene.items.updateItems([item.id], (items) => {
      for (const i of items) i.outlined = true;
    });
    lastHighlightedId = item.id;
  } catch (e) {}
}

function handleMusic(activeItem, META_KEY) {
  if (isMusicPaused) return;
  const song = activeItem?.metadata[META_KEY]?.themeSong ?? "";
  if (song && hasVideoId(song)) {
    if (song !== currentSongUrl) {
      currentSongUrl = song;
      playThemeSong(song);
    }
  } else {
    currentSongUrl = "";
    stopThemeSong();
  }
}

export async function renderTracker(EXT_ID) {
  const META_KEY = metaKey(EXT_ID);

  // Check role once on load
  try {
    const role = await OBR.player.getRole();
    isGM = role === "GM";
  } catch (e) {}

  document.querySelector("#app").innerHTML = `
    <h1>🎵 Initiative Bard</h1>
    <div id="round-counter">Round 1</div>
    <div id="now-playing" class="hidden">♪ Now Playing...</div>
    <div id="initiative-list">
      <div id="empty-state">
        Right-click a <strong>character token</strong><br>and choose <em>Add to Initiative</em> to begin.
      </div>
    </div>
    <button id="next-turn-btn" disabled>⚔️ Next Turn</button>
    ${isGM ? `<button id="pause-music-btn">⏸ Pause Music</button>` : ""}
    <div id="song-modal-overlay">
      <div id="song-modal">
        <h2>🎵 Theme Song</h2>
        <p>Paste a YouTube URL. It will play automatically when this token's turn begins.</p>
        <input id="song-url-input" type="url" placeholder="https://www.youtube.com/watch?v=..." />
        <div class="modal-btns">
          <button id="song-save-btn">Save</button>
          <button id="song-clear-btn">Clear</button>
          <button id="song-cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  await loadState();

  async function setupSceneListeners() {
    const isReady = await OBR.scene.isReady();
    if (!isReady) return;

    const items = await OBR.scene.items.getItems((item) => item.layer === "CHARACTER");
    allItems = getInitiativeItems(items, META_KEY);
    renderList(EXT_ID, META_KEY);
    applyActiveEffects(META_KEY);

    OBR.scene.items.onChange(async (items) => {
      const characterItems = items.filter((item) => item.layer === "CHARACTER");
      allItems = getInitiativeItems(characterItems, META_KEY);
      if (currentState.currentIndex >= allItems.length && allItems.length > 0) {
        currentState.currentIndex = 0;
      }
      renderList(EXT_ID, META_KEY);
      applyActiveEffects(META_KEY);
    });
  }

  OBR.scene.onReadyChange(async (ready) => {
    if (ready) await setupSceneListeners();
    else { allItems = []; renderList(EXT_ID, META_KEY); }
  });

  await setupSceneListeners();

  OBR.room.onMetadataChange((meta) => {
    const state = meta[ROOM_KEY];
    if (state) {
      currentState = state;
      renderList(EXT_ID, META_KEY);
      applyActiveEffects(META_KEY);
    }
  });

  document.getElementById("next-turn-btn").addEventListener("click", async () => {
    if (allItems.length === 0) return;
    currentState.currentIndex = (currentState.currentIndex + 1) % allItems.length;
    if (currentState.currentIndex === 0) currentState.round++;
    isMusicPaused = false;
    updatePauseButton();
    await saveState();
    renderList(EXT_ID, META_KEY);
    applyActiveEffects(META_KEY);
  });

  if (isGM) {
    document.getElementById("pause-music-btn").addEventListener("click", () => {
      isMusicPaused = !isMusicPaused;
      if (isMusicPaused) {
        pauseThemeSong();
      } else {
        resumeThemeSong();
      }
      updatePauseButton();
    });
  }

  document.getElementById("song-cancel-btn").addEventListener("click", closeSongModal);
  document.getElementById("song-modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("song-modal-overlay")) closeSongModal();
  });
  document.getElementById("song-save-btn").addEventListener("click", async () => {
    const url = document.getElementById("song-url-input").value.trim();
    await saveSong(url, META_KEY);
    closeSongModal();
  });
  document.getElementById("song-clear-btn").addEventListener("click", async () => {
    await saveSong("", META_KEY);
    closeSongModal();
  });
}

function updatePauseButton() {
  const btn = document.getElementById("pause-music-btn");
  if (!btn) return;
  btn.textContent = isMusicPaused ? "▶ Resume Music" : "⏸ Pause Music";
}

function renderList(EXT_ID, META_KEY) {
  const list = document.getElementById("initiative-list");
  const nextBtn = document.getElementById("next-turn-btn");
  const roundCounter = document.getElementById("round-counter");
  if (!list) return;

  roundCounter.textContent = `Round ${currentState.round}`;

  if (allItems.length === 0) {
    list.innerHTML = `<div id="empty-state">
      Right-click a <strong>character token</strong><br>and choose <em>Add to Initiative</em> to begin.
    </div>`;
    nextBtn.disabled = true;
    return;
  }

  nextBtn.disabled = false;
  list.innerHTML = "";

  allItems.forEach((item, index) => {
    const isActive = index === currentState.currentIndex;
    const itemMeta = item.metadata[META_KEY] || {};
    const initiative = itemMeta.initiative ?? 0;
    const hasSong = !!(itemMeta.themeSong && hasVideoId(itemMeta.themeSong));
    const displayName = getTokenName(item);

    const row = document.createElement("div");
    row.className = `init-row${isActive ? " active" : ""}`;
    row.dataset.itemId = item.id;
    row.innerHTML = `
      <div class="turn-indicator"></div>
      <span class="token-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
      <input class="init-input" type="number" value="${Number(initiative)}" min="-99" max="99" />
      <button class="song-btn ${hasSong ? "has-song" : ""}" data-id="${item.id}">
        ${hasSong ? "🎵" : "🎶"}
      </button>
    `;

    row.querySelector(".init-input").addEventListener("change", async (e) => {
      const val = parseInt(e.target.value, 10) || 0;
      await OBR.scene.items.updateItems([item.id], (items) => {
        for (const i of items) {
          if (i.metadata[META_KEY]) i.metadata[META_KEY].initiative = val;
        }
      });
    });

    row.querySelector(".song-btn").addEventListener("click", () => {
      openSongModal(item.id, itemMeta.themeSong ?? "");
    });

    list.appendChild(row);
  });
}

async function applyActiveEffects(META_KEY) {
  const activeItem = allItems[currentState.currentIndex] ?? null;
  await highlightToken(activeItem);
  handleMusic(activeItem, META_KEY);

  const nowPlaying = document.getElementById("now-playing");
  if (!nowPlaying) return;
  const song = activeItem?.metadata[META_KEY]?.themeSong ?? "";
  if (song && hasVideoId(song)) {
    nowPlaying.classList.remove("hidden");
    const name = getTokenName(activeItem);
    nowPlaying.textContent = `♪ ${name}'s theme`;
  } else {
    nowPlaying.classList.add("hidden");
  }
}

function openSongModal(itemId, currentUrl) {
  songModalTargetId = itemId;
  document.getElementById("song-url-input").value = currentUrl || "";
  document.getElementById("song-modal-overlay").classList.add("open");
  setTimeout(() => document.getElementById("song-url-input").focus(), 50);
}

function closeSongModal() {
  document.getElementById("song-modal-overlay").classList.remove("open");
  songModalTargetId = null;
}

async function saveSong(url, META_KEY) {
  if (!songModalTargetId) return;
  const id = songModalTargetId;
  try {
    await OBR.scene.items.updateItems([id], (items) => {
      for (const i of items) {
        if (i.metadata[META_KEY]) i.metadata[META_KEY].themeSong = url;
      }
    });
    OBR.notification.show(url ? `🎵 Theme song saved!` : `Theme song cleared.`, "SUCCESS");
  } catch (e) {}
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
