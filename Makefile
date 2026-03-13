.PHONY: run test test-backend test-frontend install dev-install build clean

# ─── Run ──────────────────────────────────────────
run:
	python app.py

# ─── Install ──────────────────────────────────────
install:
	pip install -r requirements.txt

dev-install:
	pip install -e ".[dev]"

# ─── Test ─────────────────────────────────────────
test: test-backend test-frontend

test-backend:
	python -m pytest tests/test_app.py -v -p no:flaky

test-frontend:
	node tests/test_frontend.js

# ─── Build standalone executables ─────────────────
build:
	pyinstaller --onefile --name sample-choppah \
		--add-data "static:static" \
		--hidden-import server \
		--hidden-import server.config \
		--hidden-import server.app_factory \
		--hidden-import server.routes \
		--hidden-import server.routes.static \
		--hidden-import server.routes.resolve \
		--hidden-import server.routes.upload \
		--hidden-import server.routes.export \
		app.py

# ─── Clean ────────────────────────────────────────
clean:
	rm -rf build/ dist/ *.spec __pycache__ server/__pycache__ server/routes/__pycache__
	rm -rf .pytest_cache htmlcov .coverage
	find . -name '*.pyc' -delete
