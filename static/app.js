/* ═══════════════════════════════════════════════════════
   GET DA CHOPPAH — Frontend
   Stream-bar centric, drag-select, preview, ready, reorder
   ═══════════════════════════════════════════════════════ */

const COLORS = ['#ffcc00','#ff3333','#00ccff','#ff8800','#00ff88','#ff66cc','#88ff00','#cc88ff'];
let colorIdx = 0;
function nextColor() { return COLORS[colorIdx++ % COLORS.length]; }

// Per-region colors (each region gets its own)
const REGION_COLORS = ['#ffcc00','#ff5566','#00ccff','#ff8800','#00ff88','#ff66cc','#88ff00','#cc88ff','#ff3333','#66ffcc','#ffaa33','#33aaff'];
let regionColorIdx = 0;
function nextRegionColor() { return REGION_COLORS[regionColorIdx++ % REGION_COLORS.length]; }

// ─── State ───
const state = {
  sources: [],
  exportQueue: [],
};

// Undo / Redo
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;

// Players keyed by source id
const players = {};  // { [sourceId]: { type, ytPlayer?, scWidget?, audio?, currentTime, duration } }

let ytReady = false;
window.onYouTubeIframeAPIReady = () => { ytReady = true; };

// ─── Helpers ───
function uid() { return Math.random().toString(36).slice(2, 10); }

function fmt(sec) {
  if (sec == null || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

function extractYTId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
  return m ? m[1] : null;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ─── Undo / Redo ───
function saveSnapshot() {
  undoStack.push(JSON.parse(JSON.stringify({
    sources: state.sources.map(s => ({ id: s.id, regions: s.regions.map(r => ({...r})) })),
    exportQueue: state.exportQueue.map(q => ({...q})),
  })));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

function restoreSnapshot(snapshot) {
  for (const saved of snapshot.sources) {
    const src = state.sources.find(s => s.id === saved.id);
    if (src) src.regions = saved.regions;
  }
  state.exportQueue = snapshot.exportQueue;
  for (const src of state.sources) {
    renderBarRegions(src);
    renderChips(src);
  }
  renderQueue();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.parse(JSON.stringify({
    sources: state.sources.map(s => ({ id: s.id, regions: s.regions.map(r => ({...r})) })),
    exportQueue: state.exportQueue.map(q => ({...q})),
  })));
  restoreSnapshot(undoStack.pop());
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.parse(JSON.stringify({
    sources: state.sources.map(s => ({ id: s.id, regions: s.regions.map(r => ({...r})) })),
    exportQueue: state.exportQueue.map(q => ({...q})),
  })));
  restoreSnapshot(redoStack.pop());
}

// ─── Overlap detection ───
function regionsOverlap(a, b) {
  return a.start < b.end && a.end > b.start;
}

function hasOverlap(src, region, excludeId) {
  return src.regions.some(r => r.id !== excludeId && regionsOverlap(r, region));
}

// ─── DOM ───
const $ = id => document.getElementById(id);
const $url = $('url-input');
const $btnGo = $('btn-go');
const $file = $('file-input');
const $searchDrop = $('search-results');
const $sourceList = $('source-list');
const $emptyHint = $('empty-hint');
const $sourceCount = $('source-count');
const $queueList = $('queue-list');
const $queueEmpty = $('queue-empty');
const $regionCount = $('region-count');
const $exportControls = $('export-controls');
const $btnExport = $('btn-export');
const $exportFormat = $('export-format');
const $timelineStrip = $('timeline-strip');
const $overlay = $('overlay');
const $overlayMsg = $('overlay-msg');
const $hiddenPlayers = $('hidden-players');

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
function init() {
  $btnGo.addEventListener('click', handleGo);
  $url.addEventListener('keydown', e => { if (e.key === 'Enter') handleGo(); });
  $file.addEventListener('change', handleFile);
  $btnExport.addEventListener('click', handleExport);

  // Close search on outside click
  document.addEventListener('click', e => {
    if (!$searchDrop.contains(e.target) && e.target !== $url) {
      $searchDrop.classList.remove('open');
    }
  });

  // Keybinds
  document.addEventListener('keydown', e => {
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
  });

  // Precision overlay
  initPrecisionOverlay();

  // Playhead poll
  setInterval(pollPlayheads, 150);
}

// ═══════════════════════════════════════════════════════
// ADD SOURCE (URL or Search)
// ═══════════════════════════════════════════════════════
async function handleGo() {
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

// ═══════════════════════════════════════════════════════
// LOCAL FILE
// ═══════════════════════════════════════════════════════
async function handleFile() {
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

// ═══════════════════════════════════════════════════════
// CREATE SOURCE — adds to state and renders card
// ═══════════════════════════════════════════════════════
function createSource(opts) {
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
    regions: [],       // { id, start, end, ready }
    collapsed: false,
  };
  state.sources.push(src);
  players[src.id] = { type: src.type, currentTime: 0, duration: src.duration };

  $emptyHint.style.display = 'none';
  renderSourceCard(src);
  initPlayer(src);
  updateCounts();
}

// ═══════════════════════════════════════════════════════
// RENDER SOURCE CARD
// ═══════════════════════════════════════════════════════
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

  // Header collapse toggle
  card.querySelector('.source-head').addEventListener('click', e => {
    if (e.target.classList.contains('source-remove')) return;
    card.classList.toggle('collapsed');
  });

  // Remove source
  card.querySelector('.source-remove').addEventListener('click', e => {
    e.stopPropagation();
    removeSource(src.id);
  });

  // Play/Stop
  card.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'play') togglePlay(src.id, btn);
      if (action === 'stop') stopSource(src.id);
    });
  });

  // Drag-to-select on bar
  setupBarDrag(src);
}

// ═══════════════════════════════════════════════════════
// DRAG-TO-SELECT / MOVE / RESIZE ON STREAM BAR
// ═══════════════════════════════════════════════════════
function setupBarDrag(src) {
  const bar = $(`bar-${src.id}`);
  let mode = null; // 'select' | 'move' | 'resize-left' | 'resize-right'
  let startX = 0;
  let selEl = null;
  let activeRegion = null;
  let origStart = 0, origEnd = 0;
  let dragBounds = [0, 0];
  let snapshotSaved = false;

  function xToTime(x) {
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    const dur = players[src.id]?.duration || src.duration || 1;
    return pct * dur;
  }

  function computeBounds(regionId) {
    const region = src.regions.find(r => r.id === regionId);
    const sorted = src.regions.filter(r => r.id !== regionId).sort((a, b) => a.start - b.start);
    const dur = players[src.id]?.duration || src.duration || 1;
    let minS = 0, maxE = dur;
    if (region) {
      for (const r of sorted) {
        if (r.end <= region.start) minS = r.end;
        if (r.start >= region.end) { maxE = r.start; break; }
      }
    }
    return [minS, maxE];
  }

  bar.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    startX = e.clientX;

    // Check resize handle
    const handle = e.target.closest('.region-handle');
    if (handle) {
      const rid = handle.dataset.rid;
      activeRegion = src.regions.find(r => r.id === rid);
      if (!activeRegion) return;
      origStart = activeRegion.start;
      origEnd = activeRegion.end;
      dragBounds = computeBounds(rid);
      mode = handle.dataset.edge === 'left' ? 'resize-left' : 'resize-right';
      snapshotSaved = false;
      return;
    }

    // Check region body (drag to move)
    const regionEl = e.target.closest('.bar-region');
    if (regionEl && regionEl.dataset.rid) {
      activeRegion = src.regions.find(r => r.id === regionEl.dataset.rid);
      if (!activeRegion) return;
      origStart = activeRegion.start;
      origEnd = activeRegion.end;
      dragBounds = computeBounds(activeRegion.id);
      mode = 'move';
      snapshotSaved = false;
      return;
    }

    // Empty space → new selection
    mode = 'select';
    selEl = document.createElement('div');
    selEl.className = 'bar-region selecting';
    selEl.style.setProperty('--source-color', src.color);
    const rect = bar.getBoundingClientRect();
    selEl.style.left = ((e.clientX - rect.left) / rect.width * 100) + '%';
    selEl.style.width = '0%';
    bar.appendChild(selEl);
    selEl._startTime = xToTime(e.clientX);
  });

  const onMouseMove = e => {
    if (!mode) return;

    // Defer snapshot until actual movement for move/resize
    if (!snapshotSaved && (mode === 'move' || mode === 'resize-left' || mode === 'resize-right')) {
      if (Math.abs(e.clientX - startX) > 3) {
        saveSnapshot();
        snapshotSaved = true;
      } else {
        return;
      }
    }

    if (mode === 'select' && selEl) {
      const rect = bar.getBoundingClientRect();
      const x1 = Math.max(0, Math.min(1, (startX - rect.left) / rect.width));
      const x2 = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      selEl.style.left = (Math.min(x1, x2) * 100) + '%';
      selEl.style.width = (Math.abs(x2 - x1) * 100) + '%';
    }

    else if (mode === 'move' && activeRegion) {
      const dx = xToTime(e.clientX) - xToTime(startX);
      const len = origEnd - origStart;
      let ns = origStart + dx, ne = origEnd + dx;
      const [minS, maxE] = dragBounds;
      if (ns < minS) { ns = minS; ne = minS + len; }
      if (ne > maxE) { ne = maxE; ns = maxE - len; }
      activeRegion.start = Math.round(ns * 10) / 10;
      activeRegion.end = Math.round(ne * 10) / 10;
      renderBarRegions(src);
    }

    else if (mode === 'resize-left' && activeRegion) {
      let ns = xToTime(e.clientX);
      ns = Math.max(dragBounds[0], Math.min(ns, activeRegion.end - 0.1));
      activeRegion.start = Math.round(ns * 10) / 10;
      renderBarRegions(src);
    }

    else if (mode === 'resize-right' && activeRegion) {
      let ne = xToTime(e.clientX);
      ne = Math.min(dragBounds[1], Math.max(ne, activeRegion.start + 0.1));
      activeRegion.end = Math.round(ne * 10) / 10;
      renderBarRegions(src);
    }
  };

  const onMouseUp = e => {
    if (!mode) return;

    if (mode === 'select') {
      if (selEl) {
        const endTime = xToTime(e.clientX);
        const sTime = selEl._startTime;
        const s = Math.round(Math.min(sTime, endTime) * 10) / 10;
        const en = Math.round(Math.max(sTime, endTime) * 10) / 10;
        selEl.remove();
        selEl = null;

        if (en - s >= 0.1 && !hasOverlap(src, { start: s, end: en }, null)) {
          saveSnapshot();
          const region = { id: uid(), start: s, end: en, ready: false, color: nextRegionColor() };
          src.regions.push(region);
          state.exportQueue.push({ sourceId: src.id, regionId: region.id, id: uid() });
          renderBarRegions(src);
          renderChips(src);
          renderQueue();
        }
      }
    } else if (mode === 'move' && !snapshotSaved && activeRegion) {
      // Click on region (not dragged) → open precision overlay
      openPrecisionOverlay(src, activeRegion);
    } else if (mode === 'move' || mode === 'resize-left' || mode === 'resize-right') {
      renderChips(src);
      renderQueue();
    }

    mode = null;
    activeRegion = null;
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // Click to seek (only simple taps on empty space)
  bar.addEventListener('click', e => {
    if (Math.abs(e.clientX - startX) > 5) return;
    if (e.target.closest('.bar-region')) return;
    seekSource(src.id, xToTime(e.clientX));
  });
}

// ═══════════════════════════════════════════════════════
// RENDER BAR REGIONS (colored overlays on bar)
// ═══════════════════════════════════════════════════════
function renderBarRegions(src) {
  const bar = $(`bar-${src.id}`);
  bar.querySelectorAll('.bar-region').forEach(el => el.remove());

  const dur = players[src.id]?.duration || src.duration || 1;
  src.regions.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'bar-region' + (r.ready ? ' ready-region' : '');
    el.dataset.rid = r.id;
    el.style.setProperty('--region-color', r.color || src.color);
    el.style.left = (r.start / dur * 100) + '%';
    el.style.width = ((r.end - r.start) / dur * 100) + '%';
    el.innerHTML = `
      <div class="region-handle left" data-rid="${r.id}" data-edge="left"></div>
      <span class="region-label">${i + 1}</span>
      <div class="region-handle right" data-rid="${r.id}" data-edge="right"></div>`;
    bar.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════
// RENDER REGION CHIPS (below bar)
// ═══════════════════════════════════════════════════════
function renderChips(src) {
  const wrap = $(`chips-${src.id}`);
  if (!wrap) return;
  if (!src.regions.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = src.regions.map((r, i) => `
    <div class="region-chip ${r.ready ? 'ready' : ''}" data-rid="${r.id}"
         style="--chip-color:${r.color || src.color}">
      <span class="chip-ready-icon">${r.ready ? '●' : '○'}</span>
      <span class="chip-times">${fmt(r.start)}–${fmt(r.end)}</span>
      <span class="chip-dur">${(r.end - r.start).toFixed(1)}s</span>
      <button class="chip-btn preview-btn" data-sid="${src.id}" data-rid="${r.id}" title="Preview">▶</button>
      <button class="chip-btn ready-btn" data-sid="${src.id}" data-rid="${r.id}" title="Toggle ready">✓</button>
      <button class="chip-btn remove-btn" data-sid="${src.id}" data-ridx="${i}" title="Remove">✕</button>
    </div>
  `).join('');

  // Preview
  wrap.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const r = src.regions.find(r => r.id === btn.dataset.rid);
      if (r) previewRegion(src.id, r);
    });
  });

  // Ready toggle
  wrap.querySelectorAll('.ready-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const r = src.regions.find(r => r.id === btn.dataset.rid);
      if (r) { saveSnapshot(); r.ready = !r.ready; renderChips(src); renderBarRegions(src); renderQueue(); }
    });
  });

  // Remove
  wrap.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      saveSnapshot();
      const idx = parseInt(btn.dataset.ridx);
      const removed = src.regions.splice(idx, 1)[0];
      state.exportQueue = state.exportQueue.filter(q => q.regionId !== removed.id);
      renderChips(src); renderBarRegions(src); renderQueue();
    });
  });
}

// ═══════════════════════════════════════════════════════
// PRECISION OVERLAY — zoomed refinement of a region
// ═══════════════════════════════════════════════════════
let precState = null;

function openPrecisionOverlay(src, region) {
  const dur = players[src.id]?.duration || src.duration || 1;
  const regionDur = region.end - region.start;
  const padding = Math.max(regionDur * 0.5, dur * 0.05, 2);
  const viewStart = Math.max(0, region.start - padding);
  const viewEnd = Math.min(dur, region.end + padding);

  // Compute fixed bounds from neighbors
  const sorted = src.regions.filter(r => r.id !== region.id).sort((a, b) => a.start - b.start);
  let minS = 0, maxE = dur;
  for (const r of sorted) { if (r.end <= region.start) minS = r.end; }
  for (const r of sorted) { if (r.start >= region.end) { maxE = r.start; break; } }

  precState = { src, region, origStart: region.start, origEnd: region.end, viewStart, viewEnd, minStart: minS, maxEnd: maxE };

  saveSnapshot();

  $('prec-source-name').textContent = src.title;
  $('prec-start').value = region.start.toFixed(1);
  $('prec-end').value = region.end.toFixed(1);
  $('prec-start').max = dur;
  $('prec-end').max = dur;
  $('prec-view-start').textContent = fmt(viewStart);
  $('prec-view-end').textContent = fmt(viewEnd);

  updatePrecisionBar();
  $('precision-overlay').style.display = 'flex';
}

function closePrecisionOverlay(apply) {
  if (!precState) return;
  const { src, region } = precState;
  if (!apply) {
    region.start = precState.origStart;
    region.end = precState.origEnd;
    undoStack.pop();
  }
  renderBarRegions(src);
  renderChips(src);
  renderQueue();
  $('precision-overlay').style.display = 'none';
  precState = null;
}

function updatePrecisionBar() {
  if (!precState) return;
  const { src, region, viewStart, viewEnd } = precState;
  const viewDur = viewEnd - viewStart;

  const regionEl = $('prec-region');
  const handleL = $('prec-handle-left');
  const handleR = $('prec-handle-right');

  const left = Math.max(0, (region.start - viewStart) / viewDur * 100);
  const right = Math.min(100, (region.end - viewStart) / viewDur * 100);
  const width = right - left;

  regionEl.style.left = left + '%';
  regionEl.style.width = width + '%';
  regionEl.style.setProperty('--region-color', region.color || src.color);

  handleL.style.left = left + '%';
  handleR.style.left = right + '%';

  $('prec-dur').textContent = (region.end - region.start).toFixed(1) + 's';
  $('prec-start').value = region.start.toFixed(1);
  $('prec-end').value = region.end.toFixed(1);

  renderBarRegions(src);
}

function clampPrecRegion(newStart, newEnd) {
  if (!precState) return;
  const { region, minStart, maxEnd } = precState;
  const s = Math.round(Math.max(minStart, Math.min(newStart, newEnd - 0.1)) * 10) / 10;
  const e = Math.round(Math.min(maxEnd, Math.max(newEnd, newStart + 0.1)) * 10) / 10;
  region.start = s;
  region.end = e;
  updatePrecisionBar();
}

function initPrecisionOverlay() {
  const bar = $('prec-bar');
  const handleL = $('prec-handle-left');
  const handleR = $('prec-handle-right');
  let dragEdge = null;

  function barXToTime(x) {
    if (!precState) return 0;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    return precState.viewStart + pct * (precState.viewEnd - precState.viewStart);
  }

  handleL.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); dragEdge = 'left'; });
  handleR.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); dragEdge = 'right'; });

  document.addEventListener('mousemove', e => {
    if (!dragEdge || !precState) return;
    const t = barXToTime(e.clientX);
    if (dragEdge === 'left') {
      clampPrecRegion(t, precState.region.end);
    } else {
      clampPrecRegion(precState.region.start, t);
    }
  });

  document.addEventListener('mouseup', () => { dragEdge = null; });

  // Number inputs
  $('prec-start').addEventListener('input', () => {
    if (!precState) return;
    clampPrecRegion(parseFloat($('prec-start').value) || 0, precState.region.end);
  });
  $('prec-end').addEventListener('input', () => {
    if (!precState) return;
    clampPrecRegion(precState.region.start, parseFloat($('prec-end').value) || 0);
  });

  // Buttons
  $('prec-apply').addEventListener('click', () => closePrecisionOverlay(true));
  $('prec-cancel').addEventListener('click', () => closePrecisionOverlay(false));
  $('prec-close').addEventListener('click', () => closePrecisionOverlay(false));
  $('prec-preview').addEventListener('click', () => {
    if (!precState) return;
    previewRegion(precState.src.id, precState.region);
  });

  // Close on backdrop click
  $('precision-overlay').addEventListener('click', e => {
    if (e.target === $('precision-overlay')) closePrecisionOverlay(false);
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && precState) closePrecisionOverlay(false);
  });
}

// ═══════════════════════════════════════════════════════
// PLAYER SETUP (hidden YT/SC embeds, or <audio> for files)
// ═══════════════════════════════════════════════════════
function initPlayer(src) {
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
            // Update play button text
            const btn = document.querySelector(`[data-action="play"][data-id="${src.id}"]`);
            if (btn) btn.textContent = (e.data === 1) ? '⏸ PAUSE' : '▶ PLAY';
          }
        }
      });
    }
    if (ytReady) create();
    else { const iv = setInterval(() => { if (ytReady) { clearInterval(iv); create(); } }, 200); }

  } else if (src.type === 'url' && src.platform === 'SC') {
    const iframe = document.createElement('iframe');
    iframe.width = '1'; iframe.height = '1';
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(src.url)}&auto_play=false`;
    iframe.id = `sc-${src.id}`;
    $hiddenPlayers.appendChild(iframe);

    const iv = setInterval(() => {
      if (window.SC && SC.Widget) {
        clearInterval(iv);
        p.scWidget = SC.Widget(iframe);
        p.scWidget.bind(SC.Widget.Events.READY, () => {
          p.scWidget.getDuration(ms => {
            p.duration = ms / 1000; src.duration = p.duration; updateDurLabel(src);
          });
        });
        p.scWidget.bind(SC.Widget.Events.PLAY, () => {
          const btn = document.querySelector(`[data-action="play"][data-id="${src.id}"]`);
          if (btn) btn.textContent = '⏸ PAUSE';
        });
        p.scWidget.bind(SC.Widget.Events.PAUSE, () => {
          const btn = document.querySelector(`[data-action="play"][data-id="${src.id}"]`);
          if (btn) btn.textContent = '▶ PLAY';
        });
      }
    }, 300);

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

function updateDurLabel(src) {
  const el = $(`dur-${src.id}`);
  if (el) el.textContent = fmt(src.duration);
}

// ═══════════════════════════════════════════════════════
// PLAYBACK CONTROLS
// ═══════════════════════════════════════════════════════
function togglePlay(srcId, btn) {
  const p = players[srcId];
  if (!p) return;

  if (p.ytPlayer) {
    const st = p.ytPlayer.getPlayerState?.();
    if (st === 1) p.ytPlayer.pauseVideo();
    else p.ytPlayer.playVideo();
  } else if (p.scWidget) {
    p.scWidget.toggle();
  } else if (p.audio) {
    if (p.audio.paused) p.audio.play();
    else p.audio.pause();
  }
}

function stopSource(srcId) {
  const p = players[srcId];
  if (!p) return;
  if (p.ytPlayer) { p.ytPlayer.pauseVideo(); p.ytPlayer.seekTo(0); }
  else if (p.scWidget) { p.scWidget.pause(); p.scWidget.seekTo(0); }
  else if (p.audio) { p.audio.pause(); p.audio.currentTime = 0; }

  const btn = document.querySelector(`[data-action="play"][data-id="${srcId}"]`);
  if (btn) btn.textContent = '▶ PLAY';
}

function seekSource(srcId, t) {
  const p = players[srcId];
  if (!p) return;
  if (p.ytPlayer) p.ytPlayer.seekTo(t, true);
  else if (p.scWidget) p.scWidget.seekTo(t * 1000);
  else if (p.audio) p.audio.currentTime = t;
}

function getCurrentTime(srcId) {
  const p = players[srcId];
  if (!p) return 0;
  if (p.ytPlayer && p.ytPlayer.getCurrentTime) return p.ytPlayer.getCurrentTime();
  if (p._scTime != null) return p._scTime;
  if (p.audio) return p.audio.currentTime;
  return 0;
}

function previewRegion(srcId, region) {
  seekSource(srcId, region.start);
  const p = players[srcId];

  // Start playing
  if (p.ytPlayer) p.ytPlayer.playVideo();
  else if (p.scWidget) p.scWidget.play();
  else if (p.audio) p.audio.play();

  // Stop at end
  const check = setInterval(() => {
    const t = getCurrentTime(srcId);
    if (t >= region.end - 0.05) {
      clearInterval(check);
      if (p.ytPlayer) p.ytPlayer.pauseVideo();
      else if (p.scWidget) p.scWidget.pause();
      else if (p.audio) p.audio.pause();
    }
  }, 80);

  // Safety timeout
  setTimeout(() => clearInterval(check), (region.end - region.start + 2) * 1000);
}

// ─── Playhead poll ───
function pollPlayheads() {
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

// ═══════════════════════════════════════════════════════
// REMOVE SOURCE
// ═══════════════════════════════════════════════════════
function removeSource(srcId) {
  const src = state.sources.find(s => s.id === srcId);
  if (!src) return;
  saveSnapshot();

  // Stop and clean player
  const p = players[srcId];
  if (p) {
    if (p.ytPlayer) try { p.ytPlayer.destroy(); } catch {}
    if (p.audio) { p.audio.pause(); p.audio.src = ''; }
    delete players[srcId];
  }
  // Remove hidden player DOM
  const ytEl = $(`yt-${srcId}`);
  const scEl = $(`sc-${srcId}`);
  if (ytEl) ytEl.remove();
  if (scEl) scEl.remove();

  // Clean state
  state.sources = state.sources.filter(s => s.id !== srcId);
  state.exportQueue = state.exportQueue.filter(q => q.sourceId !== srcId);

  // Remove card
  const card = $(`src-${srcId}`);
  if (card) card.remove();

  if (!state.sources.length) $emptyHint.style.display = '';
  updateCounts();
  renderQueue();
}

// ═══════════════════════════════════════════════════════
// EXPORT QUEUE — right column
// ═══════════════════════════════════════════════════════
function renderQueue() {
  const readyItems = state.exportQueue.filter(q => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    return reg?.ready;
  });
  const totalReady = readyItems.length;
  const totalAll = state.exportQueue.length;

  $regionCount.textContent = totalReady > 0 ? `${totalReady}/${totalAll}` : totalAll;
  $exportControls.style.display = totalReady > 0 ? '' : 'none';

  if (!state.exportQueue.length) {
    $queueList.innerHTML = '';
    $queueEmpty.style.display = '';
    renderTimeline();
    return;
  }
  $queueEmpty.style.display = 'none';

  $queueList.innerHTML = state.exportQueue.map((q, i) => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    if (!src || !reg) return '';

    const isReady = reg.ready;
    return `
      ${i > 0 ? '<div class="queue-sep">── 1s ──</div>' : ''}
      <div class="queue-item ${isReady ? '' : 'not-ready'}" draggable="true"
           data-qid="${q.id}" style="--q-color:${src.color}">
        <span class="q-handle">☰</span>
        <span class="q-num">${i + 1}</span>
        <span class="q-color-dot" style="background:${src.color}"></span>
        <span class="q-name" title="${esc(src.title)}">${esc(src.title)}</span>
        <span class="q-times">${fmt(reg.start)}–${fmt(reg.end)}</span>
        <span class="q-ready-dot ${isReady ? 'is-ready' : ''}"></span>
        <button class="q-remove" data-qid="${q.id}">✕</button>
      </div>`;
  }).join('');

  // Drag reorder
  setupQueueDrag();

  // Remove from queue
  $queueList.querySelectorAll('.q-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      saveSnapshot();
      const qid = btn.dataset.qid;
      const qi = state.exportQueue.find(q => q.id === qid);
      if (qi) {
        // Also remove the region from the source
        const src = state.sources.find(s => s.id === qi.sourceId);
        if (src) {
          src.regions = src.regions.filter(r => r.id !== qi.regionId);
          renderChips(src);
          renderBarRegions(src);
        }
      }
      state.exportQueue = state.exportQueue.filter(q => q.id !== qid);
      renderQueue();
    });
  });

  renderTimeline();
}

// ─── Queue drag & drop reorder ───
function setupQueueDrag() {
  let draggedId = null;

  $queueList.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      draggedId = el.dataset.qid;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      $queueList.querySelectorAll('.queue-item').forEach(x => x.classList.remove('drag-over'));
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      $queueList.querySelectorAll('.queue-item').forEach(x => x.classList.remove('drag-over'));
      el.classList.add('drag-over');
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const targetId = el.dataset.qid;
      if (draggedId === targetId) return;

      const fromIdx = state.exportQueue.findIndex(q => q.id === draggedId);
      const toIdx = state.exportQueue.findIndex(q => q.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return;
      saveSnapshot();

      const [item] = state.exportQueue.splice(fromIdx, 1);
      state.exportQueue.splice(toIdx, 0, item);
      renderQueue();
    });
  });
}

// ─── Timeline strip ───
function renderTimeline() {
  const readyQueue = state.exportQueue.filter(q => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    return reg?.ready;
  });

  if (!readyQueue.length) {
    $timelineStrip.innerHTML = '';
    return;
  }

  // Calculate total duration
  let total = 0;
  const segments = [];
  readyQueue.forEach((q, i) => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    if (!reg) return;
    const dur = reg.end - reg.start;
    segments.push({ color: reg.color || src.color, start: total, dur });
    total += dur;
    if (i < readyQueue.length - 1) total += 1; // 1s gap
  });

  if (total <= 0) { $timelineStrip.innerHTML = ''; return; }

  $timelineStrip.innerHTML = segments.map(seg =>
    `<div class="timeline-block" style="left:${seg.start/total*100}%;width:${seg.dur/total*100}%;background:${seg.color}"></div>`
  ).join('');
}

// ─── Counts ───
function updateCounts() {
  $sourceCount.textContent = state.sources.length || '';
}

// ═══════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════
async function handleExport() {
  // Only export ready regions in queue order
  const readyQueue = state.exportQueue.filter(q => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    return reg?.ready;
  });

  if (!readyQueue.length) { alert('Mark regions as ready first (✓)'); return; }

  // Send flat ordered list so backend respects queue order
  const payload = {
    format: $exportFormat.value,
    ordered_regions: readyQueue.map(q => {
      const src = state.sources.find(s => s.id === q.sourceId);
      const reg = src?.regions.find(r => r.id === q.regionId);
      return { type: src.type, url: src.url, file_id: src.file_id, start: reg.start, end: reg.end };
    }),
  };

  $overlay.style.display = 'flex';
  $overlayMsg.textContent = 'Downloading & chopping...';
  $btnExport.disabled = true;

  try {
    const res = await fetch('/api/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Export failed'); return; }

    const a = document.createElement('a');
    a.href = d.download_url;
    a.download = d.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch { alert('Export failed'); }
  finally { $overlay.style.display = 'none'; $btnExport.disabled = false; }
}

// ─── Load SoundCloud Widget API ───
(function() {
  const s = document.createElement('script');
  s.src = 'https://w.soundcloud.com/player/api.js';
  s.async = true;
  document.head.appendChild(s);
})();

// ─── Boot ───
init();
