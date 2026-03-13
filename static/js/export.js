/* Export handler */

import { state } from './state.js';
import { $exportFormat, $overlay, $overlayMsg, $btnExport } from './dom.js';

export async function handleExport() {
  const readyQueue = state.exportQueue.filter(q => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    return reg?.ready;
  });

  if (!readyQueue.length) { alert('Mark regions as ready first (✓)'); return; }

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
