// Wilk w pikselach (36×24, profil w prawo; w lewo – lustro). Chód 4 klatki, oddech 2, atak 2, martwy.
import type { CharFrames, FrameData } from './chargen';

const W = 36, H = 24, AX = 18, AY = 22;
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const P: Record<string, RGB> = Object.fromEntries(Object.entries({
  f1: '#b8b8c0', f2: '#8a8a94', f3: '#62626c', f4: '#42424a', b1: '#d8d4cc', e: '#ffd040', n: '#1a1414', m: '#c03a3a', t: '#f4f0e8',
}).map(([k, v]) => [k, hex(v)]));

class Cv {
  readonly a = new Uint8ClampedArray(W * H * 4);
  px(x: number, y: number, c: string) {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
    const col = P[c], o = (yi * W + xi) * 4;
    this.a[o] = col[0]; this.a[o + 1] = col[1]; this.a[o + 2] = col[2]; this.a[o + 3] = 255;
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: string) {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) this.px(x, y, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, shade: (dx: number, dy: number) => string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, shade(dx, dy));
    }
  }
  /** ogon: linia z cieniem */
  line(x0: number, y0: number, x1: number, y1: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
    for (let q = 0; q <= n; q++) {
      const t = q / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      this.px(x, y, t < 0.3 ? 'f3' : 'f2');
      this.px(x, y + 1, 'f3');
    }
  }
  outline() {
    const al = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && this.a[(y * W + x) * 4 + 3] > 0;
    const add: number[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!al(x, y) && (al(x - 1, y) || al(x + 1, y) || al(x, y - 1) || al(x, y + 1))) add.push(y * W + x);
    for (const i of add) { this.a[i * 4] = 22; this.a[i * 4 + 1] = 15; this.a[i * 4 + 2] = 18; this.a[i * 4 + 3] = 255; }
  }
}

const body = (dx: number, dy: number) => (dy > 0.45 ? 'b1' : dy < -0.4 ? 'f1' : dx + dy * 0.6 > 0.5 ? 'f3' : 'f2');

function wolf(phase: number, breath: number, walking: boolean, atk: number): Uint8ClampedArray {
  const cv = new Cv();
  const by = breath ? 1 : 0;
  const lunge = atk === 2 ? 3 : atk === 1 ? -1 : 0;
  // ogon
  cv.line(6, 11 + by, 2, 6 + by);
  // nogi: przednie (x≈24) i tylne (x≈10), dalsze ciemniejsze
  const st = walking ? [2, 0, -2, 0][phase] : 0;
  const legs: [number, number, string][] = [[10 - st, 0, 'f4'], [25 + st + lunge, 0, 'f4'], [12 + st, 1, 'f3'], [23 - st + lunge, 1, 'f3']];
  for (const [x, near, c] of legs) {
    const lift = walking && ((near && st > 0) || (!near && st < 0)) ? 1 : 0;
    cv.rect(x, 14 + by, x + 1, 21 - lift, c);
    cv.rect(x - 0.4, 21 - lift, x + 2, 21 - lift, 'f4');
  }
  // tułów
  cv.ellipse(16 + lunge * 0.5, 12 + by, 10, 4.6, body);
  cv.ellipse(23 + lunge * 0.7, 10 + by, 4.5, 4.4, body);          // kark
  // głowa z pyskiem
  const hx = 27 + lunge, hy = 7 + by + (atk === 2 ? 2 : 0);
  cv.ellipse(hx, hy, 3.6, 3.2, body);
  cv.rect(hx + 2, hy, hx + 6, hy + 2, 'f2');
  cv.rect(hx + 2, hy + 2, hx + 6, hy + 2, 'f3');
  cv.px(hx + 6, hy, 'n');
  cv.px(hx + 1, hy - 1, 'e');
  // uszy
  cv.px(hx - 1, hy - 4, 'f2'); cv.px(hx - 1, hy - 3, 'f1'); cv.px(hx - 2, hy - 3, 'f2');
  cv.px(hx + 1, hy - 4, 'f3'); cv.px(hx + 1, hy - 3, 'f2');
  // otwarta paszcza przy ataku
  if (atk) { cv.rect(hx + 3, hy + 3, hx + 6, hy + 3, 'm'); cv.px(hx + 4, hy + 2, 't'); cv.px(hx + 6, hy + 3, 't'); cv.rect(hx + 2, hy + 4, hx + 5, hy + 4, 'f3'); }
  cv.outline();
  return cv.a;
}


const fd = (px: Uint8ClampedArray): FrameData => ({ w: W, h: H, ax: AX, ay: AY, px });

/** martwy wilk: na boku, nogi w bok */
function deadWolf(): FrameData {
  const cv = new Cv();
  cv.ellipse(17, 17, 11, 4, body);
  cv.ellipse(28, 17, 4, 3.4, body);
  cv.rect(31, 16, 34, 18, 'f2');
  cv.px(29, 16, 'n');
  for (const x of [9, 12, 21, 24]) cv.rect(x, 20, x + 1, 22, 'f3');
  cv.line(6, 18, 1, 19);
  cv.outline();
  return fd(cv.a);
}

export function wolfFrames(): CharFrames {
  const data = new Map<string, FrameData>();
  for (let k = 0; k < 4; k++) data.set(`wolf_E_walk${k}`, fd(wolf(k, k % 2, true, 0)));
  data.set('wolf_E_idle0', fd(wolf(0, 0, false, 0)));
  data.set('wolf_E_idle1', fd(wolf(0, 1, false, 0)));
  data.set('wolf_E_atk0', fd(wolf(0, 0, false, 1)));
  data.set('wolf_E_atk1', fd(wolf(0, 0, false, 2)));
  data.set('wolf_dead', deadWolf());
  return { names: [...data.keys()], data };
}
