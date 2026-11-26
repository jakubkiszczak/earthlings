// Minimapa 3×3 w rogu ekranu: komórki jako romby (jak widok izometryczny), bieżąca podświetlona, kropka gracza.
// Rysowana w pikselach natywnych i skalowana całkowicie (pixel art).
import type { WorldInfo } from '../types';

const CW = 12, CH = 6;              // pół-szerokość i pół-wysokość rombu komórki
const PAD = 3;

const BIOME_COLOR: Record<string, [number, number, number]> = {
  town: [168, 142, 104], meadow: [104, 176, 60], forest: [44, 116, 50], hills: [122, 140, 76], river: [64, 140, 150],
  ruins: [128, 120, 108], darkforest: [30, 72, 44], cemetery: [92, 96, 76], crags: [120, 104, 88],
};

export function createMinimap(host: HTMLElement, world: WorldInfo) {
  const G = world.grid;
  const w = 2 * CW * G + 2 * PAD, h = 2 * CH * G + 2 * PAD;
  const box = document.createElement('div');
  box.className = 'minimap panel9';
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.className = 'px';
  const label = document.createElement('div');
  label.className = 'mmlabel';
  box.append(canvas, label);
  host.append(box);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const cx0 = w / 2;                 // górny róg rombu świata

  const biomeAt = new Map(world.cells.map((c) => [`${c.cx},${c.cy}`, c.biome]));
  let cur = { cx: 0, cy: 0, gu: 0, gv: 0 };
  let blink = 0;

  function draw() {
    const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      // piksel → globalne (gu, gv) w jednostkach komórek
      const a = (x + 0.5 - cx0) / CW, b = (y + 0.5 - PAD) / CH;
      const gu = (b + a) / 2, gv = (b - a) / 2;
      if (gu < 0 || gv < 0 || gu >= G || gv >= G) { d[o + 3] = 0; continue; }
      const ci = Math.floor(gu), cj = Math.floor(gv);
      let c = BIOME_COLOR[biomeAt.get(`${ci},${cj}`) ?? 'meadow'] ?? [90, 90, 90];
      const fu = gu - ci, fv = gv - cj;
      const border = fu < 0.06 || fv < 0.06 || fu > 0.94 || fv > 0.94;
      const here = ci === cur.cx && cj === cur.cy;
      if (border) c = here ? [242, 210, 122] : [20, 16, 18];
      else if (!here) c = [c[0] * 0.62, c[1] * 0.62, c[2] * 0.62];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    // gracz: kropka 2×2, miga
    if (blink % 2 === 0) {
      const px = Math.round(cx0 + (cur.gu - cur.gv) * CW), py = Math.round(PAD + (cur.gu + cur.gv) * CH);
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const o = (y * w + x) * 4;
        d[o] = 255; d[o + 1] = 255; d[o + 2] = 240; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let s = 0;
  function layout() {
    s = innerHeight >= 860 && innerWidth >= 1250 ? 3 : 2;
    canvas.style.width = w * s + 'px';
    canvas.style.height = h * s + 'px';
    box.style.right = 12 * s + 'px';
    box.style.top = 12 * s + 'px';
  }
  layout();
  addEventListener('resize', layout);

  let acc = 0;
  return {
    /** bieżąca komórka i pozycja gracza w niej (0..1) */
    set(cx: number, cy: number, fu: number, fv: number, name: string) {
      const changed = cx !== cur.cx || cy !== cur.cy;
      cur = { cx, cy, gu: cx + fu, gv: cy + fv };
      if (changed || !label.textContent) { label.textContent = name; draw(); }
    },
    update(dt: number) {
      acc += dt;
      if (acc > 0.25) { acc = 0; blink++; draw(); }
    },
  };
}
