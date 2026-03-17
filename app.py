"""Get Da Choppah — entry point."""

from server.app_factory import create_app

app = create_app()

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5555))
    app.run(debug=True, port=port)
