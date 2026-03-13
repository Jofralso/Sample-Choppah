"""Static file and index routes."""

from flask import Blueprint, send_from_directory

from server.config import STATIC_DIR

static_bp = Blueprint("static_routes", __name__)


@static_bp.route("/")
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")


@static_bp.route("/static/<path:path>")
def static_files(path):
    return send_from_directory(str(STATIC_DIR), path)
