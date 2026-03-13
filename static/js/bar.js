/* Drag-to-select / move / resize on stream bar */

import { players, saveSnapshot, hasOverlap } from './state.js';
import { $ } from './dom.js';
import { uid, nextRegionColor } from './helpers.js';
import { renderBarRegions, renderChips, renderQueue } from './render.js';
import { openPrecisionOverlay } from './precision.js';
import { seekSource } from './players.js';
import { state } from './state.js';

export function setupBarDrag(src) {
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

  bar.addEventListener('click', e => {
    if (Math.abs(e.clientX - startX) > 5) return;
    if (e.target.closest('.bar-region')) return;
    seekSource(src.id, xToTime(e.clientX));
  });
}
