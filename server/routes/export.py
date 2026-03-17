"""Export route — download, extract regions, concatenate."""

import re
import uuid
import shutil
import subprocess
import tempfile
from pathlib import Path

from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename

from server.config import UPLOAD_DIR, EXPORT_DIR, ALLOWED_AUDIO_EXT, is_allowed_url

export_bp = Blueprint("export", __name__, url_prefix="/api")


@export_bp.route("/export", methods=["POST"])
def export_samples():
    """
    Accepts either:
      { "ordered_regions": [{ type, url|file_id, start, end }, ...] }
    or legacy grouped format:
      { "sources": [{ type, url|file_id, regions: [{start, end}] }] }
    """
    data = request.get_json()
    ordered_regions = data.get("ordered_regions", [])

    # Backward compat: flatten old grouped format
    if not ordered_regions:
        for src in data.get("sources", []):
            for reg in src.get("regions", []):
                ordered_regions.append({
                    "type": src.get("type"),
                    "url": src.get("url"),
                    "file_id": src.get("file_id"),
                    "start": reg["start"],
                    "end": reg["end"],
                })

    if not ordered_regions:
        return jsonify({"error": "No sources provided"}), 400

    out_format = data.get("format", "wav").lower()
    if out_format not in ("wav", "mp3", "flac"):
        out_format = "wav"

    gap_duration = min(10.0, max(0.0, float(data.get("gap_duration", 1))))

    export_id = uuid.uuid4().hex[:8]
    tmp_dir = Path(tempfile.mkdtemp())

    try:
        # --- generate silence gap ----------------------------------------
        silence = tmp_dir / "silence.wav"
        if gap_duration > 0:
            subprocess.run(
                ["ffmpeg", "-y", "-f", "lavfi",
                 "-i", "anullsrc=r=44100:cl=stereo",
                 "-t", str(gap_duration), "-sample_fmt", "s16", str(silence)],
                check=True, capture_output=True,
            )

        # --- Phase 1: download/locate unique sources ---------------------
        source_wavs: dict[str, Path] = {}

        for reg in ordered_regions:
            if reg.get("type") == "url":
                url = reg.get("url", "")
                if url in source_wavs or not is_allowed_url(url):
                    continue
                src_wav = tmp_dir / f"src_{len(source_wavs)}.wav"
                dl_dir = tmp_dir / f"dl_{len(source_wavs)}"
                dl_dir.mkdir()
                r = subprocess.run(
                    [
                        "yt-dlp", "--no-playlist",
                        "--extract-audio", "--audio-format", "wav",
                        "--audio-quality", "0",
                        "-o", str(dl_dir / "audio.%(ext)s"),
                        url,
                    ],
                    capture_output=True, text=True, timeout=600,
                )
                if r.returncode != 0:
                    continue
                downloaded = None
                for f in dl_dir.iterdir():
                    if f.suffix.lower() in ALLOWED_AUDIO_EXT | {".wav"}:
                        downloaded = f
                        break
                if not downloaded:
                    continue
                if downloaded.suffix.lower() == ".wav":
                    shutil.move(str(downloaded), str(src_wav))
                else:
                    subprocess.run(
                        ["ffmpeg", "-y", "-i", str(downloaded),
                         "-ac", "2", "-ar", "44100", "-sample_fmt", "s16",
                         str(src_wav)],
                        check=True, capture_output=True,
                    )
                if src_wav.exists():
                    source_wavs[url] = src_wav

            elif reg.get("type") == "file":
                fid = reg.get("file_id", "")
                if fid in source_wavs:
                    continue
                if not re.match(r'^[a-f0-9]+$', fid):
                    continue
                existing = UPLOAD_DIR / f"{fid}.wav"
                if existing.exists():
                    source_wavs[fid] = existing

        # --- Phase 2: extract regions in queue order ---------------------
        all_parts: list[Path] = []

        for ri, reg in enumerate(ordered_regions):
            key = reg.get("url", "") if reg.get("type") == "url" else reg.get("file_id", "")
            src_wav = source_wavs.get(key)
            if not src_wav or not src_wav.exists():
                continue
            start = float(reg["start"])
            end = float(reg["end"])
            dur = end - start
            if dur <= 0:
                continue
            part = tmp_dir / f"part_{ri:03d}.wav"
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(src_wav),
                 "-ss", str(start), "-t", str(dur),
                 "-ac", "2", "-ar", "44100", "-sample_fmt", "s16",
                 str(part)],
                check=True, capture_output=True,
            )
            all_parts.append(part)

        if not all_parts:
            return jsonify({"error": "No valid regions to export"}), 400

        # --- concatenate with silence between parts ----------------------
        concat_txt = tmp_dir / "concat.txt"
        with open(concat_txt, "w") as f:
            for i, p in enumerate(all_parts):
                f.write(f"file '{p}'\n")
                if gap_duration > 0 and i < len(all_parts) - 1:
                    f.write(f"file '{silence}'\n")

        ext_map = {"wav": ".wav", "mp3": ".mp3", "flac": ".flac"}
        out_ext = ext_map[out_format]
        output = EXPORT_DIR / f"samples_{export_id}{out_ext}"

        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_txt),
            "-ac", "2", "-ar", "44100",
        ]
        if out_format == "wav":
            cmd += ["-sample_fmt", "s16"]
        elif out_format == "mp3":
            cmd += ["-b:a", "320k"]
        cmd.append(str(output))

        subprocess.run(cmd, check=True, capture_output=True)

        return jsonify({
            "download_url": f"/api/exports/{output.name}",
            "filename": output.name,
            "regions_count": len(all_parts),
        })

    except Exception as e:
        return jsonify({"error": f"Export failed: {str(e)}"}), 500
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@export_bp.route("/exports/<filename>")
def serve_export(filename):
    safe = secure_filename(filename)
    fp = EXPORT_DIR / safe
    if not fp.exists() or not fp.resolve().is_relative_to(EXPORT_DIR.resolve()):
        return jsonify({"error": "Not found"}), 404
    return send_file(fp, as_attachment=True)
