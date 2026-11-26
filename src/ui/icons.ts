// Ikony 14×14 rysowane kodem (pixel art) dla umiejętności łowcy i strzał – jako data URL do <img>.
const S = 14;

function icon(draw: (px: (x: number, y: number, c: string) => void) => void): string {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const px = (x: number, y: number, col: string) => { if (x >= 0 && y >= 0 && x < S && y < S) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } };
  draw(px);
  // kontur
  const d = ctx.getImageData(0, 0, S, S), a = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && d.data[(y * S + x) * 4 + 3] > 0;
  ctx.fillStyle = '#140e12';
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) ctx.fillRect(x, y, 1, 1);
  return c.toDataURL();
}

/** strzała po skosie od (x, y) w górę-prawo, długość n */
function arrow(px: (x: number, y: number, c: string) => void, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) px(x + i, y - i, i < 2 ? '#e8e0d0' : '#a06a34');
  px(x + n, y - n, '#e8ecf0'); px(x + n - 1, y - n, '#a8b0bc'); px(x + n, y - n + 1, '#a8b0bc');
  px(x - 1, y, '#e04a3a'); px(x, y + 1, '#e04a3a'); px(x - 1, y + 1, '#f4f0e8');
}

export const ICONS = {
  double: icon((px) => { arrow(px, 2, 8, 8); arrow(px, 4, 11, 8); }),
  push: icon((px) => {
    arrow(px, 1, 12, 7);
    for (const [x, y] of [[10, 2], [11, 3], [12, 4], [9, 1], [12, 1], [13, 2]]) px(x, y, '#ffd84a');
    px(11, 1, '#fff6c0');
  }),
  arrows: icon((px) => { arrow(px, 2, 11, 9); arrow(px, 4, 12, 8); arrow(px, 1, 9, 8); }),
};
