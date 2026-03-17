/* Export handler with preview */

import { state } from './state.js';
import { $exportFormat, $gapDuration, $overlay, $overlayMsg, $btnExport,
         $exportPreview, $previewAudio, $previewDownload, $previewClose } from './dom.js';

let lastBlobUrl = null;
let lastFilename = null;

function cleanup() {
  if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
  lastFilename = null;
}

export async function handleExport() {
  const readyQueue = state.exportQueue.filter(q => {
    const src = state.sources.find(s => s.id === q.sourceId);
    const reg = src?.regions.find(r => r.id === q.regionId);
    return reg?.ready;
  });

  if (!readyQueue.length) { alert('Mark regions as ready first (\u2713)'); return; }

  const gap = Math.max(0, Math.min(10, parseFloat($gapDuration.value) || 1));

  const payload = {
    format: $exportFormat.value,
    gap_duration: gap,
    ordered_regions: readyQueue.map(q => {
      const src = state.sources.find(s => s.id === q.sourceId);
      const reg = src?.regions.find(r => r.id === q.regionId);
      return { type: src.type, url: src.url, file_id: src.file_id, start: reg.start, end: reg.end };
    }),
  };

  $overlay.style.display = 'flex';
  $overlayMsg.textContent = 'Downloading & chopping...';
  $btnExport.disabled = true;
  cleanup();

  try {
    const res = await fetch('/api/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Export failed'); return; }

    // Fetch as blob to avoid navigation
    const audioRes = await fetch(d.download_url);
    if (!audioRes.ok) { alert('Failed to load exported file'); return; }
    const blob = await audioRes.blob();
    lastBlobUrl = URL.createObjectURL(blob);
    lastFilename = d.filename;

    // Show preview
    $previewAudio.src = lastBlobUrl;
    $exportPreview.style.display = '';
  } catch { alert('Export failed'); }
  finally { $overlay.style.display = 'none'; $btnExport.disabled = false; }
}

function downloadFile() {
  if (!lastBlobUrl || !lastFilename) return;
  const a = document.createElement('a');
  a.href = lastBlobUrl;
  a.download = lastFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function closePreview() {
  $previewAudio.pause();
  $previewAudio.src = '';
  $exportPreview.style.display = 'none';
  cleanup();
}

export function initExportPreview() {
  $previewDownload.addEventListener('click', downloadFile);
  $previewClose.addEventListener('click', closePreview);
}
