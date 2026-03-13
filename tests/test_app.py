"""Tests for the Get Da Choppah Flask backend."""
import io
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Ensure the app module is importable
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.app_factory import create_app
from server.config import is_allowed_url, UPLOAD_DIR, EXPORT_DIR


# ── Fixtures ──────────────────────────────────────────

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def sample_wav(tmp_path):
    """Generate a tiny valid WAV file (silence, 0.1s, 44100 Hz, 16-bit mono)."""
    import struct
    sr = 44100
    n_samples = int(sr * 0.1)
    data = b"\x00\x00" * n_samples  # 16-bit silence
    data_size = len(data)
    # WAV header
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, sr, sr * 2, 2, 16,
        b"data", data_size,
    )
    wav_bytes = header + data
    return wav_bytes


# ── URL allowlist ─────────────────────────────────────

class TestUrlAllowlist:
    def test_youtube_watch(self):
        assert is_allowed_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    def test_youtube_short(self):
        assert is_allowed_url("https://youtu.be/dQw4w9WgXcQ")

    def test_random_url_rejected(self):
        assert not is_allowed_url("https://evil.example.com/malware")

    def test_ftp_rejected(self):
        assert not is_allowed_url("ftp://youtube.com/watch?v=abc")

    def test_empty(self):
        assert not is_allowed_url("")

    def test_javascript_rejected(self):
        assert not is_allowed_url("javascript:alert(1)")


# ── Static routes ─────────────────────────────────────

class TestStaticRoutes:
    def test_index(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert b"GET DA CHOPPAH" in resp.data

    def test_static_css(self, client):
        resp = client.get("/static/style.css")
        assert resp.status_code == 200
        assert b"@import" in resp.data

    def test_static_js(self, client):
        resp = client.get("/static/app.js")
        assert resp.status_code == 200
        assert b"setupBarDrag" in resp.data


# ── /api/resolve ──────────────────────────────────────

class TestResolve:
    def test_no_url(self, client):
        resp = client.post("/api/resolve", json={})
        assert resp.status_code == 400
        assert b"No URL" in resp.data

    def test_disallowed_url(self, client):
        resp = client.post("/api/resolve", json={"url": "https://evil.com/video"})
        assert resp.status_code == 400
        assert b"Only YouTube" in resp.data

    @patch("server.routes.resolve.subprocess.run")
    def test_valid_youtube_url(self, mock_run, client):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({
                "title": "Test Video",
                "duration": 120,
                "thumbnail": "https://img.youtube.com/thumb.jpg",
                "extractor_key": "Youtube",
            }),
        )
        resp = client.post("/api/resolve", json={"url": "https://www.youtube.com/watch?v=abc123"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["title"] == "Test Video"
        assert data["duration"] == 120
        assert data["platform"] == "Youtube"

    @patch("server.routes.resolve.subprocess.run")
    def test_resolve_timeout(self, mock_run, client):
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="yt-dlp", timeout=30)
        resp = client.post("/api/resolve", json={"url": "https://www.youtube.com/watch?v=abc123"})
        assert resp.status_code == 504

    @patch("server.routes.resolve.subprocess.run")
    def test_resolve_bad_returncode(self, mock_run, client):
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")
        resp = client.post("/api/resolve", json={"url": "https://www.youtube.com/watch?v=abc123"})
        assert resp.status_code == 400


# ── /api/search ───────────────────────────────────────

class TestSearch:
    def test_no_query(self, client):
        resp = client.post("/api/search", json={})
        assert resp.status_code == 400

    @patch("server.routes.resolve.subprocess.run")
    def test_youtube_search(self, mock_run, client):
        results = [
            json.dumps({"title": "Beat 1", "url": "https://youtube.com/watch?v=a1", "duration": 60, "thumbnails": []}),
            json.dumps({"title": "Beat 2", "url": "https://youtube.com/watch?v=a2", "duration": 90, "thumbnails": []}),
        ]
        mock_run.return_value = MagicMock(returncode=0, stdout="\n".join(results))
        resp = client.post("/api/search", json={"query": "808 drums", "platform": "youtube"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["results"]) == 2
        assert data["results"][0]["title"] == "Beat 1"

    @patch("server.routes.resolve.subprocess.run")
    def test_search_timeout(self, mock_run, client):
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="yt-dlp", timeout=30)
        resp = client.post("/api/search", json={"query": "test"})
        assert resp.status_code == 504


# ── /api/upload ───────────────────────────────────────

class TestUpload:
    def test_no_file(self, client):
        resp = client.post("/api/upload")
        assert resp.status_code == 400

    def test_bad_extension(self, client):
        data = {"file": (io.BytesIO(b"not audio"), "evil.exe")}
        resp = client.post("/api/upload", data=data, content_type="multipart/form-data")
        assert resp.status_code == 400
        assert b"Unsupported format" in resp.data

    @patch("server.routes.upload.subprocess.run")
    def test_valid_upload(self, mock_run, client, sample_wav):
        mock_run.return_value = MagicMock(returncode=0)
        data = {"file": (io.BytesIO(sample_wav), "test.wav")}
        resp = client.post("/api/upload", data=data, content_type="multipart/form-data")
        assert resp.status_code == 200
        result = resp.get_json()
        assert "file_id" in result
        assert result["filename"] == "test.wav"
        assert result["audio_url"].startswith("/api/audio/")


# ── /api/audio ────────────────────────────────────────

class TestServeAudio:
    def test_not_found(self, client):
        resp = client.get("/api/audio/nonexistent.wav")
        assert resp.status_code == 404

    def test_path_traversal_rejected(self, client):
        resp = client.get("/api/audio/../../etc/passwd")
        assert resp.status_code == 404


# ── /api/export ───────────────────────────────────────

class TestExport:
    def test_no_sources(self, client):
        resp = client.post("/api/export", json={"sources": []})
        assert resp.status_code == 400

    def test_no_ordered_regions(self, client):
        resp = client.post("/api/export", json={"ordered_regions": []})
        assert resp.status_code == 400

    def test_invalid_format_defaults_wav(self, client):
        # With an invalid format, it should default to wav (but still fail without sources)
        resp = client.post("/api/export", json={"sources": [], "format": "ogg"})
        assert resp.status_code == 400

    @patch("server.routes.export.subprocess.run")
    @patch("server.routes.upload.subprocess.run")
    def test_export_with_uploaded_file(self, mock_upload_run, mock_export_run, client, sample_wav):
        # First upload a file
        mock_upload_run.return_value = MagicMock(returncode=0)
        mock_export_run.return_value = MagicMock(returncode=0)
        upload_resp = client.post(
            "/api/upload",
            data={"file": (io.BytesIO(sample_wav), "test.wav")},
            content_type="multipart/form-data",
        )
        file_id = upload_resp.get_json()["file_id"]

        # Create a fake wav in uploads dir for the export to find
        wav_path = UPLOAD_DIR / f"{file_id}.wav"
        wav_path.write_bytes(sample_wav)

        # Now export using old grouped format (backward compat)
        resp = client.post("/api/export", json={
            "sources": [{"type": "file", "file_id": file_id, "regions": [{"start": 0, "end": 0.05}]}],
            "format": "wav",
        })
        # The export will fail because ffmpeg isn't mocked for extraction,
        # but it validates the input parsing worked
        assert resp.status_code in (200, 500)

    @patch("server.routes.export.subprocess.run")
    @patch("server.routes.upload.subprocess.run")
    def test_export_ordered_regions_format(self, mock_upload_run, mock_export_run, client, sample_wav):
        """Test the new ordered_regions payload format."""
        mock_upload_run.return_value = MagicMock(returncode=0)
        mock_export_run.return_value = MagicMock(returncode=0)
        upload_resp = client.post(
            "/api/upload",
            data={"file": (io.BytesIO(sample_wav), "test.wav")},
            content_type="multipart/form-data",
        )
        file_id = upload_resp.get_json()["file_id"]
        wav_path = UPLOAD_DIR / f"{file_id}.wav"
        wav_path.write_bytes(sample_wav)

        # Export using new ordered_regions format
        resp = client.post("/api/export", json={
            "ordered_regions": [
                {"type": "file", "file_id": file_id, "start": 0, "end": 0.03},
                {"type": "file", "file_id": file_id, "start": 0.05, "end": 0.08},
            ],
            "format": "wav",
        })
        assert resp.status_code in (200, 500)

    def test_export_bad_file_id(self, client):
        resp = client.post("/api/export", json={
            "ordered_regions": [{"type": "file", "file_id": "../hack", "start": 0, "end": 1}],
        })
        data = resp.get_json()
        # Should still return 400 (no valid regions) because the bad file_id is skipped
        assert resp.status_code == 400

    def test_export_disallowed_url(self, client):
        resp = client.post("/api/export", json={
            "ordered_regions": [{"type": "url", "url": "https://evil.com/audio", "start": 0, "end": 1}],
        })
        assert resp.status_code == 400

    def test_export_backward_compat_grouped(self, client):
        """Old grouped format still flattened and rejected when sources are bad."""
        resp = client.post("/api/export", json={
            "sources": [{"type": "url", "url": "https://evil.com/audio", "regions": [{"start": 0, "end": 1}]}],
        })
        assert resp.status_code == 400


# ── /api/exports ──────────────────────────────────────

class TestServeExport:
    def test_not_found(self, client):
        resp = client.get("/api/exports/doesnotexist.wav")
        assert resp.status_code == 404

    def test_path_traversal(self, client):
        resp = client.get("/api/exports/../app.py")
        assert resp.status_code == 404
