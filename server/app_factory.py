"""Flask application factory."""

from flask import Flask
from flask_cors import CORS

from server.config import STATIC_DIR, MAX_CONTENT_LENGTH


def create_app() -> Flask:
    """Build and configure the Flask application."""
    app = Flask(__name__, static_folder=str(STATIC_DIR))
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
    CORS(app)

    # Register blueprints
    from server.routes.static import static_bp
    from server.routes.resolve import resolve_bp
    from server.routes.upload import upload_bp
    from server.routes.export import export_bp
    from server.routes.stream import stream_bp

    app.register_blueprint(static_bp)
    app.register_blueprint(resolve_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(stream_bp)

    return app
