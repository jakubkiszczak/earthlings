// Woda animowana na CPU, w siatce pikseli świata (dane z water_a.png i water_b.png).
import { CanvasSource, Sprite, Texture } from 'pixi.js';
import { readPixels } from '../assets';
import type { WorldMeta } from '../types';

const fr = (v: number) => v - Math.floor(v);

export function createWater(M: WorldMeta, imgA: HTMLImageElement, imgB: HTMLImageElement) {
  const { W, H, WA, BAYER: BY } = M;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const out = ctx.createImageData(W, H);
  const A = readPixels(imgA), B = readPixels(imgB);
  const idx: number[] = [];
  for (let i = 0; i < W * H; i++) if (A[i * 4] > 0) idx.push(i);
  const N = idx.length;
  const base = new Float32Array(N), f1 = new Float32Array(N), f2 = new Float32Array(N), q = new Float32Array(N);
  idx.forEach((p, k) => {
    base[k] = (A[p * 4] - 1) / 18;
    f1[k] = A[p * 4 + 1] / 255;
    f2[k] = A[p * 4 + 2] / 255;
    q[k] = B[p * 4] / 20 - 4;
  });
  const source = new CanvasSource({ resource: canvas, scaleMode: 'nearest' });
  const sprite = new Sprite(new Texture({ source }));

  function draw(t: number) {
    const d = out.data;
    const step = Math.floor(t * 6);
    for (let k = 0; k < N; k++) {
      const p = idx[k], x = p % W, y = (p / W) | 0;
      let v = base[k];
      if (Math.abs(fr(f2[k] * 2 + t * 0.04) - 0.5) < 0.06) v -= 1;
      if (Math.abs(fr(f2[k] * 3 - t * 0.07) - 0.5) < 0.03) v += 1;
      if (Math.abs(fr(f1[k] * 4 + t * 0.1) - 0.5) < 0.035) v += 2;
      if (q[k] < 0.7 * Math.sin(t * 1.6 + x * 0.13 + y * 0.07) + 0.45) v = 7.3 + ((x + y + step) & 1);
      v += BY[y & 3][x & 3] - 0.47;
      const i = Math.max(0, Math.min(8, Math.round(v)));
      const c = WA[i], o = p * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    source.update();
  }
  draw(0);

  // woda odświeżana 10× na sekundę (pikselowy styl, oszczędność CPU)
  let acc = 0;
  return {
    sprite,
    update(t: number, dt: number) {
      acc += dt;
      if (acc > 0.1) { draw(t); acc = 0; }
    },
  };
}
