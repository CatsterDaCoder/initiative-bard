# 🎵 Initiative Bard — Owlbear Rodeo Plugin

An initiative tracker with **per-token YouTube theme songs**. When a token's turn begins, its theme song plays automatically. When the turn advances, the music stops.

---

## Features

- ✅ Sortable initiative list (editable by everyone, synced in real-time)
- ✅ Active token highlighted in the panel **and** outlined on the map
- ✅ ⚔️ Next Turn button cycles through initiative order (loops back, tracks rounds)
- ✅ Right-click → **Add to Initiative** / **Remove from Initiative**
- ✅ Right-click → **Set Theme Song** (paste a YouTube URL)
- ✅ 🎵 Theme song button on each row in the panel (alternative to right-click)
- ✅ Music plays when a token's turn starts, stops when it ends

---

## Setup & Development

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Yarn](https://yarnpkg.com/) (`npm install -g yarn`) or npm

### Install dependencies
```bash
yarn install
# or: npm install
```

### Run locally (for testing)
```bash
yarn dev
# or: npm run dev
```

This starts a local dev server, typically at `http://localhost:5173`.

Owlbear Rodeo will load your extension from:
```
http://localhost:5173/manifest.json
```

> **Important:** OBR embeds extensions as iframes. Chrome may block `localhost` in iframes. Use the Owlbear Rodeo desktop app, or use a tunnel like `ngrok` or `localtunnel` for browser testing.

### Build for production
```bash
yarn build
# or: npm run build
```

Output goes to the `dist/` folder. Host this folder anywhere (see below).

---

## Hosting (Required to share with players)

OBR extensions must be hosted on a public HTTPS URL. Free options:

### Option A — GitHub Pages (Recommended)
1. Push your repo to GitHub
2. Go to Settings → Pages → Source: `GitHub Actions`
3. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: yarn install && yarn build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Your manifest will then be at:
```
https://<your-username>.github.io/<repo-name>/manifest.json
```

### Option B — Netlify / Vercel
- Connect your repo; set build command to `yarn build`, publish dir to `dist`.

---

## Loading the Plugin into Owlbear Rodeo

1. Open your Owlbear Rodeo room
2. Click the **puzzle piece icon** (Extensions) in the top-left area
3. Click **"Add Extension"**
4. Paste your manifest URL, e.g.:
   ```
   https://yourusername.github.io/initiative-bard/manifest.json
   ```
   *(or `http://localhost:5173/manifest.json` for local dev)*
5. Click **Add** — the 🎵 icon will appear in your extension bar

---

## How to Use

### Adding tokens to initiative
1. Place character tokens on the map (must be on the **Character** layer)
2. Right-click a token → **Add to Initiative**
3. The token appears in the Initiative Bard panel

### Setting initiative values
- Click the number field next to any token name and type a new value
- The list re-sorts automatically, highest first
- Changes sync to all players instantly

### Setting a theme song
**Method 1 (right-click):**
- Right-click a token that's in initiative → **Set Theme Song**
- Paste a YouTube URL

**Method 2 (panel):**
- Click the 🎶 icon on any row in the panel
- Paste a YouTube URL in the modal, click **Save**

Supported URL formats:
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://youtu.be/dQw4w9WgXcQ`

### Taking turns
- Click **⚔️ Next Turn** to advance
- The active token is highlighted in the panel and outlined on the map
- If that token has a theme song, it plays immediately
- When the turn advances, music stops and the next token's song (if any) plays
- The round counter increments when the list loops back to the top

---

## Technical Notes

- Initiative scores and theme song URLs are stored in **OBR item metadata** — they persist with the scene and sync to all players automatically
- The current turn and round number are stored in **OBR room metadata** — also synced to all players
- YouTube playback uses the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) loaded at runtime. The player is hidden off-screen; only audio matters
- The plugin does **not** require any server — it's 100% client-side

---

## Project Structure

```
initiative-bard/
├── public/
│   ├── manifest.json   ← OBR extension manifest
│   ├── icon.svg        ← toolbar icon
│   ├── add.svg         ← context menu icon
│   ├── remove.svg      ← context menu icon
│   └── music.svg       ← context menu icon
├── src/
│   ├── main.js         ← entry point (OBR.onReady)
│   ├── contextMenu.js  ← right-click menu setup
│   ├── tracker.js      ← UI rendering & state management
│   ├── youtube.js      ← YouTube IFrame API wrapper
│   └── style.css       ← dark fantasy theme styles
├── index.html
├── package.json
└── vite.config.js
```
