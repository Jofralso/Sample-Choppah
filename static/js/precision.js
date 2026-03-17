/* Precision overlay — zoomed region refinement */

import { players, saveSnapshot, undoStack } from './state.js';
import { $ } from './dom.js';
import { fmt } from './helpers.js';
import { renderBarRegions, renderChips, renderQueue } from './render.js';
import { previewRegion } from './players.js';

let precState = null;

export function openPrecisionOverlay(src, region) {
  const dur = players[src.id]?.duration || src.duration || 1;
  const regionDur = region.end - region.start;
  const padding = Math.max(regionDur * 0.5, dur * 0.05, 2);
  const viewStart = Math.max(0, region.start - padding);
  const viewEnd = Math.min(dur, region.end + padding);

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

export function initPrecisionOverlay() {
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

  $('prec-start').addEventListener('input', () => {
    if (!precState) return;
    clampPrecRegion(parseFloat($('prec-start').value) || 0, precState.region.end);
  });
  $('prec-end').addEventListener('input', () => {
    if (!precState) return;
    clampPrecRegion(precState.region.start, parseFloat($('prec-end').value) || 0);
  });

  $('prec-apply').addEventListener('click', () => closePrecisionOverlay(true));
  $('prec-cancel').addEventListener('click', () => closePrecisionOverlay(false));
  $('prec-close').addEventListener('click', () => closePrecisionOverlay(false));
  $('prec-preview').addEventListener('click', () => {
    if (!precState) return;
    previewRegion(precState.src.id, precState.region);
  });

  $('precision-overlay').addEventListener('click', e => {
    if (e.target === $('precision-overlay')) closePrecisionOverlay(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && precState) closePrecisionOverlay(false);
  });
}
