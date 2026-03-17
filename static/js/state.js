/* Global state, undo/redo, overlap detection */

export const state = {
  sources: [],
  exportQueue: [],
};

export const undoStack = [];
export const redoStack = [];
const MAX_UNDO = 50;

// Players keyed by source id
export const players = {};

// Restore callback — set by main.js to wire render functions
let _onRestore = null;
export function onRestore(cb) { _onRestore = cb; }

export function saveSnapshot() {
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
  _onRestore?.();
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.parse(JSON.stringify({
    sources: state.sources.map(s => ({ id: s.id, regions: s.regions.map(r => ({...r})) })),
    exportQueue: state.exportQueue.map(q => ({...q})),
  })));
  restoreSnapshot(undoStack.pop());
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.parse(JSON.stringify({
    sources: state.sources.map(s => ({ id: s.id, regions: s.regions.map(r => ({...r})) })),
    exportQueue: state.exportQueue.map(q => ({...q})),
  })));
  restoreSnapshot(redoStack.pop());
}

export function regionsOverlap(a, b) {
  return a.start < b.end && a.end > b.start;
}

export function hasOverlap(src, region, excludeId) {
  return src.regions.some(r => r.id !== excludeId && regionsOverlap(r, region));
}
