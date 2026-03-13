/* Main — init, keybinds, boot */

import { state, undo, redo, onRestore } from './state.js';
import { $url, $btnGo, $file, $searchDrop, $btnExport } from './dom.js';
import { renderBarRegions, renderChips, renderQueue } from './render.js';
import { handleGo, handleFile } from './sources.js';
import { handleExport } from './export.js';
import { initPrecisionOverlay } from './precision.js';
import { pollPlayheads } from './players.js';

// Wire restore callback (for undo/redo)
onRestore(() => {
  for (const src of state.sources) {
    renderBarRegions(src);
    renderChips(src);
  }
  renderQueue();
});

function init() {
  $btnGo.addEventListener('click', handleGo);
  $url.addEventListener('keydown', e => { if (e.key === 'Enter') handleGo(); });
  $file.addEventListener('change', handleFile);
  $btnExport.addEventListener('click', handleExport);

  document.addEventListener('click', e => {
    if (!$searchDrop.contains(e.target) && e.target !== $url) {
      $searchDrop.classList.remove('open');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
  });

  initPrecisionOverlay();
  setInterval(pollPlayheads, 150);
}

// Load SoundCloud Widget API
(function() {
  const s = document.createElement('script');
  s.src = 'https://w.soundcloud.com/player/api.js';
  s.async = true;
  document.head.appendChild(s);
})();

init();
