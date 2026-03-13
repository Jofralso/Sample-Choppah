/* Source creation, card rendering, adding URLs, search, file upload */

import { state, players, saveSnapshot } from './state.js';
import { $, $sourceList, $emptyHint, $url, $btnGo, $searchDrop, $file } from './dom.js';
import { uid, nextColor, esc, fmt } from './helpers.js';
import { initPlayer, togglePlay, stopSource } from './players.js';
import { renderBarRegions, renderChips, renderQueue, updateCounts } from './render.js';
import { setupBarDrag } from './bar.js';

export function createSource(opts) {
  const src = {
    id: uid(),
    color: nextColor(),
    type: opts.type,
    url: opts.url || null,
    file_id: opts.file_id || null,
    audio_url: opts.audio_url || null,
    title: opts.title || 'Untitled',
    duration: opts.duration || 0,
    platform: opts.platform || 'YT',
    regions: [],
    collapsed: false,
  };
  state.sources.push(src);
  players[src.id] = { type: src.type, currentTime: 0, duration: src.duration };

  $emptyHint.style.display = 'none';
  renderSourceCard(src);
  initPlayer(src);
  updateCounts();
}

function renderSourceCard(src) {
  const card = document.createElement('div');
  card.className = 'source-card';
  card.id = `src-${src.id}`;
  card.style.setProperty('--source-color', src.color);

  card.innerHTML = `
    <div class="source-head" data-id="${src.id}">
      <span class="source-dot"></span>
      <span class="source-name">${esc(src.title)}</span>
      <span class="source-badge">${src.platform}</span>
      <button class="source-remove" data-id="${src.id}">✕</button>
    </div>
    <div class="source-body">
      <div class="stream-bar-wrap" id="bar-${src.id}" style="--source-color:${src.color}">
        <div class="stream-pos" id="pos-${src.id}"></div>
        <div class="stream-needle" id="needle-${src.id}"></div>
        <span class="stream-dur" id="dur-${src.id}">${src.duration ? fmt(src.duration) : '...'}</span>
      </div>
      <div class="stream-controls">
        <button class="ctrl-btn" data-action="play" data-id="${src.id}">▶ PLAY</button>
        <button class="ctrl-btn" data-action="stop" data-id="${src.id}">⏹</button>
        <span class="stream-time" id="time-${src.id}">0:00</span>
      </div>
      <div class="hint-text">CLICK + DRAG ON THE BAR TO SELECT A REGION</div>
      <div class="region-chips" id="chips-${src.id}"></div>
    </div>
  `;

  $sourceList.appendChild(card);

  card.querySelector('.source-head').addEventListener('click', e => {
    if (e.target.classList.contains('source-remove')) return;
    card.classList.toggle('collapsed');
  });

  card.querySelector('.source-remove').addEventListener('click', e => {
    e.stopPropagation();
    removeSource(src.id);
  });

  card.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'play') togglePlay(src.id);
      if (action === 'stop') stopSource(src.id);
    });
  });

  setupBarDrag(src);
}

function removeSource(srcId) {
  const src = state.sources.find(s => s.id === srcId);
  if (!src) return;
  saveSnapshot();

  const p = players[srcId];
  if (p) {
    if (p.ytPlayer) try { p.ytPlayer.destroy(); } catch {}
    if (p.audio) { p.audio.pause(); p.audio.src = ''; }
    delete players[srcId];
  }
  const ytEl = $(`yt-${srcId}`);
  const scEl = $(`sc-${srcId}`);
  if (ytEl) ytEl.remove();
  if (scEl) scEl.remove();

  state.sources = state.sources.filter(s => s.id !== srcId);
  state.exportQueue = state.exportQueue.filter(q => q.sourceId !== srcId);

  const card = $(`src-${srcId}`);
  if (card) card.remove();

  if (!state.sources.length) $emptyHint.style.display = '';
  updateCounts();
  renderQueue();
}

export async function handleGo() {
  const val = $url.value.trim();
  if (!val) return;

  if (val.startsWith('http://') || val.startsWith('https://')) {
    await addUrl(val);
  } else {
    await doSearch(val);
  }
}

async function addUrl(url) {
  $btnGo.disabled = true; $btnGo.textContent = '...';
  try {
    const res = await fetch('/api/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Failed'); return; }

    const plat = (d.platform || '').toLowerCase().includes('soundcloud') ? 'SC' : 'YT';
    createSource({
      type: 'url', url: d.url, title: d.title,
      duration: d.duration || 0, platform: plat,
    });
    $url.value = '';
    $searchDrop.classList.remove('open');
  } catch { alert('Network error'); }
  finally { $btnGo.disabled = false; $btnGo.textContent = 'ADD'; }
}

async function doSearch(query) {
  $searchDrop.classList.add('open');
  $searchDrop.innerHTML = '<div style="padding:16px;text-align:center;color:#555">Searching...</div>';

  try {
    const res = await fetch('/api/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, platform: 'youtube' }),
    });
    const d = await res.json();
    if (!res.ok || !d.results?.length) {
      $searchDrop.innerHTML = '<div style="padding:16px;text-align:center;color:#555">No results</div>';
      return;
    }
    $searchDrop.innerHTML = d.results.map(r => `
      <div class="search-item" data-url="${r.url || ''}" data-title="${esc(r.title)}"
           data-dur="${r.duration || 0}">
        <img src="${r.thumbnail || ''}" alt="" loading="lazy" onerror="this.style.display='none'">
        <span class="s-title">${esc(r.title)}</span>
        <span class="s-dur">${r.duration ? fmt(r.duration) : ''}</span>
      </div>`).join('');

    $searchDrop.querySelectorAll('.search-item').forEach(el => {
      el.addEventListener('click', () => {
        const u = el.dataset.url;
        const fullUrl = u.startsWith('http') ? u : `https://www.youtube.com/watch?v=${u}`;
        createSource({
          type: 'url', url: fullUrl, title: el.dataset.title,
          duration: parseFloat(el.dataset.dur) || 0, platform: 'YT',
        });
        $searchDrop.classList.remove('open');
        $url.value = '';
      });
    });
  } catch { $searchDrop.innerHTML = '<div style="padding:16px;text-align:center;color:#555">Error</div>'; }
}

export async function handleFile() {
  const file = $file.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Upload failed'); return; }
    createSource({
      type: 'file', file_id: d.file_id, title: d.filename,
      audio_url: d.audio_url, duration: 0, platform: 'FILE',
    });
  } catch { alert('Upload failed'); }
  $file.value = '';
}
