// Cienie chmur: szum wartości z ditheringiem Bayera, mieszanie multiply, przesuwane w czasie.
import { CanvasSource, Texture, TilingSprite } from 'pixi.js';

const SIZE = 512;

export function createClouds(width: number, height: number, bayer: number[][]) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  const rnd = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const sm = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number, sc: number) => {
    const n = SIZE / sc, wrap = (a: number) => ((a % n) + n) % n;
    const i = Math.floor(x / sc), j = Math.floor(y / sc), fx = sm(x / sc - i), fy = sm(y / sc - j);
    const p = (a: number, b: number) => rnd(wrap(a), wrap(b));
    const a = p(i, j), b = p(i + 1, j), cc = p(i, j + 1), d = p(i + 1, j + 1);
    return a + (b - a) * fx + (cc - a) * fy + (a - b - cc + d) * fx * fy;
  };
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const n = noise(x, y, 128) * 0.6 + noise(x, y, 64) * 0.3 + noise(x, y, 32) * 0.1;
    const th = 0.62 + (bayer[y & 3][x & 3] - 0.47) * 0.06;
    const o = (y * SIZE + x) * 4, shade = n > th;
    img.data[o] = shade ? 196 : 255;
    img.data[o + 1] = shade ? 206 : 255;
    img.data[o + 2] = shade ? 228 : 255;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const sprite = new TilingSprite({
    texture: new Texture({ source: new CanvasSource({ resource: c, scaleMode: 'nearest' }) }),
    width,
    height,
  });
  sprite.blendMode = 'multiply';
  return {
    sprite,
    resize(w: number, h: number) { sprite.width = w; sprite.height = h; },
    /** (ox, oy) – przesunięcie układu po zmianie komórki, żeby cienie chmur nie skakały */
    update(t: number, ox = 0, oy = 0) {
      sprite.tilePosition.set((Math.round(t * 5 + ox) % SIZE + SIZE) % SIZE, (Math.round(t * 2.5 + oy) % SIZE + SIZE) % SIZE);
    },
  };
}
