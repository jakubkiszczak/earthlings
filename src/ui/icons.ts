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
  get dash() { return ICON_DASH; },
};

/** łuk (ikona broni łowcy) i stos monet */
export const ICONS2 = {
  bow: icon((px) => {
    for (let y = 1; y <= 12; y++) {
      const t = (y - 6.5) / 5.5, x = Math.round(9 - (1 - t * t) * 5);
      px(x, y, Math.abs(t) > 0.8 ? '#6a4420' : '#a06a34'); px(x + 1, y, '#6a4420');
    }
    for (let y = 1; y <= 12; y++) px(10, y, '#e8e0d0');
    px(4, 6, '#3a2214'); px(4, 7, '#3a2214');
  }),
  gold: icon((px) => {
    const coin = (x: number, y: number) => { for (let i = 0; i < 4; i++) px(x + i, y, i === 0 ? '#fff0a0' : i === 3 ? '#a87820' : '#ecc460'); px(x + 1, y - 1, '#ffe080'); px(x + 2, y - 1, '#e8b840'); px(x + 1, y + 1, '#a87820'); px(x + 2, y + 1, '#8a6018'); };
    coin(3, 10); coin(7, 10); coin(5, 8); coin(4, 6); coin(8, 7);
  }),
};

/** ikona przedmiotu: z zestawu HUD (legacy) albo rysowana */
export function itemIcon(id: string, legacy: Record<string, string>): string {
  if (id.startsWith('bow')) return ICONS2.bow;
  const map: Record<string, string> = { sword: 'sword', shield: 'shield', helm: 'helm', armor: 'chest', boots: 'boots', ring: 'ring', gloves: 'gloves', amulet: 'amulet' };
  const k = Object.keys(map).find((p) => id.startsWith(p));
  return legacy[`icon_${map[k ?? 'sword']}`];
}

/** odskok: sylwetka z liniami ruchu */
export const ICON_DASH = icon((px) => {
  for (const [x, y] of [[8, 2], [9, 2], [8, 3], [9, 3]]) px(x, y, '#f0c49c');
  for (let y = 4; y <= 8; y++) { px(8, y, '#c8ccd6'); px(9, y, '#8a8e9a'); }
  px(7, 5, '#c8ccd6'); px(10, 6, '#8a8e9a'); px(6, 6, '#c8ccd6');
  px(7, 9, '#3e4460'); px(7, 10, '#3e4460'); px(10, 9, '#3e4460'); px(11, 10, '#3e4460');
  for (const [x, y] of [[1, 4], [2, 4], [3, 4], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [1, 8], [2, 8], [3, 8]]) px(x, y, '#9ad0ff');
});
