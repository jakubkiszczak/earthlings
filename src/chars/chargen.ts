// Generator wyglądu postaci w pikselach (28×42, kotwica w środku stóp 14,41) – przeniesiony z tools/hero9.py
// i sparametryzowany: rasa, klasa (ubiór i broń), budowa ciała, włosy, broda.
// 5 kierunków (S, SE, E, NE, N; zachodnie to lustro), chód 4 klatki, oddech 2.
import type { Beard, Build, ClassId, Hair, Race } from '../logic/character';

export const CW = 28;
export const CH = 42;
export const ANCHOR: [number, number] = [14, 41];
export const DIRS = ['S', 'SE', 'E', 'NE', 'N'] as const;
export type Dir = (typeof DIRS)[number];
export const FRAMES = ['walk0', 'walk1', 'walk2', 'walk3', 'idle0', 'idle1'] as const;

export interface CharLook { race: Race; cls: ClassId; hair: Hair; build: Build; beard: Beard; kind?: 'skeleton' | 'zombie' }
export type Pose = 'none' | 'atk0' | 'atk1';

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const HAIR: Record<Exclude<Hair, 'bald'>, [string, string, string]> = {
  black: ['#4e444c', '#30282e', '#1a1418'],
  white: ['#fbfbf6', '#d4d8e0', '#9aa0b0'],
  blond: ['#f6dc84', '#dcb050', '#a8802c'],
  brown: ['#9a6438', '#704626', '#4a2c16'],
};

function palette(l: CharLook): Record<string, RGB> {
  const p: Record<string, string> = {
    w: '#f4f0e8', o: '#1a1414', m: '#a24e40', M: '#f0f0f0', Y: '#ecc460', K: '#3a2214', U: '#8a5a30',
    A: '#8a5230', a: '#5a3218', j: '#3a1e0e',
  };
  if (l.race === 'elf') Object.assign(p, { S: '#f6dcc0', s: '#dcb494', z: '#ae7e5c', i: '#3a9a5a' });
  else Object.assign(p, { S: '#f0c49c', s: '#c8906a', z: '#96603e', i: '#3a7aa0' });
  const hc = l.hair === 'bald' ? HAIR.brown : HAIR[l.hair];
  Object.assign(p, { H: hc[0], h: hc[1], g: hc[2], y: l.hair === 'white' ? '#b8bcc8' : hc[2] });
  if (l.cls === 'warrior') {
    Object.assign(p, {
      B: '#8a3a2a', b: '#6a2a1e', D: '#3e1810', c: '#d0a060',
      L: '#a8acb8', l: '#7a7e8a', n: '#4a4e5a', V: '#c8ccd6', v: '#8a8e9a',
      R: '#b0b4c0', r: '#80848e', x: '#50545e', P: '#3e4460', p: '#2a2e44', q: '#1c1e2e',
    });
  } else {
    Object.assign(p, {
      B: '#4e6e36', b: '#3a5428', D: '#22361a', c: '#c8b070',
      L: '#6a5236', l: '#4e3a24', n: '#30220f', V: '#7a4a28', v: '#4e2e18',
      R: '#3a5a2e', r: '#2a4220', x: '#1a2a14', P: '#5a4a36', p: '#44382a', q: '#2a2218',
    });
  }
  if (l.kind === 'skeleton') Object.assign(p, {
    S: '#e8e2cc', s: '#b8b09a', z: '#807860', i: '#ff3a2a', w: '#1a1414', m: '#1a1414',
    B: '#5a4a42', b: '#3e322c', D: '#24201c', c: '#8a7a60', L: '#e0dac4', l: '#a8a08a', n: '#6a6450',
    V: '#8a6a4a', v: '#5a4430', R: '#6a5a4e', r: '#4e4038', x: '#2e2620', P: '#d8d2bc', p: '#a8a08a', q: '#6a6450',
    A: '#c8c2ac', a: '#98907a', j: '#5a5444', Y: '#8a7a60', K: '#3e322c', U: '#5a4a42', M: '#c8c2ac',
  });
  if (l.kind === 'zombie') Object.assign(p, {
    S: '#9ab07a', s: '#6e8a56', z: '#4a6038', i: '#e8e05a', w: '#d8d8a0', m: '#5a2020',
    B: '#6a5a44', b: '#4e402e', D: '#30281c', c: '#8a7a5a', L: '#8aa06e', l: '#6e8a56', n: '#4a6038',
    V: '#6e8a56', v: '#4a6038', R: '#5a4a36', r: '#40342a', x: '#2a221a', P: '#4a4a5a', p: '#36364a', q: '#242434',
    A: '#4e402e', a: '#36301e', j: '#221c12', Y: '#6a5a44', M: '#8aa06e',
  });
  Object.assign(p, {
    // broń i tarcza
    E1: l.kind === 'skeleton' ? '#c8b898' : '#eef2f6', E2: l.kind === 'skeleton' ? '#8a7858' : '#a8b0bc', E3: '#6a7280', G1: '#e0b850', G2: '#9a7430',
    T1: '#a8382a', T2: '#7a2418', T3: '#c8ccd6', T4: '#e8d070', T5: '#6a4424',
    W1: '#a06a34', W2: '#6a4420', W3: '#e8e0d0', F1: '#e04a3a', F2: '#f4f0e8', Q1: '#7a4a24', Q2: '#4e2e14',
  });
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, hex(v)]));
}

class Cv {
  readonly a = new Uint8ClampedArray(CW * CH * 4);
  constructor(private readonly pal: Record<string, RGB>) {}
  px(x: number, y: number, c: string) {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= CW || yi >= CH || !c) return;
    const col = this.pal[c], o = (yi * CW + xi) * 4;
    this.a[o] = col[0]; this.a[o + 1] = col[1]; this.a[o + 2] = col[2]; this.a[o + 3] = 255;
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: string) {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) this.px(x, y, c);
  }
  shadeRect(x0: number, y0: number, x1: number, y1: number, lit: string, mid: string, dark: string) {
    const a = Math.round(x0), b = Math.round(x1), w = Math.max(1, b - a);
    for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = a; x <= b; x++) {
      const t = (x - a) / w;
      this.px(x, y, t < 0.3 ? lit : t < 0.75 ? mid : dark);
    }
  }
  disc(cx: number, cy: number, rx: number, ry: number, lit: string, mid: string, dark: string) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.floor(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.floor(cx + rx + 1); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const l = dx * 0.7 + dy * 0.7;
        this.px(x, y, l < -0.35 ? lit : l < 0.45 ? mid : dark);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, c2?: string) {
    const n = Math.floor(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
    for (let q = 0; q <= n; q++) {
      const t = q / Math.max(n, 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      this.px(x, y, c);
      if (c2) this.px(x + 1, y, c2);
    }
  }
  /** ciemny kontur 1 px wokół sylwetki */
  outline() {
    const al = (x: number, y: number) => x >= 0 && y >= 0 && x < CW && y < CH && this.a[(y * CW + x) * 4 + 3] > 0;
    const add: number[] = [];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (al(x, y)) continue;
      if (al(x - 1, y) || al(x + 1, y) || al(x, y - 1) || al(x, y + 1)) add.push(y * CW + x);
    }
    for (const i of add) { this.a[i * 4] = 22; this.a[i * 4 + 1] = 15; this.a[i * 4 + 2] = 18; this.a[i * 4 + 3] = 255; }
  }
}

const BUILD = {
  thin: { tw: 4.0, sep: 2.5, leg: 1.5 },
  normal: { tw: 5.0, sep: 3.0, leg: 1.5 },
  stocky: { tw: 6.2, sep: 3.5, leg: 2.0 },
};

function frame(l: CharLook, d: Dir, phase: number, breath: number, walking: boolean, pose: Pose = 'none'): Uint8ClampedArray {
  const cv = new Cv(palette(l));
  const back = d === 'N' || d === 'NE';
  const side = { S: 0, SE: 0.5, E: 1, NE: 0.5, N: 0 }[d];
  const stride = walking ? [1, 0, -1, 0][phase] : 0;
  const by = breath;
  const cx = 14;
  const hx = cx + (d === 'SE' || d === 'NE' ? 1 : d === 'E' ? 2 : 0);
  const B = BUILD[l.build];
  const tw = B.tw - side * 1.2;
  const t0 = 18 + by, t1 = 29;
  const sw = -stride;
  const zombie = l.kind === 'zombie';
  const warrior = l.cls === 'warrior' && !zombie;
  const shield = warrior && !l.kind;
  const hunter = l.cls === 'hunter' && !l.kind;

  // dłonie (pozycje do broni)
  const rightHand = side < 1 ? { x: cx + (tw + 1.3), y: t0 + 10 + sw * 0.9 } : { x: cx + 1 + sw * 1.6, y: t0 + 10 };
  if (pose === 'atk0') rightHand.y -= 6;
  if (pose === 'atk1') { rightHand.y -= 1; rightHand.x += 1; }
  const leftHand = { x: cx - (tw + 1.3), y: t0 + 10 - sw * 0.9 };

  const sword = () => {
    const h = rightHand;
    if (pose === 'atk0') {          // zamach: ostrze w górę i do tyłu
      cv.line(h.x, h.y - 1, h.x - 3, h.y - 14, 'E1', 'E2');
      cv.rect(h.x - 2, h.y, h.x + 2, h.y, 'G1');
      return;
    }
    if (pose === 'atk1') {          // cios: ostrze do przodu
      const fx = d === 'N' || d === 'NE' ? -1 : 1;
      cv.line(h.x + fx, h.y, h.x + fx * 12, h.y + 3, 'E1', 'E2');
      cv.rect(h.x, h.y - 2, h.x, h.y + 2, 'G1');
      return;
    }
    if (d === 'E') {
      cv.line(h.x + 1, h.y - 1, h.x + 6, h.y - 11, 'E1', 'E2');
      cv.rect(h.x - 1, h.y - 1, h.x + 2, h.y - 1, 'G1'); cv.px(h.x, h.y + 1, 'G2');
    } else {
      cv.line(h.x + 1, h.y - 1, h.x + 3, h.y - 13, 'E1', 'E2');
      cv.px(h.x + 3, h.y - 14, 'E3');
      cv.rect(h.x - 1, h.y - 1, h.x + 3, h.y - 1, 'G1'); cv.px(h.x + 1, h.y + 1, 'G2');
    }
  };
  const shieldFront = (x: number, y: number) => {
    cv.rect(x - 3, y - 4, x + 3, y + 3, 'T3');
    cv.rect(x - 2, y - 3, x + 2, y + 2, 'T1');
    cv.rect(x + 1, y - 3, x + 2, y + 2, 'T2');
    cv.rect(x - 1, y + 4, x + 1, y + 4, 'T3'); cv.px(x, y + 5, 'T3');
    cv.px(x, y - 1, 'T4'); cv.px(x - 1, y - 1, 'T4');
  };
  const shieldBack = (x: number, y: number) => {
    cv.rect(x - 3, y - 4, x + 3, y + 3, 'T5'); cv.rect(x - 3, y - 4, x + 3, y - 4, 'T3');
    cv.rect(x - 1, y + 4, x + 1, y + 4, 'T5'); cv.px(x, y - 1, 'D');
  };
  const bow = (x: number, y0: number, y1: number, dirx: number) => {
    const mid = (y0 + y1) / 2, len = y1 - y0;
    for (let y = y0; y <= y1; y++) {
      const t = (y - mid) / (len / 2);
      const bend = Math.round((1 - t * t) * 3) * dirx;
      cv.px(x + bend, y, Math.abs(t) > 0.85 ? 'W2' : 'W1');
    }
    cv.line(x, y0, x, y1, 'W3');
    cv.px(x + 3 * dirx, mid, 'K'); cv.px(x + 3 * dirx, mid + 1, 'K');
  };
  const quiverBack = (x: number) => {
    cv.rect(x, t0 - 1, x + 2, t0 + 9, 'Q1'); cv.rect(x + 2, t0 - 1, x + 2, t0 + 9, 'Q2');
    cv.px(x, t0 - 2, 'F1'); cv.px(x + 1, t0 - 3, 'F2'); cv.px(x + 2, t0 - 2, 'F1');
  };

  // broń z tyłu (widok od tyłu / profil)
  if (back) {
    if (warrior) sword(); else if (hunter) bow(leftHand.x - 1, t0 - 4, t0 + 14, -1);
  }
  if (d === 'E') {
    if (shield) shieldBack(cx - 3, t0 + 7);
  }

  // ---------------- nogi i buty
  if (side < 1) {
    const sep = B.sep - side;
    for (const sgn of [-1, 1]) {
      const lx = cx + sgn * sep;
      const lift = (stride > 0 && sgn < 0) || (stride < 0 && sgn > 0) ? 1 : 0;
      const dx = stride * sgn * 0.6 * side;
      cv.shadeRect(lx - B.leg + dx, 30, lx + B.leg + dx, 36 - lift, 'P', 'p', 'q');
      cv.shadeRect(lx - B.leg + dx, 37 - lift, lx + B.leg + dx, 40 - lift, 'A', 'a', 'j');
      cv.rect(lx - B.leg + dx, 37 - lift, lx + B.leg + dx, 37 - lift, 'A');
      cv.px(lx + dx, 38 - lift, 'Y');
      cv.rect(lx - B.leg + dx + (sgn > 0 ? 1 : -1), 41 - lift, lx + B.leg + dx, 41 - lift, 'j');
    }
  } else {
    for (const sgn of [1, -1]) {
      const dx = stride * sgn * 2.2, far = sgn > 0, up = dx > 0 ? 1 : 0;
      cv.rect(cx - B.leg + dx, 30, cx + B.leg + dx, 36 - up, far ? 'p' : 'P');
      if (!far) cv.rect(cx + 0.5 + dx, 30, cx + B.leg + dx, 36 - up, 'p');
      cv.rect(cx - B.leg + dx, 37 - up, cx + B.leg + 1 + dx, 40 - up, far ? 'a' : 'A');
      cv.rect(cx - B.leg + dx, 41 - up, cx + B.leg + 1.5 + dx, 41 - up, 'j');
      if (!far) cv.px(cx + dx, 38 - up, 'Y');
    }
  }

  // ---------------- tułów
  cv.shadeRect(cx - tw, t0, cx + tw, t1, 'B', 'B', 'b');
  cv.rect(cx - tw, t1, cx + tw, t1, 'D');
  for (let x = Math.floor(cx - tw) + 1; x < cx + tw; x += 2) cv.px(x, t1 - 1, 'c');
  if (!back) {
    if (side < 1) {
      for (let k = 0, y = t0 + 3; y < t1 - 2; y++, k++) cv.px(cx + (k % 2) - 0.5 + side, y, 'c');
    }
    if (hunter) cv.line(cx - tw + 1, t0, cx + tw - 1, t1 - 3, 'Q2');   // pas kołczanu przez pierś
  } else {
    cv.rect(cx - 1, t0 + 1, cx, t1 - 1, 'b');
  }
  cv.rect(cx - tw, 27 + by, cx + tw, 28 + by, 'K');
  if (!back) {
    const bx = cx + side * 2;
    cv.rect(bx - 1, 27 + by, bx, 28 + by, 'Y'); cv.px(bx - 1, 27 + by, 'w');
    cv.rect(cx + tw - 2, 28 + by, cx + tw, 31 + by, 'U'); cv.px(cx + tw - 1, 29 + by, 'Y');
  } else {
    cv.rect(cx - tw, 28 + by, cx - tw + 2, 31 + by, 'U');
  }
  // kołczan na plecach
  if (hunter) {
    if (d === 'N') quiverBack(cx + 1);
    else if (d === 'NE') quiverBack(cx - 2);
    else if (d === 'E') quiverBack(cx - tw - 2);
  }

  // ---------------- ramiona
  if (side < 1) {
    for (const sgn of [-1, 1]) {
      const ax = cx + sgn * (tw + 1.3), ay = sw * sgn * 0.9, lit = sgn < 0;
      cv.rect(ax - 1, t0 + 2 + ay * 0.4, ax + 1, t0 + 6 + ay * 0.7, lit ? 'L' : 'l');
      cv.px(ax + (lit ? 1 : -1), t0 + 3 + ay * 0.4, 'n');
      cv.rect(ax - 1, t0 + 7 + ay * 0.8, ax + 1, t0 + 9 + ay, lit ? 'V' : 'v');
      cv.px(ax, t0 + 8 + ay, 'M');
      cv.rect(ax - 1, t0 + 10 + ay, ax + 1, t0 + 11 + ay, lit ? 'S' : 's');
      cv.rect(ax - 1.5, t0, ax + 1.5, t0 + 1, lit ? 'V' : 'v');
      cv.px(ax, t0, 'M');
      if (shield && sgn < 0) cv.rect(ax - 2, t0 - 1, ax + 2, t0 + 1, 'V');   // naramiennik
    }
  } else {
    const ax = cx + 1 + sw * 1.6;
    cv.rect(ax - 1, t0 + 2, ax + 1, t0 + 6, 'L'); cv.px(ax + 1, t0 + 4, 'l');
    cv.rect(ax - 1, t0 + 7, ax + 1, t0 + 9, 'V'); cv.px(ax, t0 + 8, 'M');
    cv.rect(ax - 1, t0 + 10, ax + 1, t0 + 11, 'S'); cv.px(ax + 1, t0 + 11, 's');
    cv.rect(ax - 2, t0, ax + 2, t0 + 1, 'V'); cv.px(ax, t0, 'M');
  }

  // ---------------- kołnierz (kolczy kaptur u wojownika, chusta u łowcy)
  cv.rect(cx - tw + 0.5, 16 + by, cx + tw - 0.5, 17 + by, 'R');
  cv.rect(cx + tw - 2.5, 16 + by, cx + tw - 0.5, 17 + by, 'r');
  cv.px(cx - 1, 17 + by, 'r'); cv.px(cx + 2, 16 + by, 'x');

  // ---------------- głowa
  const hy = 10 + by;
  const bald = l.hair === 'bald';
  const [hH, hh, hg] = bald ? ['S', 's', 'z'] : ['H', 'h', 'g'];
  const beardC: [string, string, string] = bald ? ['h', 'g', 'g'] : ['h', 'g', 'g'];
  const elf = l.race === 'elf';
  const ear = (x: number, y: number, dirx: number) => {
    // ucho elfa: szpic do góry na zewnątrz
    cv.px(x, y + 1, 'S'); cv.px(x, y, 'S'); cv.px(x + dirx, y - 1, 'S'); cv.px(x + 2 * dirx, y - 2, 's'); cv.px(x, y + 2, 's');
  };
  if (back) {
    cv.disc(hx, hy, 5.6, 6.0, hH, hh, hg);
    if (!bald) {
      for (let k = -4; k <= 4; k += 2) cv.line(hx + k * 0.8, hy - 4, hx + k, hy + 4, 'h');
      cv.px(hx - 2, hy - 4, 'H'); cv.px(hx - 3, hy - 3, 'H');
      cv.rect(hx - 4, hy + 5, hx + 4, hy + 5, 'g');
      if (elf) cv.rect(hx - 3, hy + 5, hx + 3, hy + 8, 'h');      // dłuższe włosy elfa
    } else {
      cv.px(hx - 2, hy - 3, 'w');
    }
    if (d === 'NE') { cv.rect(hx + 4.5, hy, hx + 5.5, hy + 3, 's'); cv.px(hx + 5.5, hy + 1, 'z'); }
    if (elf) { if (d === 'N') { ear(hx - 6, hy, -1); ear(hx + 6, hy, 1); } else ear(hx + 6, hy, 1); }
  } else {
    cv.disc(hx, hy - 0.5, 5.6, 6.0, hH, hh, hg);
    const [fx0, fx1] = d === 'S' ? [hx - 3, hx + 3] : d === 'SE' ? [hx - 2, hx + 4] : [hx, hx + 5];
    cv.rect(fx0, hy - 1, fx1, hy + 4, 'S');
    cv.rect(fx1 - 1, hy - 1, fx1, hy + 3, 's');
    cv.rect(fx0, hy + 4, fx1, hy + 4, 's');
    if (!bald) {
      for (let x = Math.floor(fx0); x <= fx1; x++) cv.px(x, hy - 2, x % 2 ? 'H' : 'h');
      cv.px(fx0 + 1, hy - 1, 'h'); cv.px(fx1 - 1, hy - 1, 'g');
      if (elf && d !== 'E') { cv.rect(fx0 - 1, hy - 1, fx0 - 1, hy + 5, 'h'); cv.rect(fx1 + 1, hy - 1, fx1 + 1, hy + 4, 'g'); }
    } else {
      cv.px(hx - 2, hy - 4, 'w');
    }
    // twarz: brwi, oczy, nos, usta, broda
    const beard = (rows: [number, number, number][]) => {
      for (const [y, x0, x1] of rows) cv.rect(x0, y, x1, y, (y - hy) % 2 ? beardC[0] : beardC[1]);
    };
    if (d === 'S') {
      cv.px(hx - 2, hy, 'y'); cv.px(hx - 1, hy, 'y'); cv.px(hx + 1, hy, 'y'); cv.px(hx + 2, hy, 'y');
      cv.px(hx - 2, hy + 1, 'w'); cv.px(hx - 1, hy + 1, 'i'); cv.px(hx + 1, hy + 1, 'i'); cv.px(hx + 2, hy + 1, 'w');
      cv.px(hx, hy + 2, 's'); cv.px(hx, hy + 1, 'S');
      if (l.beard === 'short') { beard([[hy + 3, hx - 2, hx + 2], [hy + 4, hx - 2, hx + 2], [hy + 5, hx - 2, hx + 2], [hy + 6, hx - 1, hx + 1]]); cv.px(hx - 3, hy + 3, beardC[2]); cv.px(hx + 3, hy + 3, beardC[2]); cv.rect(hx - 1, hy + 3, hx + 1, hy + 3, 'm'); }
      else if (l.beard === 'long') { beard([[hy + 3, hx - 3, hx + 3], [hy + 4, hx - 3, hx + 3], [hy + 5, hx - 3, hx + 3], [hy + 6, hx - 2, hx + 2], [hy + 7, hx - 2, hx + 2], [hy + 8, hx - 1, hx + 1], [hy + 9, hx - 1, hx + 1], [hy + 10, hx, hx]]); cv.rect(hx - 1, hy + 3, hx + 1, hy + 3, 'm'); }
      else if (l.beard === 'mustache') { cv.rect(hx - 2, hy + 3, hx - 1, hy + 3, beardC[0]); cv.rect(hx + 1, hy + 3, hx + 2, hy + 3, beardC[1]); cv.px(hx - 3, hy + 4, beardC[1]); cv.px(hx + 3, hy + 4, beardC[2]); cv.rect(hx - 1, hy + 4, hx + 1, hy + 4, 'm'); }
      else cv.rect(hx - 1, hy + 3, hx + 1, hy + 3, 'm');
      if (elf) { ear(hx - 6, hy, -1); ear(hx + 6, hy, 1); }
    } else if (d === 'SE') {
      cv.px(hx - 1, hy, 'y'); cv.px(hx + 2, hy, 'y'); cv.px(hx + 3, hy, 'y');
      cv.px(hx - 1, hy + 1, 'i'); cv.px(hx + 2, hy + 1, 'w'); cv.px(hx + 3, hy + 1, 'i');
      cv.px(hx + 4, hy + 2, 's'); cv.px(hx + 1, hy + 2, 's');
      if (l.beard === 'short') { beard([[hy + 3, hx - 1, hx + 3], [hy + 4, hx - 1, hx + 3], [hy + 5, hx - 1, hx + 3], [hy + 6, hx, hx + 2]]); cv.px(hx + 4, hy + 3, beardC[2]); cv.rect(hx, hy + 3, hx + 2, hy + 3, 'm'); }
      else if (l.beard === 'long') { beard([[hy + 3, hx - 2, hx + 4], [hy + 4, hx - 2, hx + 4], [hy + 5, hx - 1, hx + 3], [hy + 6, hx - 1, hx + 3], [hy + 7, hx, hx + 2], [hy + 8, hx, hx + 2], [hy + 9, hx + 1, hx + 1]]); cv.rect(hx, hy + 3, hx + 2, hy + 3, 'm'); }
      else if (l.beard === 'mustache') { cv.rect(hx - 1, hy + 3, hx + 3, hy + 3, beardC[0]); cv.px(hx - 1, hy + 4, beardC[1]); cv.px(hx + 3, hy + 4, beardC[2]); cv.rect(hx, hy + 4, hx + 2, hy + 4, 'm'); }
      else cv.rect(hx, hy + 3, hx + 2, hy + 3, 'm');
      if (elf) ear(hx - 3, hy, -1); else cv.px(hx - 2, hy + 1, 'z');
    } else {
      cv.px(hx + 3, hy, 'y'); cv.px(hx + 4, hy, 'y');
      cv.px(hx + 3, hy + 1, 'w'); cv.px(hx + 4, hy + 1, 'i');
      cv.px(hx + 6, hy + 2, 'S'); cv.px(hx + 6, hy + 1, 's');
      if (l.beard === 'short') { beard([[hy + 3, hx + 2, hx + 5], [hy + 4, hx + 2, hx + 5], [hy + 5, hx + 2, hx + 5]]); cv.px(hx + 5, hy + 3, 'm'); cv.px(hx + 4, hy + 3, 'm'); }
      else if (l.beard === 'long') { beard([[hy + 3, hx + 1, hx + 6], [hy + 4, hx + 1, hx + 6], [hy + 5, hx + 2, hx + 5], [hy + 6, hx + 2, hx + 5], [hy + 7, hx + 3, hx + 5], [hy + 8, hx + 3, hx + 4]]); cv.px(hx + 5, hy + 3, 'm'); }
      else if (l.beard === 'mustache') { cv.rect(hx + 3, hy + 3, hx + 6, hy + 3, beardC[0]); cv.px(hx + 5, hy + 4, 'm'); }
      else cv.px(hx + 5, hy + 3, 'm');
      if (elf) ear(hx + 1, hy, -1); else { cv.px(hx + 1, hy + 1, 'z'); cv.px(hx + 1, hy + 2, 's'); }
      if (!bald) { cv.rect(hx - 4, hy - 1, hx - 1, hy + 5, 'h'); cv.rect(hx - 4, hy + 3, hx - 2, hy + 5, 'g'); if (elf) cv.rect(hx - 4, hy + 5, hx - 2, hy + 8, 'h'); }
    }
  }

  // broń z przodu
  if (!back) {
    if (warrior) {
      sword();
      if (shield && (d === 'S' || d === 'SE')) shieldFront(leftHand.x - 1, leftHand.y - 3);
    } else if (hunter) {
      if (pose !== 'none') {
        // naciągnięty łuk przed sobą (atk0), po strzale (atk1)
        const bx = d === 'E' ? cx + 7 : cx + tw + 3;
        bow(bx, t0 - 2, t0 + 14, 1);
        const pull = pose === 'atk0' ? 3 : 0;
        cv.line(bx, t0 - 2, bx - pull, t0 + 6, 'W3'); cv.line(bx - pull, t0 + 6, bx, t0 + 14, 'W3');
        if (pose === 'atk0') { cv.line(bx - pull, t0 + 6, bx + 6, t0 + 6, 'Q1'); cv.px(bx + 7, t0 + 6, 'E2'); }
      } else if (d === 'E') bow(cx + 6 + sw, t0 - 3, t0 + 15, 1);
      else bow(leftHand.x - 1, t0 - 4, t0 + 14, -1);
      if (d === 'S' || d === 'SE') { cv.px(cx + tw - 1, t0 - 2, 'F1'); cv.px(cx + tw, t0 - 3, 'F2'); cv.px(cx + tw + 1, t0 - 2, 'F1'); }
    } else if (zombie && pose !== 'none') {
      // zombie: wyciągnięte ręce
      const reach = pose === 'atk1' ? 5 : 2;
      const fx = d === 'E' ? 1 : 0;
      for (const sgn of d === 'E' ? [0] : [-1, 1]) {
        const x0 = cx + sgn * 3 + fx * 3;
        cv.rect(x0 - 1, t0 + 3, x0 + 1 + fx * reach, t0 + 3 + (fx ? 2 : reach + 4), sgn < 0 ? 'L' : 'l');
        cv.rect(x0 - 1 + fx * reach, t0 + 4 + (fx ? 0 : reach + 4), x0 + 1 + fx * reach, t0 + 5 + (fx ? 0 : reach + 4), 'S');
      }
    }
  } else if (shield) {
    shieldBack(leftHand.x - 1, leftHand.y - 3);
  }
  cv.outline();
  return cv.a;
}

export interface FrameData { w: number; h: number; ax: number; ay: number; px: Uint8ClampedArray }
export interface CharFrames { names: string[]; data: Map<string, FrameData> }

const std = (px: Uint8ClampedArray): FrameData => ({ w: CW, h: CH, ax: ANCHOR[0], ay: ANCHOR[1], px });

/** klatka „martwy”: klatka obrócona o 90° (leży na boku), kotwica pod środkiem */
export function lying(src: FrameData): FrameData {
  const w = src.h, h = src.w, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const nx = src.h - 1 - y, ny = x, o = (y * src.w + x) * 4, n = (ny * w + nx) * 4;
    px[n] = src.px[o]; px[n + 1] = src.px[o + 1]; px[n + 2] = src.px[o + 2]; px[n + 3] = src.px[o + 3];
  }
  return { w, h, ax: Math.floor(w / 2), ay: h - 3, px };
}

/** wszystkie klatki postaci: <prefix>_<dir>_<frame>, ataki atk0/atk1 i <prefix>_dead */
export function generateFrames(look: CharLook, prefix = 'hero'): CharFrames {
  const data = new Map<string, FrameData>();
  for (const d of DIRS) {
    for (let k = 0; k < 4; k++) data.set(`${prefix}_${d}_walk${k}`, std(frame(look, d, k, k % 2, true)));
    data.set(`${prefix}_${d}_idle0`, std(frame(look, d, 0, 0, false)));
    data.set(`${prefix}_${d}_idle1`, std(frame(look, d, 0, 1, false)));
    data.set(`${prefix}_${d}_atk0`, std(frame(look, d, 0, 0, false, 'atk0')));
    data.set(`${prefix}_${d}_atk1`, std(frame(look, d, 0, 0, false, 'atk1')));
  }
  data.set(`${prefix}_dead`, lying(data.get(`${prefix}_E_idle0`)!));
  return { names: [...data.keys()], data };
}
