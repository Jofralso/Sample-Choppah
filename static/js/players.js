/* Player setup (hidden YT embeds, HTML5 Audio) and playback controls */

import { state, players, isYtReady } from './state.js';
import { $, $hiddenPlayers } from './dom.js';
import { fmt, extractYTId } from './helpers.js';

export function initPlayer(src) {
  const p = players[src.id];

  if (src.type === 'url' && src.platform === 'YT') {
    const el = document.createElement('div');
    el.id = `yt-${src.id}`;
    $hiddenPlayers.appendChild(el);

    function create() {
      p.ytPlayer = new YT.Player(`yt-${src.id}`, {
        height: '1', width: '1',
        videoId: extractYTId(src.url),
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: e => {
            const dur = e.target.getDuration();
            if (dur) { p.duration = dur; src.duration = dur; updateDurLabel(src); }
          },
          onStateChange: e => {
            const btn = document.querySelector(`[data-action="play"][data-id="${src.id}"]`);
            if (btn) btn.textContent = (e.data === 1) ? '⏸ PAUSE' : '▶ PLAY';
          }
        }
      });
    }
    if (isYtReady()) create();
    else { const iv = setInterval(() => { if (isYtReady()) { clearInterval(iv); create(); } }, 200); }

  } else if (src.type === 'file') {
    const audio = new Audio(src.audio_url);
    p.audio = audio;
    audio.addEventListener('loadedmetadata', () => {
      p.duration = audio.duration; src.duration = audio.duration; updateDurLabel(src);
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
}

export function updateDurLabel(src) {
  const el = $(`dur-${src.id}`);
  if (el) el.textContent = fmt(src.duration);
}

export function togglePlay(srcId) {
  const p = players[srcId];
  if (!p) return;
  if (p.ytPlayer) {
    const st = p.ytPlayer.getPlayerState?.();
    if (st === 1) p.ytPlayer.pauseVideo();
    else p.ytPlayer.playVideo();
  } else if (p.audio) {
    if (p.audio.paused) p.audio.play();
    else p.audio.pause();
  }
}

export function stopSource(srcId) {
  const p = players[srcId];
  if (!p) return;
  if (p.ytPlayer) { p.ytPlayer.pauseVideo(); p.ytPlayer.seekTo(0); }
  else if (p.audio) { p.audio.pause(); p.audio.currentTime = 0; }
  const btn = document.querySelector(`[data-action="play"][data-id="${srcId}"]`);
  if (btn) btn.textContent = '▶ PLAY';
}

export function seekSource(srcId, t) {
  const p = players[srcId];
  if (!p) return;
  if (p.ytPlayer) p.ytPlayer.seekTo(t, true);
  else if (p.audio) p.audio.currentTime = t;
}

export function getCurrentTime(srcId) {
  const p = players[srcId];
  if (!p) return 0;
  if (p.ytPlayer && p.ytPlayer.getCurrentTime) return p.ytPlayer.getCurrentTime();
  if (p.audio) return p.audio.currentTime;
  return 0;
}

export function previewRegion(srcId, region) {
  seekSource(srcId, region.start);
  const p = players[srcId];
  if (p.ytPlayer) p.ytPlayer.playVideo();
  else if (p.audio) p.audio.play();
  const check = setInterval(() => {
    const t = getCurrentTime(srcId);
    if (t >= region.end - 0.05) {
      clearInterval(check);
      if (p.ytPlayer) p.ytPlayer.pauseVideo();
      else if (p.audio) p.audio.pause();
    }
  }, 80);
  setTimeout(() => clearInterval(check), (region.end - region.start + 2) * 1000);
}

export function pollPlayheads() {
  for (const src of state.sources) {
    const p = players[src.id];
    if (!p) continue;
    let t = 0;
    if (p.ytPlayer && p.ytPlayer.getCurrentTime) t = p.ytPlayer.getCurrentTime();
    else if (p.scWidget) {
      p.scWidget.getPosition?.(ms => { p._scTime = ms / 1000; });
      t = p._scTime || 0;
    }
    else if (p.audio) t = p.audio.currentTime;
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
