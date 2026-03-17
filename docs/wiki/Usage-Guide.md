# 🎚️ Usage Guide

> Everything the choppah can do, explained like you're sitting next to the turntables.

---

## Table of Contents

- [Adding Sources](#adding-sources)
- [The Stream Bar](#the-stream-bar)
- [Chopping Regions](#chopping-regions)
- [Precision Overlay](#precision-overlay)
- [Region Management](#region-management)
- [The Export Queue](#the-export-queue)
- [Timeline Strip](#timeline-strip)
- [Exporting Your Scratch Track](#exporting-your-scratch-track)
- [Undo & Redo](#undo--redo)
- [Multiple Sources](#multiple-sources)
- [Tips & Tricks](#tips--tricks)

---

## Adding Sources

There are three ways to feed the choppah:

### 🔗 Paste a URL

Type or paste a **YouTube** or **SoundCloud** URL into the address bar and hit **GO** (or press Enter).

The choppah resolves the URL, pulls the metadata (title, thumbnail, duration), and streams the audio for in-browser playback. The server downloads the audio via yt-dlp and caches it locally so subsequent plays are instant.

**Supported URLs:**
- YouTube videos: `https://youtube.com/watch?v=...` or `https://youtu.be/...`
- SoundCloud tracks: `https://soundcloud.com/artist/track`

### 🔍 Search

Click inside the URL bar and type a search query. Hit **Search** (or Enter). The choppah searches YouTube and shows matching results as source cards. Click one to load it.

Great for when you know what you want but don't have the link — "amen break", "fresh ahh yeah", "wicka wicka scratch sample", whatever.

### 📁 Upload a File

Click the **Upload** button (📁) and pick a file from your local crate. Supported formats:

`WAV` · `MP3` · `FLAC` · `OGG` · `M4A` · `AAC` · `AIFF` · `AIF` · `WMA` · `OPUS` · `WEBM`

The file gets uploaded to the server and plays through HTML5 Audio.

---

## The Stream Bar

Once a source is loaded, the **stream bar** appears below the player. This is your chopping block.

The stream bar is a horizontal strip that represents the full duration of the source. As the track plays, a **playhead** (thin vertical line) moves across it so you can see where you are.

The stream bar is where you:
- **Drag to create regions** (chops)
- **See existing regions** as colored blocks
- **Click regions** to select them
- **Drag region edges** to resize them
- **Drag region bodies** to move them

---

## Chopping Regions

### Creating a Region

1. Click and hold anywhere on the stream bar (where there's no existing region)
2. Drag left or right
3. Release

A new region appears as a colored block. Each region automatically gets a unique color from a cycling palette so you can tell them apart at a glance.

### Selecting a Region

Click on a region in the stream bar. It highlights and its info shows in the sidebar.

### Moving a Region

Click and drag a region's body (not the edges) to slide it left or right along the stream bar. It won't overlap with other regions — the choppah enforces clean boundaries.

### Resizing a Region

Hover over the left or right edge of a region. The cursor changes. Click and drag to extend or shrink the region. Again, overlap is prevented.

### Deleting a Region

Click the **✕** button on the region's chip (the labeled block below the stream bar or in the sidebar).

---

## Precision Overlay

For surgical cuts, click any region to open the **precision overlay**. This is a zoomed-in view that shows just that region and its surroundings.

### What You Can Do

- **Drag the left handle** to adjust the start point pixel-by-pixel
- **Drag the right handle** to adjust the end point
- **Type exact timestamps** in the input fields (format: seconds with decimals)
- **Play preview** to hear just that region
- **Close** when you're satisfied

The precision overlay is where you go from "roughly that break" to "exactly the first hit of that break." Essential for tight scratch sentences.

---

## Region Management

### Region Colors

Every region gets its own color from a rotating palette. You don't pick them — they're assigned automatically to keep things visually distinct. The colors cycle through: yellow, cyan, magenta, lime, orange, violet, teal, rose, and more.

### Ready State

Each region has a **ready toggle** (✓). A region must be marked ready to be included in the export.

This lets you have multiple regions in progress — experimenting, comparing — but only export the ones you've committed to.

- **✓ (checked)** = this chop is going in the export
- **○ (unchecked)** = this chop stays behind

### Overlap Prevention

Regions can't overlap. If you try to drag or resize a region into another region's space, it stops at the boundary. This guarantees clean, non-overlapping chops — no doubled audio, no phase issues.

---

## The Export Queue

The **Export Queue** panel shows all your ready regions in the order they'll be concatenated.

### Reordering

Drag any chip in the queue to move it up or down. The order in the queue = the order in the final file.

This is where you build your scratch sentence:

> "Ahh" → "Fresh" → "Wicka wicka" → "Yeah boy"

Just drag the chips into that order.

### Removing from Queue

Un-check a region's ✓ to remove it from the export queue. The region still exists on the stream bar — it just won't be exported.

---

## Timeline Strip

Below the export queue, the **timeline strip** gives you a visual preview of the final scratch track. Each chop appears as a colored block in sequence, proportional to its duration.

This lets you see at a glance:
- The relative length of each chop
- The overall flow and balance
- Whether any chop is disproportionately long or short

---

## Exporting Your Scratch Track

### 1. Check Your Queue

Make sure all the regions you want are marked ready (✓) and in the right order.

### 2. Pick a Format

Click the **EXPORT** button. Choose:

| Format | Best For |
|--------|----------|
| **WAV** | Lossless, maximum quality. Best for Serato, vinyl cutting, or further processing. |
| **MP3** | Smaller file, universal compatibility. Good for sharing or quick practice. |
| **FLAC** | Lossless but compressed. Smaller than WAV, same quality. |

### 3. Export

Hit the button. The choppah:

1. Downloads the necessary audio from the source (if it's a URL)
2. Extracts each region's audio slice
3. Concatenates all slices in queue order with silence gaps between each (adjustable, 0–10s)
4. Packages it as your chosen format
5. Shows you a **preview player** so you can listen before downloading
6. Click **Download** to save the file

### Gap Duration

Before exporting, you can set the **gap duration** between chops using the input next to the format selector. The default is 1 second. Set it to 0 for back-to-back chops with no silence, or up to 10 seconds for more spacing.

### Export Preview

After the export finishes processing, an audio preview player appears. Listen to the result before downloading. If something's off, close the preview, adjust your queue, and re-export.

### What You Get

A single audio file with your chops played back-to-back, separated by your chosen gap duration. Load it into Serato, rekordbox, Traktor, burn it to a dubplate on vinyl, throw it on your SP-404 — it's ready to rock.

---

## Undo & Redo

| Action | Shortcut |
|--------|----------|
| Undo | `Ctrl+Z` (Windows/Linux) / `⌘+Z` (Mac) |
| Redo | `Ctrl+Y` (Windows/Linux) / `⌘+Y` (Mac) |

Every region operation (create, move, resize, delete, reorder, ready toggle) is tracked. Undo walks you back. Redo walks you forward. Chop fearlessly.

---

## Multiple Sources

You can add multiple sources. Each one appears as a **source card** in the left panel. Click a card to switch to that source's stream bar and regions.

This means you can dig from multiple records in one session:

1. Load a YouTube break
2. Chop the drum pattern
3. Load a SoundCloud acapella
4. Chop the vocal stab
5. Add them all to the same export queue
6. Export one scratch track with chops from both sources

Mix and match. That's the beauty.

---

## Tips & Tricks

### Building a Scratch Sentence

The classic workflow:
1. Find a vocal source with distinct words/phrases
2. Chop each word as its own region
3. Order them in the queue to form your sentence
4. Export and practice your cuts

### Layering Breaks and Vocals

Use multiple sources — load a break from YouTube and a vocal from SoundCloud. Chop the break pattern and the vocal stabs. Interleave them in the queue.

### Quick Audition

Use the player controls to play through the source. When you hear something you want, note the rough position on the stream bar, pause, and drag a region there. Then precision-overlay to dial it in.

### Keyboard Workflow

- Use `Ctrl+Z` liberally — every chop is reversible
- Mark regions ready as you finalize them
- Keep the export queue organized as you go

---

<p align="center"><em>The record don't stop. Neither should you. 🔪💿</em></p>
