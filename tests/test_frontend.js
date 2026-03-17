/**
 * GET DA CHOPPAH — Frontend logic tests
 * Run with: node tests/test_frontend.js
 *
 * Tests the pure-logic functions (overlap, undo/redo, region clamping, color cycling)
 * without needing a browser or DOM.
 */

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; process.stdout.write(`  ✓ ${msg}\n`); }
  else { failed++; process.stderr.write(`  ✗ FAIL: ${msg}\n`); }
}

function section(name) { console.log(`\n── ${name} ──`); }

// ──────────────────────────────────────────────
// Replicate the pure functions from app.js
// ──────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function fmt(sec) {
  if (sec == null || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

const REGION_COLORS = ['#ffcc00','#ff5566','#00ccff','#ff8800','#00ff88','#ff66cc','#88ff00','#cc88ff','#ff3333','#66ffcc','#ffaa33','#33aaff'];
let regionColorIdx = 0;
function nextRegionColor() { return REGION_COLORS[regionColorIdx++ % REGION_COLORS.length]; }

function regionsOverlap(a, b) {
  return a.start < b.end && a.end > b.start;
}

function hasOverlap(src, region, excludeId) {
  return src.regions.some(r => r.id !== excludeId && regionsOverlap(r, region));
}

// Undo/redo simulation
function makeUndoRedo() {
  const undoStack = [];
  const redoStack = [];
  let state = { regions: [] };

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  return {
    getState: () => state,
    save() {
      undoStack.push(snapshot());
      redoStack.length = 0;
    },
    mutate(fn) {
      undoStack.push(snapshot());
      redoStack.length = 0;
      fn(state);
    },
    undo() {
      if (!undoStack.length) return false;
      redoStack.push(snapshot());
      state = undoStack.pop();
      return true;
    },
    redo() {
      if (!redoStack.length) return false;
      undoStack.push(snapshot());
      state = redoStack.pop();
      return true;
    },
    undoLen: () => undoStack.length,
    redoLen: () => redoStack.length,
  };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

section('fmt()');
assert(fmt(0) === '0:00.0', 'fmt(0)');
assert(fmt(62.5) === '1:02.5', 'fmt(62.5)');
assert(fmt(null) === '0:00', 'fmt(null)');
assert(fmt(NaN) === '0:00', 'fmt(NaN)');
assert(fmt(3661) === '61:01.0', 'fmt(3661) large');

section('uid()');
assert(typeof uid() === 'string', 'uid returns string');
assert(uid().length >= 6, 'uid has reasonable length');
assert(uid() !== uid(), 'uid is unique');

section('regionsOverlap()');
assert(regionsOverlap({start:1, end:3}, {start:2, end:4}) === true, 'overlapping regions');
assert(regionsOverlap({start:1, end:3}, {start:3, end:5}) === false, 'adjacent regions (touching) NOT overlapping');
assert(regionsOverlap({start:1, end:3}, {start:4, end:6}) === false, 'separate regions');
assert(regionsOverlap({start:2, end:4}, {start:1, end:3}) === true, 'reverse overlap');
assert(regionsOverlap({start:1, end:5}, {start:2, end:3}) === true, 'contained region');
assert(regionsOverlap({start:2, end:3}, {start:1, end:5}) === true, 'containing region');
assert(regionsOverlap({start:0, end:0.1}, {start:0.1, end:0.2}) === false, 'tiny adjacent not overlapping');

section('hasOverlap()');
{
  const src = {
    regions: [
      { id: 'a', start: 1, end: 3 },
      { id: 'b', start: 5, end: 7 },
    ],
  };
  assert(hasOverlap(src, {start:2, end:4}, null) === true, 'new region overlaps existing');
  assert(hasOverlap(src, {start:3, end:5}, null) === false, 'new region fits in gap (adjacent)');
  assert(hasOverlap(src, {start:3.5, end:4.5}, null) === false, 'new region in empty space');
  assert(hasOverlap(src, {start:0, end:1}, null) === false, 'new region before all');
  assert(hasOverlap(src, {start:7, end:9}, null) === false, 'new region after all');
  assert(hasOverlap(src, {start:2, end:4}, 'a') === false, 'overlaps only the excluded region');
  assert(hasOverlap(src, {start:0, end:10}, 'a') === true, 'overlaps non-excluded region');
}

section('nextRegionColor()');
{
  regionColorIdx = 0;
  const c1 = nextRegionColor();
  const c2 = nextRegionColor();
  assert(c1 === '#ffcc00', 'first color is #ffcc00');
  assert(c2 === '#ff5566', 'second color is #ff5566');
  assert(c1 !== c2, 'consecutive colors are different');
  // Cycles back
  regionColorIdx = REGION_COLORS.length;
  const cycled = nextRegionColor();
  assert(cycled === '#ffcc00', 'colors cycle back');
}

section('Undo/Redo');
{
  const ur = makeUndoRedo();

  // Initial state
  assert(ur.getState().regions.length === 0, 'starts empty');

  // Add a region
  ur.mutate(s => { s.regions.push({ id: '1', start: 0, end: 5 }); });
  assert(ur.getState().regions.length === 1, 'after add: 1 region');
  assert(ur.undoLen() === 1, 'undo stack has 1 entry');

  // Add another
  ur.mutate(s => { s.regions.push({ id: '2', start: 6, end: 10 }); });
  assert(ur.getState().regions.length === 2, 'after 2nd add: 2 regions');

  // Undo
  const undone = ur.undo();
  assert(undone === true, 'undo returns true');
  assert(ur.getState().regions.length === 1, 'after undo: 1 region');
  assert(ur.redoLen() === 1, 'redo stack has 1 entry');

  // Redo
  const redone = ur.redo();
  assert(redone === true, 'redo returns true');
  assert(ur.getState().regions.length === 2, 'after redo: 2 regions');

  // Undo twice
  ur.undo();
  ur.undo();
  assert(ur.getState().regions.length === 0, 'undo back to empty');

  // Undo on empty stack
  assert(ur.undo() === false, 'undo on empty returns false');

  // Redo twice to get back
  ur.redo();
  ur.redo();
  assert(ur.getState().regions.length === 2, 'redo twice restores all');

  // New action clears redo stack
  ur.undo();
  assert(ur.redoLen() === 1, 'redo available after undo');
  ur.mutate(s => { s.regions.push({ id: '3', start: 11, end: 15 }); });
  assert(ur.redoLen() === 0, 'new action clears redo');
}

section('Overlap prevention during move simulation');
{
  // Simulate: regions A[1,3], B[5,7]. Move B left. It should stop at 3.
  const src = {
    regions: [
      { id: 'a', start: 1, end: 3 },
      { id: 'b', start: 5, end: 7 },
    ],
  };

  function computeBounds(src, regionId) {
    const region = src.regions.find(r => r.id === regionId);
    const sorted = src.regions.filter(r => r.id !== regionId).sort((a, b) => a.start - b.start);
    const dur = 20;
    let minS = 0, maxE = dur;
    if (region) {
      for (const r of sorted) {
        if (r.end <= region.start) minS = r.end;
        if (r.start >= region.end) { maxE = r.start; break; }
      }
    }
    return [minS, maxE];
  }

  const [minS, maxE] = computeBounds(src, 'b');
  assert(minS === 3, 'B min start is 3 (end of A)');
  assert(maxE === 20, 'B max end is 20 (no right neighbor)');

  const [minSA, maxEA] = computeBounds(src, 'a');
  assert(minSA === 0, 'A min start is 0 (no left neighbor)');
  assert(maxEA === 5, 'A max end is 5 (start of B)');

  // Simulate moving B to start=2: should clamp to minS=3
  let ns = 2, ne = 4; // trying to move B (len=2) to [2,4]
  const len = 2;
  if (ns < minS) { ns = minS; ne = minS + len; }
  assert(ns === 3, 'move clamped start to 3');
  assert(ne === 5, 'move clamped end to 5');
}

section('Resize clamping simulation');
{
  const src = {
    regions: [
      { id: 'a', start: 1, end: 3 },
      { id: 'b', start: 5, end: 7 },
    ],
  };

  // Resize A's right edge to 6 — should clamp to 5 (start of B)
  const maxE = 5; // from computeBounds
  let newEnd = 6;
  newEnd = Math.min(maxE, Math.max(newEnd, 1 + 0.1)); // min region size 0.1
  assert(newEnd === 5, 'right resize clamped to neighbor start');

  // Resize B's left edge to 2 — should clamp to 3 (end of A)
  const minS = 3; // from computeBounds
  let newStart = 2;
  newStart = Math.max(minS, Math.min(newStart, 7 - 0.1));
  assert(newStart === 3, 'left resize clamped to neighbor end');
}

section('Precision overlay clamping simulation');
{
  // Simulate clampPrecRegion logic: region between neighbors
  const minStart = 3;  // end of left neighbor
  const maxEnd = 10;   // start of right neighbor

  function clampPrecRegion(newStart, newEnd) {
    const s = Math.round(Math.max(minStart, Math.min(newStart, newEnd - 0.1)) * 10) / 10;
    const e = Math.round(Math.min(maxEnd, Math.max(newEnd, newStart + 0.1)) * 10) / 10;
    return { start: s, end: e };
  }

  const r1 = clampPrecRegion(1, 8);
  assert(r1.start === 3, 'start clamped to minStart');
  assert(r1.end === 8, 'end within bounds');

  const r2 = clampPrecRegion(5, 15);
  assert(r2.start === 5, 'start within bounds');
  assert(r2.end === 10, 'end clamped to maxEnd');

  const r3 = clampPrecRegion(7, 7.05);
  assert(r3.start === 7, 'start stays when end expands to min size');
  assert(r3.end === 7.1, 'end pushed forward to maintain min size');

  const r4 = clampPrecRegion(0, 20);
  assert(r4.start === 3, 'fully out-of-bounds start clamped');
  assert(r4.end === 10, 'fully out-of-bounds end clamped');
}

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
console.log(`\n${'═'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed!');
