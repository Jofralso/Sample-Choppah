"""Application configuration and constants."""

import re
from pathlib import Path

# ── Paths ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
EXPORT_DIR = BASE_DIR / "exports"
STATIC_DIR = BASE_DIR / "static"

UPLOAD_DIR.mkdir(exist_ok=True)
EXPORT_DIR.mkdir(exist_ok=True)

# ── Audio ─────────────────────────────────────────────
ALLOWED_AUDIO_EXT = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".webm", ".opus"}
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500 MB

# ── URL allowlist ─────────────────────────────────────
ALLOWED_URL_PATTERNS = [
    # YouTube variants
    r"^https?://(www\.)?youtube\.com/watch\?v=[\w-]+",
    r"^https?://youtu\.be/[\w-]+",
    r"^https?://music\.youtube\.com/watch\?v=[\w-]+",
    r"^https?://(www\.)?youtube\.com/shorts/[\w-]+",
    r"^https?://(www\.)?youtube\.com/embed/[\w-]+",
    r"^https?://(www\.)?youtube\.com/live/[\w-]+",
    r"^https?://(www\.)?youtube-nocookie\.com/embed/[\w-]+",
    # SoundCloud variants
    r"^https?://(www\.)?soundcloud\.com/[\w-]+/[\w-]+",
    r"^https?://(m\.)?soundcloud\.com/[\w-]+/[\w-]+",
    r"^https?://on\.soundcloud\.com/[\w-]+",
]


def is_allowed_url(url: str) -> bool:
    """Check if a URL matches the allowlist patterns."""
    return any(re.match(p, url) for p in ALLOWED_URL_PATTERNS)
