"""Upload and audio serving routes."""

import uuid
import subprocess
from pathlib import Path

from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename

from server.config import UPLOAD_DIR, ALLOWED_AUDIO_EXT

upload_bp = Blueprint("upload", __name__, url_prefix="/api")


@upload_bp.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    ext = Path(f.filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXT:
        return jsonify({"error": f"Unsupported format: {ext}"}), 400

    file_id = uuid.uuid4().hex[:12]
    original = UPLOAD_DIR / f"{file_id}_original{ext}"
    wav_path = UPLOAD_DIR / f"{file_id}.wav"

    f.save(original)
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(original),
             "-ac", "2", "-ar", "44100", "-sample_fmt", "s16", str(wav_path)],
            check=True, capture_output=True,
        )
    except subprocess.CalledProcessError:
        original.unlink(missing_ok=True)
        return jsonify({"error": "Failed to process audio"}), 500

    return jsonify({
        "file_id": file_id,
        "filename": f.filename,
        "audio_url": f"/api/audio/{file_id}.wav",
    })


@upload_bp.route("/audio/<filename>")
def serve_audio(filename):
    safe = secure_filename(filename)
    fp = UPLOAD_DIR / safe
    if not fp.exists() or not fp.resolve().is_relative_to(UPLOAD_DIR.resolve()):
        return jsonify({"error": "Not found"}), 404
    return send_file(fp, mimetype="audio/wav")
