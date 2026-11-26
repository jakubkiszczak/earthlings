// Woda animowana na CPU, w siatce pikseli świata (dane z water_a.png i water_b.png).
// Płótno obejmuje tylko prostokąt z wodą, więc komórki bez wody nic nie kosztują.
import { CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import { readPixels } from '../assets';

const fr = (v: number) => v - Math.floor(v);

/** W×H – rozmiar obrazu komórki, WA – paleta wody, BY – macierz Bayera */
export function createWater(W: number, H: number, WA: [number, number, number][], BY: number[][], imgA: HTMLImageElement, imgB: HTMLImageElement) {
  const A = readPixels(imgA), B = readPixels(imgB);
  const idx: number[] = [];
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < W * H; i++) {
    if (A[i * 4] === 0) continue;
    idx.push(i);
    const x = i % W, y = (i / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const N = idx.length;
  const view = new Container();
  if (!N) return { sprite: view, destroy() { view.destroy(); }, update() { /* brak wody */ } };

  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext('2d')!;
  const out = ctx.createImageData(bw, bh);
  const px = new Int32Array(N), py = new Int32Array(N);
  const base = new Float32Array(N), f1 = new Float32Array(N), f2 = new Float32Array(N), q = new Float32Array(N);
  idx.forEach((p, k) => {
    px[k] = p % W;
    py[k] = (p / W) | 0;
    base[k] = (A[p * 4] - 1) / 18;
    f1[k] = A[p * 4 + 1] / 255;
    f2[k] = A[p * 4 + 2] / 255;
    q[k] = B[p * 4] / 20 - 4;
  });
  const source = new CanvasSource({ resource: canvas, scaleMode: 'nearest' });
  const sprite = new Sprite(new Texture({ source }));
  sprite.position.set(x0, y0);
  view.addChild(sprite);

  function draw(t: number) {
    const d = out.data;
    const step = Math.floor(t * 6);
    for (let k = 0; k < N; k++) {
      const x = px[k], y = py[k];
      let v = base[k];
      if (Math.abs(fr(f2[k] * 2 + t * 0.04) - 0.5) < 0.06) v -= 1;
      if (Math.abs(fr(f2[k] * 3 - t * 0.07) - 0.5) < 0.03) v += 1;
      if (Math.abs(fr(f1[k] * 4 + t * 0.1) - 0.5) < 0.035) v += 2;
      if (q[k] < 0.7 * Math.sin(t * 1.6 + x * 0.13 + y * 0.07) + 0.45) v = 7.3 + ((x + y + step) & 1);
      v += BY[y & 3][x & 3] - 0.47;
      const i = Math.max(0, Math.min(8, Math.round(v)));
      const c = WA[i], o = ((y - y0) * bw + (x - x0)) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    source.update();
  }
  draw(0);

  // woda odświeżana 10× na sekundę (pikselowy styl, oszczędność CPU)
  let acc = 0;
  return {
    sprite: view as Container,
    destroy() { view.destroy({ children: true, texture: true, textureSource: true }); },
    update(t: number, dt: number) {
      acc += dt;
      if (acc > 0.1) { draw(t); acc = 0; }
    },
  };
}
