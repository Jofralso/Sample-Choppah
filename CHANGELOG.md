# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-01

### Added
- YouTube source support with metadata resolution
- SoundCloud source support
- Server-side audio streaming via yt-dlp (`/api/stream`) with local caching
- Drag-to-select region chopping on stream bars
- Per-region color coding
- Draggable and resizable regions with overlap prevention
- Precision overlay for fine-tuning region boundaries
- Export queue with drag reorder
- Ready-state gating — only export ready (✓) regions
- Export to WAV / MP3 / FLAC with configurable gap duration (0–10s, default 1s)
- Export preview — listen before you download
- Ordered export respecting queue position
- Backward-compatible grouped source format
- Undo / Redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y)
- Local file upload with ffmpeg conversion
- Search YouTube from the input bar
- Playback preview per source and per region
- Timeline strip visualizing the final export

### Architecture
- Modular backend: Flask blueprints under `server/routes/`
- App factory pattern in `server/app_factory.py`
- Audio streaming proxy with SHA-256 cache in `_cache/`
- All playback via HTML5 Audio (no third-party embed APIs)
- Frontend ES modules under `static/js/`
- CSS partials under `static/css/`
- 42 backend tests, 56 frontend logic tests
