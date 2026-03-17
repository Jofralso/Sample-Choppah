/* Player setup (HTML5 Audio for all sources) and playback controls */

import { state, players } from './state.js';
import { $, $hiddenPlayers } from './dom.js';
import { fmt } from './helpers.js';

export function initPlayer(src) {
  const p = players[src.id];
  let audio;

  if (src.type === 'url') {
    audio = new Audio(`/api/stream?url=${encodeURIComponent(src.url)}`);
  } else if (src.type === 'file') {
    audio = new Audio(src.audio_url);
  }

  if (!audio) return;
  p.audio = audio;

  const durEl = $(`dur-${src.id}`);
  if (durEl && src.type === 'url') durEl.textContent = 'LOADING...';

  audio.addEventListener('loadedmetadata', () => {
    p.duration = audio.duration; src.duration = audio.duration; updateDurLabel(src);
  });
  audio.addEventListener('error', () => {
    const el = $(`dur-${src.id}`);
    if (el) { el.textContent = 'LOAD FAILED'; el.style.color = '#ff3333'; }
    const btn = document.querySelector(`[data-action="play"][data-id="${src.id}"]`);
    if (btn) { btn.textContent = '⚠ NO PREVIEW'; btn.disabled = true; }
  });
  audio.addEventListener('play', () => {
    const btn = document.querySelector(`[data-action="play"][data-id="${src.id}"]`);
    if (btn) btn.textContent = '⏸ PAUSE';
  });
  audio.addEventListener('pause', () => {
    const btn = document.querySelector(`[data-action="play"][data-id="${src.id}"]`);
    if (btn) btn.textContent = '▶ PLAY';
  });
}

export function updateDurLabel(src) {
  const el = $(`dur-${src.id}`);
  if (el) el.textContent = fmt(src.duration);
}

export function togglePlay(srcId) {
  const p = players[srcId];
  if (!p || !p.audio) return;
  if (p.audio.paused) p.audio.play();
  else p.audio.pause();
}

export function stopSource(srcId) {
  const p = players[srcId];
  if (!p || !p.audio) return;
  p.audio.pause(); p.audio.currentTime = 0;
  const btn = document.querySelector(`[data-action="play"][data-id="${srcId}"]`);
  if (btn) btn.textContent = '▶ PLAY';
}

export function seekSource(srcId, t) {
  const p = players[srcId];
  if (!p || !p.audio) return;
  p.audio.currentTime = t;
}

export function getCurrentTime(srcId) {
  const p = players[srcId];
  if (!p || !p.audio) return 0;
  return p.audio.currentTime;
}

export function previewRegion(srcId, region) {
  seekSource(srcId, region.start);
  const p = players[srcId];
  if (!p || !p.audio) return;
  p.audio.play();
  const check = setInterval(() => {
    if (p.audio.currentTime >= region.end - 0.05) {
      clearInterval(check);
      p.audio.pause();
    }
  }, 80);
  setTimeout(() => clearInterval(check), (region.end - region.start + 2) * 1000);
}

export function pollPlayheads() {
  for (const src of state.sources) {
    const p = players[src.id];
    if (!p || !p.audio) continue;
    const t = p.audio.currentTime;
    p.currentTime = t;
    const dur = p.duration || src.duration || 1;
    const pct = (t / dur * 100);
    const pos = $(`pos-${src.id}`);
    const needle = $(`needle-${src.id}`);
    const timeEl = $(`time-${src.id}`);
    if (pos) pos.style.width = pct + '%';
    if (needle) needle.style.left = pct + '%';
    if (timeEl) timeEl.textContent = fmt(t);
  }
}
