/* Helpers — pure functions, no side effects */

export const COLORS = ['#ffcc00','#ff3333','#00ccff','#ff8800','#00ff88','#ff66cc','#88ff00','#cc88ff'];
let colorIdx = 0;
export function nextColor() { return COLORS[colorIdx++ % COLORS.length]; }

export const REGION_COLORS = ['#ffcc00','#ff5566','#00ccff','#ff8800','#00ff88','#ff66cc','#88ff00','#cc88ff','#ff3333','#66ffcc','#ffaa33','#33aaff'];
let regionColorIdx = 0;
export function nextRegionColor() { return REGION_COLORS[regionColorIdx++ % REGION_COLORS.length]; }

export function uid() { return Math.random().toString(36).slice(2, 10); }

export function fmt(sec) {
  if (sec == null || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export function extractYTId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
  return m ? m[1] : null;
}

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
