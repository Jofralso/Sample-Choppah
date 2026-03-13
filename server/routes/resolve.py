"""Resolve and search routes — metadata only, no downloads."""

import json
import subprocess

from flask import Blueprint, request, jsonify

from server.config import is_allowed_url

resolve_bp = Blueprint("resolve", __name__, url_prefix="/api")


@resolve_bp.route("/resolve", methods=["POST"])
def resolve_url():
    """Return title, duration, thumbnail for a URL (no download)."""
    data = request.get_json()
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    if not is_allowed_url(url):
        return jsonify({"error": "Only YouTube URLs are supported"}), 400

    try:
        result = subprocess.run(
            ["yt-dlp", "--no-playlist", "--dump-json", url],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return jsonify({"error": "Could not resolve URL", "detail": result.stderr[:500]}), 400

        info = json.loads(result.stdout)
        return jsonify({
            "url": url,
            "title": info.get("title", "Unknown"),
            "duration": info.get("duration", 0),
            "thumbnail": info.get("thumbnail", ""),
            "platform": info.get("extractor_key", "unknown"),
        })
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Resolve timed out"}), 504
    except json.JSONDecodeError:
        return jsonify({"error": "Bad metadata response"}), 500


@resolve_bp.route("/search", methods=["POST"])
def search_sources():
    """Search YouTube for tracks."""
    data = request.get_json()
    query = data.get("query", "").strip()
    platform = data.get("platform", "youtube").lower()
    limit = min(int(data.get("limit", 8)), 20)

    if not query:
        return jsonify({"error": "No query provided"}), 400

    search_prefix = "ytsearch"

    try:
        result = subprocess.run(
            [
                "yt-dlp", "--flat-playlist", "--dump-json",
                f"{search_prefix}{limit}:{query}",
            ],
            capture_output=True, text=True, timeout=30,
        )
        items = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            info = json.loads(line)
            items.append({
                "title": info.get("title", ""),
                "url": info.get("url") or info.get("webpage_url", ""),
                "duration": info.get("duration"),
                "thumbnail": (
                    info.get("thumbnails", [{}])[-1].get("url", "")
                    if info.get("thumbnails")
                    else ""
                ),
                "platform": platform,
            })
        return jsonify({"results": items})
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Search timed out"}), 504
    except Exception:
        return jsonify({"error": "Search failed"}), 500
