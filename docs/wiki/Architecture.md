# 🏗️ Architecture

> How the choppah is built under the hood. For contributors, curious DJs, and code diggers.

---

## Overview

Get Da Choppah is a **single-page web app** with a Python/Flask backend. The frontend runs entirely in the browser — no build tools, no bundler, no node_modules. The backend handles audio resolution, search, upload, and export.

```
┌──────────────────────────────────┐
│           Browser (UI)           │
│  ES Modules · YouTube/SC APIs   │
│  Drag & chop · Queue · Export   │
└──────────────┬───────────────────┘
               │ HTTP / REST
┌──────────────▼───────────────────┐
│         Flask Backend            │
│  URL resolve · Search · Upload   │
│  Audio download · Slice · Export │
│         (yt-dlp + ffmpeg)        │
└──────────────────────────────────┘
```

The frontend is responsible for **everything the user sees and touches** — the player, the stream bar, dragging regions, the queue, undo/redo. The backend is a **headless workhorse** — it resolves URLs, searches, serves uploaded files, and builds the final export file.

---

## Backend: Flask + Blueprints

### Entry Point

```
app.py → server/app_factory.py → create_app()
```

`app.py` is 7 lines. It imports `create_app()`, calls it, and runs the server. All the logic lives in the `server/` package.

### App Factory Pattern

`server/app_factory.py` defines `create_app()` which:
1. Creates the Flask app
2. Configures CORS and upload limits
3. Registers four blueprints (one per route module)
4. Returns the configured app

This pattern makes testing easy — you can create fresh app instances per test.

### Configuration

`server/config.py` holds all constants:
- **Paths**: `BASE_DIR`, `UPLOAD_DIR`, `EXPORT_DIR`, `STATIC_DIR`
- **Audio extensions**: `ALLOWED_AUDIO_EXT` — the set of file extensions accepted for upload
- **URL allowlist**: `ALLOWED_URL_PATTERNS` — regex patterns for accepted source URLs
- **`is_allowed_url()`** — validates URLs against the allowlist (security boundary)

### Route Blueprints

Each route module is a Flask Blueprint:

| Blueprint | File | Endpoints | What It Does |
|-----------|------|-----------|-------------|
| `static_bp` | `routes/static.py` | `/` , static files | Serves the single-page app |
| `resolve_bp` | `routes/resolve.py` | `/api/resolve`, `/api/search` | Resolves URLs via yt-dlp, searches YouTube |
| `upload_bp` | `routes/upload.py` | `/api/upload`, `/api/audio/<file>` | Handles file upload and serves uploaded audio |
| `export_bp` | `routes/export.py` | `/api/export`, `/api/exports/<file>` | Downloads audio, slices regions, concatenates, serves file |

### Export Flow (the core magic)

When the user hits export:

1. **Frontend** sends a POST to `/api/export` with:
   - Source URL or uploaded filename
   - `ordered_regions`: array of `{start, end}` in queue order
   - Output format (wav/mp3/flac)

2. **Backend** (`routes/export.py`):
   - Downloads the source audio via yt-dlp (URLs) or locates the uploaded file
   - For each region, uses pydub to slice the audio at the exact timestamps
   - Inserts 1 second of silence between each slice
   - Concatenates everything into one file
   - Exports in the requested format via ffmpeg
   - Returns the file for download

### Security

- **URL allowlist**: Only YouTube and SoundCloud URLs are accepted. No arbitrary URL fetching (prevents SSRF).
- **File extension validation**: Only known audio extensions are accepted for upload.
- **Upload size limit**: Configured via `MAX_CONTENT_LENGTH`.
- **No shell injection**: All subprocess calls use array arguments, never string interpolation.

---

## Frontend: Vanilla JS ES Modules

### No Build Step

The frontend is plain HTML + CSS + JavaScript ES modules. No webpack, no Vite, no npm. The browser loads modules natively via `<script type="module">`.

### Module Map

```
main.js           ← Entry point. Init, keybinds, boot.
  ├── state.js    ← Global state, undo/redo stacks, overlap detection
  ├── dom.js      ← DOM element references (cached once)
  ├── helpers.js  ← Pure utility functions (uid, format, escape, etc.)
  ├── sources.js  ← Source creation, URL handling, search, upload
  ├── players.js  ← YouTube IFrame API, SoundCloud Widget, HTML5 Audio
  ├── bar.js      ← Stream bar interactions: drag-to-select, move, resize
  ├── render.js   ← Renders regions, chips, queue, timeline, counts
  ├── precision.js← Precision overlay: zoomed refinement
  └── export.js   ← Export button handler
```

### State Management

`state.js` is the source of truth. It holds:
- The active source and its regions
- The export queue (ordered list of region references)
- Undo/redo history stacks
- An `onRestore` callback that `main.js` wires to re-render on undo/redo

State mutations go through helper functions that push onto the undo stack before making changes. This gives free undo/redo across all operations.

### Overlap Prevention

`state.js` exports an overlap detection function. Before any region is created, moved, or resized, the new bounds are checked against all existing regions for that source. If there's overlap, the operation is rejected or clamped.

### Player Abstraction

`players.js` manages three player types behind a unified interface:
- **YouTube**: Loads via YouTube IFrame API, controls via `YT.Player`
- **SoundCloud**: Loads via SC Widget API, controls via `SC.Widget`
- **Local files**: HTML5 `<audio>` element

Each player provides: play, pause, seek, getCurrentTime, getDuration. The rest of the app doesn't care which player is active.

### Rendering

`render.js` handles all DOM updates:
- **Bar regions**: colored blocks on the stream bar
- **Region chips**: labeled blocks with timestamps, ready toggle, delete button
- **Export queue**: draggable list of ready regions
- **Timeline strip**: proportional preview of the final export
- **Counts**: region count, ready count, total duration

### Stream Bar Interactions

`bar.js` handles all mouse events on the stream bar:
- **Drag-to-select**: click and drag on empty space to create a new region
- **Move**: click and drag a region body to slide it
- **Resize**: click and drag a region edge to extend/shrink

All three operations respect overlap prevention and push undo state.

---

## CSS Architecture

```
style.css         ← Hub file, just @import statements
  ├── css/base.css       ← Variables, reset, body, typography
  ├── css/header.css     ← Logo, URL bar, buttons, search
  ├── css/layout.css     ← Two-column grid layout, labels
  ├── css/sources.css    ← Source cards, stream bar, player controls
  ├── css/regions.css    ← Bar regions, resize handles, chips
  ├── css/queue.css      ← Export queue, timeline strip
  └── css/overlays.css   ← Export overlay, precision overlay
```

### Design System

- **Background**: `#050505` (near black)
- **Accent**: `#ffcc00` (yellow — like a vinyl label)
- **Fonts**: JetBrains Mono (code/data) + Space Grotesk (UI text)
- **Style**: Dark, utilitarian, no unnecessary decoration

---

## Testing

### Backend Tests (pytest)

`tests/test_app.py` — 34 tests covering:
- URL validation (allowlist enforcement)
- File upload (valid/invalid extensions, size limits)
- Resolve endpoint (YouTube, SoundCloud, error handling)
- Search endpoint
- Export endpoint (ordered regions, format selection, error cases)
- Static file serving

Run with: `python -m pytest tests/test_app.py -v -p no:flaky`

### Frontend Tests (Node.js)

`tests/test_frontend.js` — 56 tests covering:
- Helper functions (uid generation, time formatting, HTML escaping, etc.)
- State management (region creation, overlap detection)
- Undo/redo logic
- Color cycling
- Region operations

Run with: `node tests/test_frontend.js`

### CI

GitHub Actions runs both test suites on every push and PR:
- **Matrix**: Ubuntu + macOS + Windows × Python 3.10–3.13
- **Frontend**: Node 20

---

## Key Design Decisions

### Why No Build Tools?

Scratch DJs aren't webpack developers. The app should be hackable by anyone who knows basic HTML/CSS/JS. ES modules work natively in every modern browser. No build step means no barrier.

### Why Flask?

Lightweight, minimal, gets out of the way. The backend is mostly subprocess calls to yt-dlp and ffmpeg. Flask is the thinnest possible wrapper around that.

### Why yt-dlp?

It resolves YouTube and SoundCloud URLs, extracts audio streams, and handles all the gnarly platform-specific stuff. Battle-tested, actively maintained.

### Why 1-Second Gaps?

Standard spacing for scratch practice tracks. Long enough to find the next cue point, short enough to keep the flow.

### Why App Factory Pattern?

Testability. Each test creates a fresh app instance. No global state leaking between tests.

---

<p align="center"><em>Dig through the code like you dig through crates. 🔪💿</em></p>
