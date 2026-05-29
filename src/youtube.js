let player = null;
let playerReady = false;
let pendingVideoId = null;

function extractVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    const v = u.searchParams.get("v");
    if (v) return v;
    const parts = u.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx !== -1) return parts[embedIdx + 1];
  } catch (_) {}
  return null;
}

function initYT() {
  if (window.YT && window.YT.Player) { createPlayer(); return; }
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = createPlayer;
}

function createPlayer() {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
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
      playsinline: 1,
      loop: 1,
    },
    events: {
      onReady() {
        playerReady = true;
        player.setVolume(70);
        if (pendingVideoId) {
          loadAndLoop(pendingVideoId);
          pendingVideoId = null;
        }
      },
    },
  });
}

function loadAndLoop(videoId) {
  // Setting playlist to the same videoId is the correct way to loop a single video
  player.loadVideoById({ videoId, startSeconds: 0 });
  // After load, re-apply loop via cueVideoById trick isn't needed —
  // instead we listen for state change to STATE=0 (ended) and restart
  player.addEventListener("onStateChange", (event) => {
    if (event.data === window.YT.PlayerState.ENDED) {
      player.seekTo(0);
      player.playVideo();
    }
  });
}

export function playThemeSong(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return;
  if (!player) { initYT(); pendingVideoId = videoId; return; }
  if (!playerReady) { pendingVideoId = videoId; return; }
  loadAndLoop(videoId);
}

export function stopThemeSong() {
  if (player && playerReady) {
    try { player.stopVideo(); } catch (_) {}
  }
  pendingVideoId = null;
}

export function pauseThemeSong() {
  if (player && playerReady) {
    try { player.pauseVideo(); } catch (_) {}
  }
}

export function resumeThemeSong() {
  if (player && playerReady) {
    try { player.playVideo(); } catch (_) {}
  }
}

export function hasVideoId(url) {
  return !!extractVideoId(url);
}
export function setVolume(vol) {
  if (player && playerReady) {
    try { player.setVolume(vol); } catch (_) {}
  }
}
