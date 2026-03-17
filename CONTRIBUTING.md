# Contributing to Get Da Choppah

Thanks for wanting to help improve the choppah!

## Getting Started

1. Fork the repo and clone your fork
2. Install Python 3.10+ and [ffmpeg](https://ffmpeg.org/download.html)
3. Create a virtual environment and install deps:
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
4. Run the app:
   ```bash
   python app.py
   ```
5. Open `http://localhost:5555` in your browser

## Running Tests

```bash
# Backend
python -m pytest tests/test_app.py -v -p no:flaky

# Frontend (pure-logic)
node tests/test_frontend.js
```

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Add tests for new features
- Make sure existing tests pass before submitting
- Follow the existing code style

## Reporting Issues

- Use the GitHub issue templates
- Include steps to reproduce, expected vs actual behavior
- Mention your OS, Python version, and browser

## Code Style

- **Python**: PEP 8, type hints where helpful
- **JavaScript**: ES modules, no build step required
- **CSS**: CSS custom properties, modular partials under `static/css/`
