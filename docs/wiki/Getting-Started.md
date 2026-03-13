# 🚀 Getting Started

> From zero to your first chop in 5 minutes flat.

---

## What You Need

| Tool | Why | How to Get It |
|------|-----|---------------|
| **Python 3.10+** | Runs the backend | [python.org](https://www.python.org/downloads/) |
| **ffmpeg** | Audio extraction & conversion | See below |
| **A browser** | That's the whole UI | You've got one |

### Installing ffmpeg

ffmpeg does the heavy lifting — converting audio, extracting tracks from video, building your final export.

```bash
# macOS (Homebrew)
brew install ffmpeg

# Ubuntu / Debian
sudo apt update && sudo apt install ffmpeg

# Windows (winget)
winget install ffmpeg

# Windows (manual)
# Download from https://ffmpeg.org/download.html
# Add the bin/ folder to your PATH
```

Verify it's installed:
```bash
ffmpeg -version
```

---

## Installation

### Option A: Setup Script (Recommended)

```bash
git clone https://github.com/YOUR_USERNAME/get-da-choppah.git
cd get-da-choppah

# Linux / macOS
bash scripts/setup.sh

# Windows
scripts\setup.bat
```

The script creates a virtual environment, installs dependencies, and tells you how to run it.

### Option B: Manual Setup

```bash
git clone https://github.com/YOUR_USERNAME/get-da-choppah.git
cd get-da-choppah

# Create virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Run
python app.py
```

### Option C: Standalone Binary

Grab a pre-built binary from the [Releases](../../releases) page — no Python required. Just download, unzip, and run.

---

## First Run

```bash
python app.py
```

You'll see:
```
 * Running on http://127.0.0.1:5555
```

Open **http://localhost:5555** in your browser. You're in.

---

## Your First Chop — The 60-Second Walkthrough

### 1. Add a Source

Paste a YouTube or SoundCloud URL into the address bar at the top and hit **GO**.

Or click **Search** and type what you're looking for — "break beat battle", "ahh fresh", whatever you're diggin' for.

Or click **Upload** to load a file from your local crate.

### 2. Chop a Region

Once the source loads, you'll see the **stream bar** — that horizontal strip below the player. Click and drag across it to select a region.

The region shows up as a colored block. Each chop gets its own color automatically.

### 3. Fine-Tune (Optional)

Click on any region to open the **precision overlay**. This zooms in and lets you:
- Drag the left/right handles pixel-by-pixel
- Type exact start/end timestamps
- See exactly where your cut points land

### 4. Mark It Ready

Hit the **✓** button on a region to mark it ready for export. Only ready regions go into the final file.

### 5. Set the Order

In the **Export Queue** panel, drag your chops into the sequence you want. The **timeline strip** at the bottom previews the order visually.

### 6. Export

Choose your format (WAV, MP3, or FLAC), then smash **EXPORT**.

The choppah downloads the necessary audio, slices your regions, concatenates them with 1-second gaps, and hands you a single file.

**Done.** Load it into Serato, rekordbox, burn it to a dubplate, throw it on your SP-404 — whatever your workflow is.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` / `⌘+Z` | Undo |
| `Ctrl+Y` / `⌘+Y` | Redo |

---

## Next Steps

- **[Usage Guide](Usage-Guide)** — deep dive into every feature
- **[FAQ](FAQ)** — common questions
- **[Architecture](Architecture)** — how it's built (for contributors)

---

<p align="center"><em>Now go dig. 🔪💿</em></p>
