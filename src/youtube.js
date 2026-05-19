/**
 * Minimal YouTube IFrame wrapper.
 * Injects a hidden iframe into the document and controls it via postMessage.
 */

let player = null;
let playerReady = false;
let pendingVideoId = null;

function extractVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // youtu.be/ID
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    // youtube.com/watch?v=ID
    const v = u.searchParams.get("v");
    if (v) return v;
    // youtube.com/embed/ID
    const parts = u.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx !== -1) return parts[embedIdx + 1];
  } catch (_) {}
  return null;
}

function initYT() {
  if (window.YT && window.YT.Player) {
    createPlayer();
    return;
  }
  // Load the IFrame Player API
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = createPlayer;
}

function createPlayer() {
  const container = document.createElement("div");
  container.id = "yt-player-container";
  container.style.cssText =
    "position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(container);

  const div = document.createElement("div");
  div.id = "yt-player";
  container.appendChild(div);

  player = new window.YT.Player("yt-player", {
    height: "1",
    width: "1",
    playerVars: {
      autoplay: 1,
      controls: 0,
      modestbranding: 1,
      loop: 1,
      playsinline: 1,
    },
    events: {
      onReady() {
        playerReady = true;
        player.setVolume(60);
        if (pendingVideoId) {
          player.loadVideoById(pendingVideoId);
          pendingVideoId = null;
        }
      },
    },
  });
}

export function playThemeSong(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return;

  if (!player) {
    initYT();
    pendingVideoId = videoId;
    return;
  }

  if (!playerReady) {
    pendingVideoId = videoId;
    return;
  }

  player.loadVideoById(videoId);
}

export function stopThemeSong() {
  if (player && playerReady) {
    try {
      player.stopVideo();
    } catch (_) {}
  }
  pendingVideoId = null;
}

export function hasVideoId(url) {
  return !!extractVideoId(url);
}
