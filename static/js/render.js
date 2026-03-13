/* Rendering — bar regions, chips, queue, timeline, counts */

import { state, players, saveSnapshot } from './state.js';
import { $, $regionCount, $exportControls, $queueList, $queueEmpty, $timelineStrip, $sourceCount } from './dom.js';
import { fmt, esc } from './helpers.js';
import { previewRegion } from './players.js';

export function renderBarRegions(src) {
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

export function renderChips(src) {
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

  wrap.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const r = src.regions.find(r => r.id === btn.dataset.rid);
      if (r) previewRegion(src.id, r);
    });
  });

  wrap.querySelectorAll('.ready-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const r = src.regions.find(r => r.id === btn.dataset.rid);
      if (r) { saveSnapshot(); r.ready = !r.ready; renderChips(src); renderBarRegions(src); renderQueue(); }
    });
  });

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

export function renderQueue() {
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

  setupQueueDrag();

  $queueList.querySelectorAll('.q-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      saveSnapshot();
      const qid = btn.dataset.qid;
      const qi = state.exportQueue.find(q => q.id === qid);
      if (qi) {
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

export function renderTimeline() {
  const readyQueue = state.exportQueue.filter(q => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    return reg?.ready;
  });
  if (!readyQueue.length) { $timelineStrip.innerHTML = ''; return; }

  let total = 0;
  const segments = [];
  readyQueue.forEach((q, i) => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    if (!reg) return;
    const dur = reg.end - reg.start;
    segments.push({ color: reg.color || src.color, start: total, dur });
    total += dur;
    if (i < readyQueue.length - 1) total += 1;
  });
  if (total <= 0) { $timelineStrip.innerHTML = ''; return; }

  $timelineStrip.innerHTML = segments.map(seg =>
    `<div class="timeline-block" style="left:${seg.start/total*100}%;width:${seg.dur/total*100}%;background:${seg.color}"></div>`
  ).join('');
}

export function updateCounts() {
  $sourceCount.textContent = state.sources.length || '';
}
