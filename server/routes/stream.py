"""Stream audio from YouTube/SoundCloud URLs via yt-dlp with local caching."""

import hashlib
import logging
import subprocess

from flask import Blueprint, request, send_file, abort

from server.config import is_allowed_url, BASE_DIR

log = logging.getLogger(__name__)

stream_bp = Blueprint("stream", __name__, url_prefix="/api")

CACHE_DIR = BASE_DIR / "_cache"
CACHE_DIR.mkdir(exist_ok=True)


@stream_bp.route("/stream")
def stream_audio():
    """Download (or serve cached) audio for a URL source."""
    url = request.args.get("url", "").strip()
    if not url or not is_allowed_url(url):
        abort(403)

    tag = hashlib.sha256(url.encode()).hexdigest()[:16]

    # Serve from cache if available
    cached = list(CACHE_DIR.glob(f"{tag}.*"))
    if cached:
        return send_file(cached[0])

    # Download best audio via yt-dlp (with Node.js runtime for YT extraction)
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "-f", "bestaudio/best",
                "--no-playlist",
                "--retries", "3",
                "--js-runtimes", "node",
                "-o", str(CACHE_DIR / f"{tag}.%(ext)s"),
                url,
            ],
            capture_output=True, text=True, timeout=120,
        )
    except subprocess.TimeoutExpired:
        log.error("yt-dlp timed out for %s", url)
        abort(504)
    except FileNotFoundError:
        log.error("yt-dlp binary not found")
        abort(502)

    if result.returncode != 0:
        log.error("yt-dlp failed for %s:\n%s", url, result.stderr)
        abort(502)

    cached = list(CACHE_DIR.glob(f"{tag}.*"))
    if not cached:
        abort(502)

    return send_file(cached[0])
