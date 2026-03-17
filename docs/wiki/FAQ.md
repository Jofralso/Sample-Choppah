# ❓ FAQ

> Answers to the questions that come up when you're in the middle of a session.

---

## General

### What is Get Da Choppah?

A browser-based sample chopper for scratch DJs. It lets you pull audio from YouTube, SoundCloud, or local files, visually chop regions, arrange them in order, and export a single scratch track file. No DAW required.

### Is this a DAW?

Nah. This is a chopper. It does one thing — helps you slice samples and build scratch tracks. If you need EQ, effects, multitrack mixing, or beat grids, use a DAW. If you need to turn a YouTube video into 8 chopped samples ordered for a scratch sentence, this is your tool.

### Is it free?

Yes. MIT license. Use it, fork it, modify it, sell beats made with it — do whatever you want.

### Does it work offline?

Partially. If you're using **local files**, everything works offline once the server is running. If you're pulling from **YouTube or SoundCloud**, you need internet access for the initial resolve and audio stream download. Once a source has been streamed, the audio is cached locally and will play back without internet.

---

## Sources & Audio

### What sources are supported?

- **YouTube** — any public video URL
- **SoundCloud** — any public track URL
- **Local files** — WAV, MP3, FLAC, OGG, M4A, AAC, AIFF, AIF, WMA, OPUS, WEBM

### Can I use Spotify / Apple Music / Tidal links?

No. Those platforms use DRM-protected streams that can't be extracted. Stick to YouTube, SoundCloud, or your own files.

### Does it download the audio when I paste a link?

When you paste a YouTube or SoundCloud link, the choppah resolves the metadata (title, duration, thumbnail) and then streams the audio through the server for in-browser playback. The audio is downloaded via yt-dlp on the backend and cached locally — so subsequent plays of the same source are instant. At export time, the cached audio is used for slicing.

### Some YouTube videos don't preview / play — why?

A few reasons this can happen:

- **Stream download failed** — Sometimes yt-dlp can't extract the audio (geo-restricted, age-restricted, or the video was taken down). You'll see "LOAD FAILED" or "⚠ NO PREVIEW" in the player area.
- **Video removed / private** — If the video was taken down, neither resolve nor preview will work.
- **yt-dlp outdated** — YouTube occasionally changes their internals. Run `pip install --upgrade yt-dlp` to get the latest version.

> **Tip:** Even if preview doesn't work, you can still chop by checking the video's timeline on YouTube, entering start/end times manually via the precision overlay, and exporting.

### What audio quality do I get?

- **YouTube**: Best available audio stream (usually 128-256 kbps AAC/Opus)
- **SoundCloud**: Stream quality as provided by SoundCloud
- **Local files**: Whatever quality you upload

For the final export, you choose the format (WAV/MP3/FLAC). WAV and FLAC are lossless. MP3 is lossy but smaller.

### The audio sounds different from the original

YouTube and SoundCloud compress audio. If you need lossless quality, use local files (upload the original WAV/FLAC). For scratch practice tracks, YouTube quality is usually fine.

---

## Chopping

### How precise can I get with my cuts?

Very. The stream bar gives you rough placement. The **precision overlay** (click any region) lets you drag handles pixel-by-pixel or type exact timestamps in seconds. You can get down to millisecond accuracy.

### Why can't I overlap regions?

By design. Overlapping regions would mean the same audio appears in multiple chops, which creates phase issues and confusing exports. Clean, non-overlapping cuts are the standard for scratch tracks.

### I made a mistake — how do I undo?

`Ctrl+Z` (Windows/Linux) or `⌘+Z` (Mac). Every operation is tracked. Redo with `Ctrl+Y` / `⌘+Y`.

### Can I chop from multiple sources into one export?

Yes. Add multiple sources (URLs or files). Chop regions from each. All ready regions go into the same export queue regardless of source. Drag to reorder.

### What are the gaps in the export?

By default, each chop is separated by 1 second of silence. You can adjust this from 0 to 10 seconds using the **gap duration** input next to the format selector. Set it to 0 for back-to-back chops with no silence, or increase it if you want more breathing room between cue points.

---

## Export

### What formats can I export?

| Format | Type | Best For |
|--------|------|----------|
| **WAV** | Lossless | Serato, vinyl cutting, maximum quality |
| **MP3** | Lossy | Sharing, quick practice, small file size |
| **FLAC** | Lossless compressed | Same quality as WAV, smaller file |

### How do I get the export into Serato?

Export as WAV. Drop the file into your Serato crate or the folder Serato scans. It'll show up as a regular track. Set your cue points on each chop.

### Can I export individual chops as separate files?

Not currently. The choppah exports one file with all chops in sequence. If you need individual files, export and then split in any audio editor — the gaps between chops make it easy to find the cut points.

### Export is slow — what's happening?

The export process:
1. Downloads the source audio from YouTube/SoundCloud (if URL-based)
2. Decodes and slices each region
3. Concatenates everything with gaps
4. Encodes to your chosen format

Step 1 takes the most time (depends on your internet). For local files, it's much faster since there's no download.

---

## Technical

### What port does it run on?

`5555` by default. Hit `http://localhost:5555` in your browser.

### Can I change the port?

Edit `app.py` and change the `port=5555` argument. Or set the `PORT` environment variable if you add that to the config.

### Does it run on my phone?

The server needs to run on a computer. But if you access `http://YOUR_IP:5555` from your phone's browser on the same network, the UI loads. It's not optimized for touch yet though.

### I get a "ffmpeg not found" error

Install ffmpeg:
```bash
brew install ffmpeg       # macOS
sudo apt install ffmpeg   # Ubuntu
winget install ffmpeg     # Windows
```

Make sure it's on your `PATH`:
```bash
ffmpeg -version
```

### I get a "yt-dlp" error

yt-dlp is installed as a Python dependency. If it's not working:
```bash
pip install --upgrade yt-dlp
```

YouTube occasionally changes their API, which breaks yt-dlp. Keeping it updated usually fixes things.

### Can I contribute?

Absolutely. See [CONTRIBUTING.md](../../blob/main/CONTRIBUTING.md). Fork, branch, test, PR.

---

## The Culture

### Why "Get Da Choppah"?

You know why. 🔪

### Who's this for?

Scratch DJs, battle DJs, turntablists, sample diggers, anyone who needs to build scratch tracks fast without the overhead of a full DAW.

### Why not just use [Audacity / Ableton / FL Studio / etc.]?

You can! Those are great tools. But if all you need is to chop 6 samples from a YouTube video and export them as a scratch track, firing up a full DAW is like driving a tour bus to the corner store. The choppah is the corner store.

---

<p align="center"><em>Still got questions? Open an issue. The cypher is open. 🔪💿</em></p>
