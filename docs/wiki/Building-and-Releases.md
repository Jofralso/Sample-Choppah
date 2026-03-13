# 📦 Building & Releases

> How to build standalone binaries and how the release pipeline works.

---

## Release Strategy

Get Da Choppah uses **Git tags** to trigger releases. Push a tag, and GitHub Actions builds standalone executables for Linux, macOS, and Windows automatically.

```
v1.0.0  →  GitHub Actions  →  Linux binary
                            →  macOS binary
                            →  Windows .exe
                            →  GitHub Release with all three
```

No Python required on the user's machine. Download, unzip, run. Simple as dropping the needle.

---

## Building Locally

### Prerequisites

```bash
pip install pyinstaller
```

### Build

```bash
make build
```

Or manually:

```bash
pyinstaller \
  --name get-da-choppah \
  --onefile \
  --add-data "static:static" \
  --add-data "server:server" \
  app.py
```

The binary lands in `dist/get-da-choppah` (or `dist/get-da-choppah.exe` on Windows).

### Run the Binary

```bash
./dist/get-da-choppah
# → http://localhost:5555
```

That's a fully self-contained app. Static files, templates, server code — all packed in.

> **Note**: You still need **ffmpeg** installed on the system. PyInstaller bundles the Python code and dependencies, but ffmpeg is a separate system binary.

---

## GitHub Actions: CI Pipeline

**File**: `.github/workflows/ci.yml`

Runs on every push and pull request:

| Axis | Values |
|------|--------|
| **OS** | Ubuntu, macOS, Windows |
| **Python** | 3.10, 3.11, 3.12, 3.13 |
| **Node** | 20 (for frontend tests) |

### What It Tests

1. **Backend**: `python -m pytest tests/test_app.py -v -p no:flaky`
2. **Frontend**: `node tests/test_frontend.js`

If any combination fails, the PR is blocked.

---

## GitHub Actions: Release Pipeline

**File**: `.github/workflows/release.yml`

Triggered when you push a version tag (`v*`):

```bash
git tag v1.2.0
git push origin v1.2.0
```

### What It Does

1. **Builds on three runners** (Ubuntu, macOS, Windows) in parallel
2. Each runner:
   - Checks out the code
   - Installs Python + dependencies
   - Runs PyInstaller to create a standalone binary
   - Uploads the binary as a build artifact
3. **Creates a GitHub Release** with all three binaries attached

### Artifacts

| Platform | Artifact Name |
|----------|--------------|
| Linux | `get-da-choppah-linux` |
| macOS | `get-da-choppah-macos` |
| Windows | `get-da-choppah-windows.exe` |

Users download the one for their OS from the [Releases](../../releases) page.

---

## Version Management

The canonical version lives in `server/__init__.py`:

```python
__version__ = "1.0.0"
```

When cutting a new release:

1. Bump `__version__` in `server/__init__.py`
2. Update `CHANGELOG.md` with the new version's changes
3. Commit: `git commit -am "release: v1.1.0"`
4. Tag: `git tag v1.1.0`
5. Push: `git push origin main --tags`
6. GitHub Actions builds and publishes the release automatically

---

## Makefile Targets

```bash
make run             # Start the dev server
make install         # Install deps into venv
make dev-install     # Install with dev + build extras
make test            # Run all tests (backend + frontend)
make test-backend    # Backend tests only
make test-frontend   # Frontend tests only
make build           # PyInstaller build
make clean           # Remove build artifacts, caches, temp dirs
```

---

## pyproject.toml

The project uses PEP 621 metadata in `pyproject.toml`:

- **Build system**: setuptools
- **Entry point**: `get-da-choppah = "app:main"`
- **Optional deps**:
  - `dev` — pytest, flake8, etc.
  - `build` — PyInstaller

```bash
# Install with dev extras
pip install -e ".[dev]"

# Install with build extras
pip install -e ".[build]"
```

---

## Troubleshooting Builds

### "ffmpeg not found" at runtime

PyInstaller doesn't bundle ffmpeg. Install it separately:
```bash
brew install ffmpeg       # macOS
sudo apt install ffmpeg   # Ubuntu
winget install ffmpeg     # Windows
```

### Binary won't start on macOS

macOS may quarantine downloaded binaries. Remove the quarantine flag:
```bash
xattr -d com.apple.quarantine ./get-da-choppah-macos
```

### Antivirus flags on Windows

Some antivirus software flags PyInstaller binaries as suspicious. This is a known false positive. You can whitelist the executable or build from source.

---

<p align="center"><em>Ship it. 🔪💿</em></p>
