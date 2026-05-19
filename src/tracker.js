import OBR from "@owlbear-rodeo/sdk";
import { playThemeSong, stopThemeSong, hasVideoId } from "./youtube.js";

const ROOM_KEY = "com.initiativebard/state";

/**
 * Shared state stored in OBR room metadata:
 * {
 *   currentIndex: number   // index (into sorted list) of whose turn it is
 *   round: number          // round counter
 * }
 *
 * Per-token data is stored in token item metadata (initiative, themeSong).
 */

let currentState = { currentIndex: 0, round: 1 };
let allItems = []; // sorted initiative list
let currentSongUrl = "";
let songModalTargetId = null;

// ─── Helpers ───────────────────────────────────────────────────────────────

function metaKey(EXT_ID) {
  return `${EXT_ID}/metadata`;
}

function getInitiativeItems(items, META_KEY) {
  return items
    .filter((item) => item.metadata[META_KEY] !== undefined)
    .sort((a, b) => {
      const aVal = Number(a.metadata[META_KEY]?.initiative ?? 0);
      const bVal = Number(b.metadata[META_KEY]?.initiative ?? 0);
      return bVal - aVal; // descending
    });
}

async function loadState(EXT_ID) {
  const meta = await OBR.room.getMetadata();
  const state = meta[ROOM_KEY];
  if (state) currentState = state;
}

async function saveState() {
  await OBR.room.setMetadata({ [ROOM_KEY]: currentState });
}

// ─── Token highlight (OBR scene selection + outline) ──────────────────────

let lastHighlightedIds = [];

async function highlightToken(item) {
  // Clear previous
  if (lastHighlightedIds.length > 0) {
    await OBR.scene.items.updateItems(lastHighlightedIds, (items) => {
      for (const i of items) {
        i.outlined = false;
      }
    });
  }

  if (!item) {
    lastHighlightedIds = [];
    return;
  }

  await OBR.scene.items.updateItems([item], (items) => {
    for (const i of items) {
      i.outlined = true;
    }
  });
  lastHighlightedIds = [item];
}

// ─── Music ────────────────────────────────────────────────────────────────

function handleMusic(activeItem, META_KEY) {
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

// ─── Render ───────────────────────────────────────────────────────────────

export async function renderTracker(EXT_ID) {
  const META_KEY = metaKey(EXT_ID);

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

    <!-- Song modal -->
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

  await loadState(EXT_ID);

  // Subscribe to scene item changes
  OBR.scene.items.onChange(async (items) => {
    allItems = getInitiativeItems(items, META_KEY);

    // Guard currentIndex bounds
    if (currentState.currentIndex >= allItems.length && allItems.length > 0) {
      currentState.currentIndex = 0;
    }

    renderList(EXT_ID, META_KEY);
    applyActiveEffects(META_KEY);
  });

  // Subscribe to room metadata (so turn changes from others sync)
  OBR.room.onMetadataChange((meta) => {
    const state = meta[ROOM_KEY];
    if (state) {
      currentState = state;
      renderList(EXT_ID, META_KEY);
      applyActiveEffects(META_KEY);
    }
  });

  // Initial load
  const items = await OBR.scene.items.getAll();
  allItems = getInitiativeItems(items, META_KEY);
  renderList(EXT_ID, META_KEY);
  applyActiveEffects(META_KEY);

  // Next Turn button
  document.getElementById("next-turn-btn").addEventListener("click", async () => {
    if (allItems.length === 0) return;
    currentState.currentIndex = (currentState.currentIndex + 1) % allItems.length;
    if (currentState.currentIndex === 0) currentState.round++;
    await saveState();
    renderList(EXT_ID, META_KEY);
    applyActiveEffects(META_KEY);
  });

  // Song modal wiring
  document.getElementById("song-cancel-btn").addEventListener("click", closeSongModal);
  document.getElementById("song-modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("song-modal-overlay")) closeSongModal();
  });

  document.getElementById("song-save-btn").addEventListener("click", async () => {
    const url = document.getElementById("song-url-input").value.trim();
    await saveSong(url, EXT_ID, META_KEY);
    closeSongModal();
  });

  document.getElementById("song-clear-btn").addEventListener("click", async () => {
    await saveSong("", EXT_ID, META_KEY);
    closeSongModal();
  });
}

// ─── List Render ──────────────────────────────────────────────────────────

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

    const row = document.createElement("div");
    row.className = `init-row${isActive ? " active" : ""}`;
    row.dataset.itemId = item.id;
    row.innerHTML = `
      <div class="turn-indicator"></div>
      <span class="token-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
      <input
        class="init-input"
        type="number"
        value="${Number(initiative)}"
        min="-99"
        max="99"
        title="Initiative score"
      />
      <button class="song-btn ${hasSong ? "has-song" : ""}" title="${hasSong ? "Edit theme song" : "Add theme song"}" data-id="${item.id}">
        ${hasSong ? "🎵" : "🎶"}
      </button>
    `;

    // Initiative input: update item metadata on change (syncs to all players via OBR)
    const input = row.querySelector(".init-input");
    input.addEventListener("change", async (e) => {
      const val = parseInt(e.target.value, 10) || 0;
      await OBR.scene.items.updateItems([item], (items) => {
        for (const i of items) {
          if (i.metadata[META_KEY]) {
            i.metadata[META_KEY].initiative = val;
          }
        }
      });
    });

    // Song button
    const songBtn = row.querySelector(".song-btn");
    songBtn.addEventListener("click", () => {
      openSongModal(item.id, itemMeta.themeSong ?? "");
    });

    list.appendChild(row);
  });
}

// ─── Active Effects ───────────────────────────────────────────────────────

async function applyActiveEffects(META_KEY) {
  const activeItem = allItems[currentState.currentIndex] ?? null;
  await highlightToken(activeItem);
  handleMusic(activeItem, META_KEY);

  // Now-playing indicator
  const nowPlaying = document.getElementById("now-playing");
  if (!nowPlaying) return;
  const song = activeItem?.metadata[META_KEY]?.themeSong ?? "";
  if (song && hasVideoId(song)) {
    nowPlaying.classList.remove("hidden");
    nowPlaying.textContent = `♪ ${activeItem.name}'s theme`;
  } else {
    nowPlaying.classList.add("hidden");
  }
}

// ─── Song Modal ───────────────────────────────────────────────────────────

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

async function saveSong(url, EXT_ID, META_KEY) {
  if (!songModalTargetId) return;
  const id = songModalTargetId;

  const items = await OBR.scene.items.getAll();
  const target = items.find((i) => i.id === id);
  if (!target) return;

  await OBR.scene.items.updateItems([target], (items) => {
    for (const i of items) {
      if (i.metadata[META_KEY]) {
        i.metadata[META_KEY].themeSong = url;
      }
    }
  });

  OBR.notification.show(
    url ? `🎵 Theme song saved!` : `Theme song cleared.`,
    "SUCCESS"
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
