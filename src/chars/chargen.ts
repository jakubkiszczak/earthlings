// Generator wyglądu postaci w pikselach – sparametryzowany: rasa, klasa (ubiór i broń), budowa ciała, włosy, broda, ekwipunek.
// Kształty opisane są w jednostkach projektu 28×42, a rysowane w skali K = 1,5 (42×63 px), potem przebiegi detali:
// faktura i fałdy materiału, odblaski metalu, pasma włosów, wewnętrzne kontury.
// 5 kierunków (S, SE, E, NE, N; zachodnie to lustro), chód 4 klatki, oddech 2.
import type { Beard, Build, ClassId, Hair, Race } from '../logic/character';

/** skala rysowania względem siatki projektu */
export const K = 1.5;
const DW = 28, DH = 42;                       // siatka projektu
export const CW = Math.round(DW * K);         // 42
export const CH = Math.round(DH * K);         // 63
export const ANCHOR: [number, number] = [Math.round(14 * K), CH - 1];
export const DIRS = ['S', 'SE', 'E', 'NE', 'N'] as const;
export type Dir = (typeof DIRS)[number];
export const FRAMES = ['walk0', 'walk1', 'walk2', 'walk3', 'idle0', 'idle1'] as const;

/** widoczny ekwipunek: poziom przedmiotu (0 = brak) */
export interface Gear { weapon: number; shield: number; armor: number; helm: number; boots: number; gloves: number }
export const START_GEAR: Gear = { weapon: 1, shield: 0, armor: 0, helm: 0, boots: 0, gloves: 0 };
export interface CharLook { race: Race; cls: ClassId; hair: Hair; build: Build; beard: Beard; kind?: 'skeleton' | 'zombie' | 'woman' | 'elder'; gear?: Gear }
export type Pose = 'none' | 'atk0' | 'atk1';

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const HAIR: Record<Exclude<Hair, 'bald'>, [string, string, string]> = {
  black: ['#4e444c', '#30282e', '#1a1418'],
  white: ['#fbfbf6', '#d4d8e0', '#9aa0b0'],
  blond: ['#f6dc84', '#dcb050', '#a8802c'],
  brown: ['#9a6438', '#704626', '#4a2c16'],
};

function palette(l: CharLook, glow = false): Record<string, RGB> {
  const p: Record<string, string> = {
    w: '#f4f0e8', o: '#1a1414', m: '#a24e40', M: '#f0f0f0', Y: '#ecc460', K: '#3a2214', U: '#8a5a30',
    A: '#8a5230', a: '#5a3218', j: '#3a1e0e',
  };
  if (l.race === 'elf') Object.assign(p, { S: '#f6dcc0', s: '#dcb494', z: '#ae7e5c', i: '#3a9a5a', BL: '#f0aa94', o: '#1a2a1a' });
  else Object.assign(p, { S: '#f0c49c', s: '#c8906a', z: '#96603e', i: '#3a7aa0', BL: '#e8947c' });
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
  if (l.kind === 'skeleton' || l.kind === 'zombie') Object.assign(p, { BL: l.kind === 'zombie' ? '#7a9060' : '#b8b09a' });
  // mieszkańcy: młoda kobieta w sukni, dziadek w starych szatach
  if (l.kind === 'woman') Object.assign(p, {
    B: '#8a3a6a', b: '#6a2a52', D: '#3e1830', c: '#f2d27a', L: '#f4ecd8', l: '#d8ccb0', n: '#a89878', V: '#f4ecd8', v: '#d8ccb0',
    R: '#f4ecd8', r: '#d8ccb0', x: '#a89878', P: '#8a3a6a', p: '#6a2a52', q: '#3e1830', K: '#5a2a1a', Y: '#e8c050', U: '#c8a060',
    H: '#d46a3a', h: '#a84a28', g: '#6e2c16', y: '#7a3418', BL: '#f09080', M: '#f4ecd8', A: '#5a3418', a: '#3e2410', j: '#24140a',
  });
  if (l.kind === 'elder') Object.assign(p, {
    B: '#6a5a48', b: '#4e4234', D: '#2e261c', c: '#a89068', L: '#6a5a48', l: '#4e4234', n: '#2e261c', V: '#6a5a48', v: '#4e4234',
    R: '#8a7a5a', r: '#6a5a40', x: '#40342a', P: '#5a4c3c', p: '#40362a', q: '#2a2218', K: '#a08050', Y: '#c8a060', U: '#7a6040',
    H: '#f4f4f0', h: '#d0d4dc', g: '#9aa0b0', y: '#c8ccd4', S: '#e4b490', s: '#bc8a66', z: '#8a5c3e', BL: '#d88a76', M: '#a89068',
    A: '#4e3a24', a: '#36281a', j: '#20160c',
  });
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
  const g = l.gear ?? START_GEAR;
  // zbroja: skórznia, kolczuga, płyta
  if (!l.kind && g.armor === 1) Object.assign(p, { B: '#8a5a30', b: '#6a4222', D: '#3e2410', c: '#c8a060' });
  if (!l.kind && g.armor === 2) Object.assign(p, { B: '#9aa0aa', b: '#6e747e', D: '#40444c', c: '#d8dce4', L: '#8a909a', l: '#62686e', n: '#3a3e44' });
  if (!l.kind && g.armor === 3) Object.assign(p, { B: '#c8ccd6', b: '#8e94a0', D: '#555a66', c: '#e8c050', L: '#b0b6c0', l: '#7e848e', n: '#4a4e58', V: '#e8c050', v: '#a8842c' });
  if (!l.kind && g.boots === 1) Object.assign(p, { A: '#a0703c', a: '#704a24', j: '#40280e' });
  if (!l.kind && g.boots === 2) Object.assign(p, { A: '#6a7a44', a: '#4a5630', j: '#28301a' });
  // dłonie: skóra albo rękawice
  Object.assign(p, g.gloves && !l.kind ? { X1: '#8a5a2a', X2: '#5a3818' } : { X1: p.S, X2: p.s });
  // hełm: kaptur, żelazny, Świtu
  const HELM: Record<number, string[]> = {
    1: ['#9a6a3a', '#7a4e28', '#4e3018', '#5e3a1c'], 2: ['#b0b4be', '#80848e', '#50545e', '#3a3e46'], 3: ['#e0e4ec', '#a8aeb8', '#6a707c', '#e8c050'],
  };
  const hm = HELM[g.helm] ?? HELM[1];
  Object.assign(p, { H1: hm[0], H2: hm[1], H3: hm[2], H4: hm[3] });
  // tarcza: drewniana, okuta, Wieży
  const SH: Record<number, string[]> = {
    1: ['#a06a34', '#6a4420', '#4a3018', '#c8a060'], 2: ['#a8382a', '#7a2418', '#c8ccd6', '#e8d070'], 3: ['#3a6ac8', '#2a4a96', '#e8c050', '#fff0a0'],
  };
  const sh = SH[g.shield] ?? SH[2];
  // broń: kolor ostrza / drewna łuku wg poziomu
  const blade = l.kind === 'skeleton' ? ['#c8b898', '#8a7858'] : g.weapon === 3 ? ['#fff0a0', '#e8c050'] : g.weapon === 2 ? ['#ffffff', '#b8c0cc'] : ['#eef2f6', '#a8b0bc'];
  const wood = g.weapon === 3 ? ['#e8d8a0', '#a89060'] : g.weapon === 2 ? ['#8a3a2a', '#5a2418'] : ['#a06a34', '#6a4420'];
  Object.assign(p, {
    // broń i tarcza
    E1: blade[0], E2: blade[1], E3: '#6a7280', G1: g.weapon === 3 ? '#8af0ff' : '#e0b850', G2: '#9a7430',
    T1: sh[0], T2: sh[1], T3: sh[2], T4: sh[3], T5: '#6a4424',
    W1: wood[0], W2: wood[1], W3: '#e8e0d0', F1: '#e04a3a', F2: '#f4f0e8', Q1: '#7a4a24', Q2: '#4e2e14',
  });
  // podświetlenie broni przy umiejętności: żółta poświata
  if (glow) Object.assign(p, { E1: '#fffbd0', E2: '#ffe060', E3: '#ffd030', G1: '#fff6a0', G2: '#ffd84a', W1: '#ffe680', W2: '#e8b830', W3: '#fffbd0' });
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, hex(v)]));
}

// grupy materiałów do przebiegów detali
const CLOTH = new Set(['B', 'b', 'D', 'P', 'p', 'q', 'L', 'l', 'n', 'R', 'r', 'x']);
const METAL = new Set(['V', 'v', 'E1', 'E2', 'T3', 'H1', 'H2', 'M']);
const HAIRK = new Set(['H', 'h', 'g']);
const SKINK = new Set(['S', 's', 'z', 'X1', 'X2', 'BL']);
const group = (k: string) => (SKINK.has(k) ? 1 : HAIRK.has(k) ? 2 : METAL.has(k) ? 3 : CLOTH.has(k) ? 4 : 5);

class Cv {
  readonly a = new Uint8ClampedArray(CW * CH * 4);
  /** klucz palety każdego piksela (do przebiegów detali) */
  private readonly keys: string[] = new Array(CW * CH).fill('');
  constructor(private readonly pal: Record<string, RGB>) {}
  private set(X: number, Y: number, c: string) {
    if (X < 0 || Y < 0 || X >= CW || Y >= CH || !c) return;
    const col = this.pal[c], i = Y * CW + X, o = i * 4;
    this.a[o] = col[0]; this.a[o + 1] = col[1]; this.a[o + 2] = col[2]; this.a[o + 3] = 255;
    this.keys[i] = c;
  }
  /** piksel w wysokiej rozdzielczości (współrzędne docelowe) */
  hp(X: number, Y: number, c: string) { this.set(Math.round(X), Math.round(Y), c); }
  /** piksele wysokiej rozdzielczości, których środki leżą w [a·K, b·K) */
  private span(a: number, b: number): [number, number] { return [Math.ceil(a * K - 0.5), Math.ceil(b * K - 0.5) - 1]; }
  /** piksel projektu = blok 1–2 px */
  px(x: number, y: number, c: string) {
    const xi = Math.round(x), yi = Math.round(y);
    const [X0, X1] = this.span(xi, xi + 1), [Y0, Y1] = this.span(yi, yi + 1);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) this.set(X, Y, c);
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: string) {
    const [X0, X1] = this.span(Math.round(x0), Math.round(x1) + 1), [Y0, Y1] = this.span(Math.round(y0), Math.round(y1) + 1);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) this.set(X, Y, c);
  }
  shadeRect(x0: number, y0: number, x1: number, y1: number, lit: string, mid: string, dark: string) {
    const [X0, X1] = this.span(Math.round(x0), Math.round(x1) + 1), [Y0, Y1] = this.span(Math.round(y0), Math.round(y1) + 1);
    const w = Math.max(1, X1 - X0);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
      const t = (X - X0) / w;
      this.set(X, Y, t < 0.3 ? lit : t < 0.75 ? mid : dark);
    }
  }
  /** elipsa liczona w wysokiej rozdzielczości (gładsze krawędzie i cieniowanie) */
  disc(cx: number, cy: number, rx: number, ry: number, lit: string, mid: string, dark: string) {
    const [X0, X1] = this.span(cx - rx - 1, cx + rx + 2), [Y0, Y1] = this.span(cy - ry - 1, cy + ry + 2);
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
      const xd = (X + 0.5) / K - 0.5, yd = (Y + 0.5) / K - 0.5;
      const dx = (xd - cx) / rx, dy = (yd - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const l = dx * 0.7 + dy * 0.7;
        this.set(X, Y, l < -0.35 ? lit : l < 0.45 ? mid : dark);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, c2?: string) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * K) + 1;
    for (let q = 0; q <= n; q++) {
      const t = q / Math.max(n, 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const X = Math.round((x + 0.5) * K - 0.5), Y = Math.round((y + 0.5) * K - 0.5);
      this.set(X, Y, c); this.set(X + 1, Y, c2 ?? c);
      if (c2) this.set(X + 2, Y, c2);
    }
  }
  /** przebiegi detali: faktura materiału, fałdy, odblaski metalu, pasma włosów, wewnętrzne kontury */
  details() {
    const k = this.keys, a = this.a;
    const mul = (i: number, f: number, add = 0) => { const o = i * 4; a[o] = Math.min(255, a[o] * f + add); a[o + 1] = Math.min(255, a[o + 1] * f + add); a[o + 2] = Math.min(255, a[o + 2] * f + add); };
    const g = (X: number, Y: number) => (X < 0 || Y < 0 || X >= CW || Y >= CH ? 0 : k[Y * CW + X] ? group(k[Y * CW + X]) : 0);
    const out: [number, number][] = [];
    for (let Y = 0; Y < CH; Y++) for (let X = 0; X < CW; X++) {
      const i = Y * CW + X, key = k[i];
      if (!key) continue;
      const gr = group(key);
      if (gr === 4) {                                   // materiał: splot i pionowe fałdy
        // uporządkowane fałdy: pionowe zagłębienia co 5 px z jasną krawędzią po lewej (światło z lewej-góry)
        const f = (X + (Y >> 3)) % 5;
        if (f === 0) mul(i, 0.84); else if (f === 4 && g(X + 1, Y) === 4) mul(i, 1.08, 6);
        if (g(X, Y - 1) !== 4) mul(i, 1.1, 8);           // górna krawędź materiału łapie światło
      } else if (gr === 3) {                            // metal: odblask na górnej-lewej krawędzi, ciemniejszy dół
        if (g(X - 1, Y) !== 3 || g(X, Y - 1) !== 3) mul(i, 1.12, 18);
        else if (g(X, Y + 1) !== 3) mul(i, 0.78);
      }
      // wewnętrzny kontur: granica z innym materiałem poniżej / po prawej
      const gb = g(X, Y + 1), gr2 = g(X + 1, Y);
      if ((gb && gb !== gr && gr !== 1) || (gr2 && gr2 !== gr && gr === 4)) out.push([X, Y]);
    }
    for (const [X, Y] of out) mul(Y * CW + X, 0.72);
  }
  /** ciemny kontur 1 px wokół sylwetki */
  outline() {
    this.details();
    const al = (x: number, y: number) => x >= 0 && y >= 0 && x < CW && y < CH && this.a[(y * CW + x) * 4 + 3] > 0;
    const add: number[] = [];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (al(x, y)) continue;
      if (al(x - 1, y) || al(x + 1, y) || al(x, y - 1) || al(x, y + 1)) add.push(y * CW + x);
    }
    for (const i of add) { this.a[i * 4] = 22; this.a[i * 4 + 1] = 15; this.a[i * 4 + 2] = 18; this.a[i * 4 + 3] = 255; }
  }
}


/** głowa w wysokiej rozdzielczości: włosy z pasmami, twarz z oczami (biel, tęczówka, rzęsy), brwiami, nosem z cieniem,
 *  ustami, rumieńcami, uszami (elfa – szpiczaste), broda/wąsy i pasma przy twarzy */
function hiHead(cv: Cv, l: CharLook, d: Dir, hx: number, hy: number, back: boolean, bald: boolean, elf: boolean) {
  const HX = (hx + 0.5) * K - 0.5, HY = (hy + 0.5) * K - 0.5;
  const P = (X: number, Y: number, c: string) => cv.hp(X, Y, c);
  const [h1, h2, h3] = bald ? ['S', 's', 'z'] : ['H', 'h', 'g'];
  const bc: [string, string] = bald ? ['h', 'g'] : ['h', 'g'];     // broda (przy łysinie – brązowa z palety włosów)
  // czaszka / włosy: elipsa z cieniowaniem i pasmami
  const rx = 8.6, ry = 9.2, cy = HY - 1;
  for (let Y = Math.floor(cy - ry); Y <= Math.ceil(cy + ry); Y++) for (let X = Math.floor(HX - rx); X <= Math.ceil(HX + rx); X++) {
    const dx = (X - HX) / rx, dy = (Y - cy) / ry;
    if (dx * dx + dy * dy > 1) continue;
    const lt = dx * 0.7 + dy * 0.7;
    let c = lt < -0.45 ? h1 : lt < 0.4 ? h2 : h3;
    if (!bald && ((X * 3 + (Y >> 2)) % 4 === 0) && lt > -0.6) c = c === h1 ? h2 : h3;    // pasma (pionowe, lekko falujące)
    P(X, Y, c);
  }
  if (bald) { P(HX - 4, cy - 6, 'w'); P(HX - 3, cy - 6, 'w'); P(HX - 4, cy - 5, 'S'); }
  const earElf = (X: number, Y: number, dir: number) => {
    for (let t = 0; t < 6; t++) { P(X + dir * t, Y - t * 0.9, t < 4 ? 'S' : 's'); P(X + dir * t, Y - t * 0.9 + 1, t < 3 ? 's' : 'z'); }
  };
  if (back) {
    if (!bald) for (let Y = Math.round(cy + 5); Y <= Math.round(cy + (elf || l.kind === 'woman' ? 14 : 9)); Y++)
      for (let X = Math.round(HX - 6); X <= Math.round(HX + 6); X++) P(X, Y, (X + Y) % 3 === 0 ? h3 : h2);
    if (d === 'NE') { for (let Y = 0; Y < 5; Y++) P(HX + 8, HY + Y, Y < 3 ? 's' : 'z'); }
    if (elf) { if (d === 'N') earElf(HX - 8, HY, -1); earElf(HX + 8, HY, 1); }
    return;
  }
  // twarz
  const FX = d === 'S' ? HX : d === 'SE' ? HX + 1.5 : HX + 3.5;
  const hw = d === 'S' ? 6 : d === 'SE' ? 5.5 : 4.5;
  const top = HY - 3, bot = HY + 9;
  for (let Y = Math.round(top); Y <= Math.round(bot); Y++) {
    const taper = Y > HY + 4 ? 1 - ((Y - HY - 4) / 6) * 0.45 : 1;
    const w = hw * taper;
    for (let X = Math.round(FX - w); X <= Math.round(FX + w); X++) {
      const t = (X - (FX - w)) / (2 * w);
      P(X, Y, Y >= bot - 0.5 ? 'z' : t > 0.78 ? 's' : 'S');
    }
  }
  // grzywka (postrzępiona) i pasma przy twarzy
  if (!bald) {
    for (let X = Math.round(FX - hw - 1); X <= Math.round(FX + hw + 1); X++) {
      const depth = 2 + ((X * 7) % 3 === 0 ? 1 : 0) + ((X * 5) % 4 === 0 ? 1 : 0);
      for (let Y = Math.round(top - 1); Y < Math.round(top - 1 + depth); Y++) P(X, Y, (X + Y) % 2 ? h1 : h2);
    }
    const long = elf || l.kind === 'woman';
    const sides = d === 'E' ? [FX - hw - 2] : [FX - hw - 1, FX + hw + 1];
    for (const sx of sides) for (let Y = Math.round(top); Y <= Math.round(HY + (long ? 12 : 4)); Y++) {
      P(sx, Y, Y % 3 === 0 ? h3 : h2); if (long) P(sx + (sx < FX ? -1 : 1), Y + 1, h3);
    }
  }
  // oczy, brwi
  const ey = Math.round(HY + 1);
  const eyes = d === 'S' ? [[Math.round(FX - 3), 1], [Math.round(FX + 3), 1]] : d === 'SE' ? [[Math.round(FX - 2.5), 0], [Math.round(FX + 2.5), 1]] : [[Math.round(FX + 2), 0]];
  for (const [ex, wide] of eyes) {
    const xs = wide ? [ex - 1, ex, ex + 1] : [ex, ex + 1];
    for (const x of xs) P(x, ey - 1, 'o');                                   // rzęsy / powieka
    if (wide) { P(ex - 1, ey, 'w'); P(ex, ey, 'i'); P(ex + 1, ey, 'w'); P(ex, ey + 1, 'o'); }
    else { P(ex, ey, 'w'); P(ex + 1, ey, 'i'); P(ex + 1, ey + 1, 'o'); }
    for (const x of xs) P(x, ey - 3, 'y');                                   // brwi
    P(xs[xs.length - 1] + (ex > FX ? 1 : 0), ey - 3, 'y');
  }
  // nos, usta, rumieńce
  if (d === 'S') { P(FX, ey + 1, 'S'); P(FX + 1, ey + 2, 's'); P(FX, ey + 3, 'z'); P(FX + 1, ey + 3, 'z'); }
  else if (d === 'SE') { P(FX + 2, ey + 1, 'S'); P(FX + 3, ey + 2, 's'); P(FX + 3, ey + 3, 'z'); }
  else { P(FX + hw + 1, ey + 1, 'S'); P(FX + hw + 1, ey + 2, 's'); P(FX + hw, ey + 3, 'z'); }
  const mx = d === 'S' ? FX : d === 'SE' ? FX + 1.5 : FX + 3;
  for (let x = Math.round(mx - 1.5); x <= Math.round(mx + 1.5); x++) P(x, ey + 5, 'm');
  P(mx, ey + 6, 'BL');
  if (d !== 'E') { P(FX - hw + 1, ey + 3, 'BL'); P(FX - hw + 2, ey + 3, 'BL'); }
  P(FX + (d === 'E' ? 1 : hw - 2), ey + 3, 'BL');
  // uszy
  if (elf) {
    if (d === 'S') { earElf(FX - hw - 1, ey, -1); earElf(FX + hw + 1, ey, 1); }
    else if (d === 'SE') earElf(FX - hw - 1, ey, -1);
    else earElf(FX - hw - 1, ey, -1);
  } else {
    const ears = d === 'S' ? [FX - hw - 1, FX + hw + 1] : d === 'SE' ? [FX - hw - 1] : [FX - hw - 1];
    for (const ex of ears) { P(ex, ey, 's'); P(ex, ey + 1, 'S'); P(ex, ey + 2, 'z'); }
  }
  // broda / wąsy
  if (l.beard !== 'none' && !elf) {
    const bl = l.beard === 'long' ? 13 : l.beard === 'short' ? 6 : 0;
    if (l.beard === 'mustache') {
      for (let x = Math.round(mx - 3); x <= Math.round(mx + 3); x++) if (Math.abs(x - mx) > 0.6) P(x, ey + 4, bc[0]);
      P(mx - 3, ey + 5, bc[1]); P(mx + 3, ey + 5, bc[1]); P(mx - 3, ey + 6, bc[1]); P(mx + 3, ey + 6, bc[1]);
    } else {
      for (let Y = ey + 3; Y <= ey + 4 + bl; Y++) {
        const w = Y < ey + 6 ? hw : Math.max(1.5, hw - (Y - ey - 6) * (l.beard === 'long' ? 0.45 : 1.2));
        for (let X = Math.round(FX - w); X <= Math.round(FX + w); X++) {
          if (Y >= ey + 4 && Y <= ey + 6 && Math.abs(X - mx) <= 1.6) continue;          // usta widoczne
          if (Y === ey + 3 && Math.abs(X - FX) < hw - 1.5) continue;
          P(X, Y, (X * 3 + Y) % 4 === 0 ? bc[1] : bc[0]);
        }
      }
    }
  }
}

const BUILD = {
  thin: { tw: 4.0, sep: 2.5, leg: 1.5 },
  normal: { tw: 5.0, sep: 3.0, leg: 1.5 },
  stocky: { tw: 6.2, sep: 3.5, leg: 2.0 },
};

function frame(l: CharLook, d: Dir, phase: number, breath: number, walking: boolean, pose: Pose = 'none', glow = false): Uint8ClampedArray {
  const cv = new Cv(palette(l, glow));
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
  const civil = l.kind === 'woman' || l.kind === 'elder';
  const gear = l.gear ?? START_GEAR;
  const warrior = l.cls === 'warrior' && !zombie && !civil && (gear.weapon > 0 || !!l.kind);
  const shield = l.cls === 'warrior' && !l.kind && gear.shield > 0;
  const hunter = l.cls === 'hunter' && !l.kind && gear.weapon > 0;
  const quiver = l.cls === 'hunter' && !l.kind;
  const blen = gear.weapon >= 2 ? 2 : 0;          // dłuższe ostrze lepszej broni

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
      cv.line(h.x + 1, h.y - 1, h.x + 3, h.y - 13 - blen, 'E1', 'E2');
      cv.px(h.x + 3, h.y - 14 - blen, 'E3');
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

  // ---------------- nogi i buty (suknia / szata do kostek u mieszkańców)
  if (civil) {
    const sw2 = Math.round(stride * 0.5);
    for (let y = 28; y <= 39; y++) {
      const k = (y - 28) / 11, half = tw + 0.5 + k * (l.kind === 'woman' ? 3 : 1.5) - side * 1.2;
      cv.shadeRect(cx - half + (side ? sw2 : 0), y, cx + half + (side ? sw2 : 0), y, 'P', 'p', 'q');
    }
    cv.rect(cx - tw - 1, 39, cx + tw + 1, 39, 'q');
    for (const sgn of side < 1 ? [-1, 1] : [0]) cv.rect(cx + sgn * 2.5 - 1 + stride * 0.5, 40, cx + sgn * 2.5 + 1 + stride * 0.5, 41, 'a');
    if (l.kind === 'woman' && !(d === 'N' || d === 'NE')) for (let y = 30; y <= 38; y += 2) cv.px(cx + side * 2, y, 'c');   // haft
  } else if (side < 1) {
    const sep = B.sep - side;
    for (const sgn of [-1, 1]) {
      const lx = cx + sgn * sep;
      const lift = (stride > 0 && sgn < 0) || (stride < 0 && sgn > 0) ? 1 : 0;
      const dx = stride * sgn * 0.6 * side;
      cv.shadeRect(lx - B.leg + dx, 30, lx + B.leg + dx, 36 - lift, 'P', 'p', 'q');
      cv.px(lx - 0.5 + dx, 33 - lift, 'q'); cv.px(lx + 0.5 + dx, 33 - lift, 'p');      // szew na kolanie
      cv.shadeRect(lx - B.leg + dx, 37 - lift, lx + B.leg + dx, 40 - lift, 'A', 'a', 'j');
      cv.rect(lx - B.leg + dx, 37 - lift, lx + B.leg + dx, 37 - lift, 'A');
      cv.px(lx + dx, 38 - lift, 'Y');
      cv.px(lx - B.leg + dx, 39 - lift, 'A');                                         // odblask na cholewie
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
    if (quiver) cv.line(cx - tw + 1, t0, cx + tw - 1, t1 - 3, 'Q2');   // pas kołczanu przez pierś
  } else {
    cv.rect(cx - 1, t0 + 1, cx, t1 - 1, 'b');
  }
  if (!back && side < 1) { cv.px(cx - 1 + side, t0 + 1, 'D'); cv.px(cx + side, t0 + 2, 'D'); cv.px(cx + 1 + side, t0 + 1, 'D'); }   // dekolt w szpic
  cv.rect(cx - tw, 27 + by, cx + tw, 28 + by, 'K');
  cv.rect(cx - tw, 27 + by, cx + tw, 27 + by, 'c');
  if (!back) {
    const bx = cx + side * 2;
    cv.rect(bx - 1, 27 + by, bx, 28 + by, 'Y'); cv.px(bx - 1, 27 + by, 'w');
    cv.rect(cx + tw - 2, 28 + by, cx + tw, 31 + by, 'U'); cv.px(cx + tw - 1, 29 + by, 'Y');
  } else {
    cv.rect(cx - tw, 28 + by, cx - tw + 2, 31 + by, 'U');
  }
  // kołczan na plecach
  if (quiver) {
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
      cv.rect(ax - 1, t0 + 10 + ay, ax + 1, t0 + 11 + ay, lit ? 'X1' : 'X2');
      cv.rect(ax - 1.5, t0, ax + 1.5, t0 + 1, lit ? 'V' : 'v');
      cv.px(ax, t0, 'M');
      if (shield && sgn < 0) cv.rect(ax - 2, t0 - 1, ax + 2, t0 + 1, 'V');   // naramiennik
    }
  } else {
    const ax = cx + 1 + sw * 1.6;
    cv.rect(ax - 1, t0 + 2, ax + 1, t0 + 6, 'L'); cv.px(ax + 1, t0 + 4, 'l');
    cv.rect(ax - 1, t0 + 7, ax + 1, t0 + 9, 'V'); cv.px(ax, t0 + 8, 'M');
    cv.rect(ax - 1, t0 + 10, ax + 1, t0 + 11, 'X1'); cv.px(ax + 1, t0 + 11, 'X2');
    cv.rect(ax - 2, t0, ax + 2, t0 + 1, 'V'); cv.px(ax, t0, 'M');
  }

  // ---------------- kołnierz (kolczy kaptur u wojownika, chusta u łowcy)
  cv.rect(cx - tw + 0.5, 16 + by, cx + tw - 0.5, 17 + by, 'R');
  cv.rect(cx + tw - 2.5, 16 + by, cx + tw - 0.5, 17 + by, 'r');
  cv.px(cx - 1, 17 + by, 'r'); cv.px(cx + 2, 16 + by, 'x');

  // ---------------- głowa (rysowana bezpośrednio w wysokiej rozdzielczości – twarz to najważniejszy detal)
  const hy = 10 + by;
  const bald = l.hair === 'bald';
  const elf = l.race === 'elf';
  hiHead(cv, l, d, hx, hy, back, bald, elf);

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
  if (quiver && !back && (d === 'S' || d === 'SE')) { cv.px(cx + tw - 1, t0 - 2, 'F1'); cv.px(cx + tw, t0 - 3, 'F2'); cv.px(cx + tw + 1, t0 - 2, 'F1'); }
  // hełm (po głowie i broni z tyłu)
  if (gear.helm > 0 && !l.kind) {
    const t = gear.helm;
    for (let y = Math.floor(hy - 7); y <= hy - 2; y++) for (let x = Math.floor(hx - 6); x <= hx + 6; x++) {
      const dx = (x - hx) / 6, dy = (y - (hy - 1)) / 6.4;
      if (dx * dx + dy * dy > 1) continue;
      const k = dx * 0.7 + dy * 0.7;
      cv.px(x, y, y === hy - 2 ? 'H4' : k < -0.35 ? 'H1' : k < 0.45 ? 'H2' : 'H3');
    }
    if (t === 1) {   // kaptur schodzi po bokach
      for (const sx of back ? [-6, 6] : d === 'E' ? [-5] : [-6, 6]) cv.rect(hx + sx - (sx < 0 ? 0 : 0), hy - 2, hx + sx, hy + 3, sx < 0 ? 'H2' : 'H3');
    } else if (!back) {
      const nx = d === 'S' ? hx : d === 'SE' ? hx + 1 : hx + 4;
      cv.rect(nx, hy - 1, nx, hy + 1, 'H3');                     // nosal
      if (t === 3) cv.rect(hx - 1, hy - 8, hx + 1, hy - 8, 'H4'); // grzebień
    } else if (t === 3) cv.rect(hx - 1, hy - 8, hx + 1, hy - 8, 'H4');
  }
  if (l.kind === 'elder') {
    // kostur w prawej ręce: od ziemi do nad głowę, z sękiem u góry
    const sx = d === 'E' ? cx + 5 : cx + tw + 2;
    cv.line(sx, 41, sx + 1, 6, 'W2', 'W1');
    cv.rect(sx, 5, sx + 2, 6, 'W2'); cv.px(sx + 2, 4, 'W1');
  }
  if (l.kind === 'woman') {
    // długie włosy opadające na ramiona / plecy
    if (back) cv.rect(hx - 4, hy + 2, hx + 4, hy + 12, 'h');
    else if (d === 'E') cv.rect(hx - 4, hy + 2, hx - 1, hy + 11, 'h');
    else { cv.rect(hx - 6, hy, hx - 5, hy + 10, 'h'); cv.rect(hx + 5, hy, hx + 6, hy + 10, 'g'); }
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

/**
 * klatka siedzenia z klatki stojącej: tułów i głowa niżej o 7 px, nogi skrzyżowane przed sobą
 * (kolory spodni i butów brane z klatki stojącej)
 */
export function sitting(src: FrameData, d: Dir): FrameData {
  const { w, h } = src, px = new Uint8ClampedArray(w * h * 4);
  const DROP = Math.round(7 * K), CUT = Math.round(30 * K);
  const sc = (v: number) => Math.round(v * K);
  const get = (x: number, y: number) => { const o = (y * w + x) * 4; return [src.px[o], src.px[o + 1], src.px[o + 2], src.px[o + 3]]; };
  const put = (x: number, y: number, c: number[]) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3];
  };
  const pants = get(sc(11), sc(33))[3] ? get(sc(11), sc(33)) : [62, 68, 96, 255];
  const pantsD = get(sc(16), sc(33))[3] ? get(sc(16), sc(33)) : [42, 46, 68, 255];
  const boot = get(sc(11), sc(39))[3] ? get(sc(11), sc(39)) : [138, 82, 48, 255];
  const bootD = get(sc(16), sc(39))[3] ? get(sc(16), sc(39)) : [90, 50, 24, 255];
  const mid = sc(14);
  const ink = [22, 15, 18, 255];
  // nogi: skrzyżowane, przed tułowiem (dla widoku od tyłu – schowane)
  const back = d === 'N' || d === 'NE';
  if (!back) {
    const side = d === 'E' ? 1 : 0;
    for (let y = sc(35); y <= sc(39.6); y++) for (let x = sc(7 + side * 3); x <= sc(21.6 + side * 2); x++) put(x, y, x < mid ? pants : pantsD);
    for (const bx of side ? [21, 22] : [6, 7, 20, 21]) for (let y = sc(36); y <= sc(39.6); y++) for (let X = sc(bx); X < sc(bx + 1); X++) put(X, y, bx < 14 ? boot : bootD);
  } else {
    for (let y = sc(37); y <= sc(39.6); y++) for (let x = sc(8); x <= sc(20.6); x++) put(x, y, pantsD);
  }
  // tułów i głowa przesunięte w dół
  for (let y = 0; y < CUT; y++) for (let x = 0; x < w; x++) { const c = get(x, y); if (c[3] && y + DROP < h) put(x, y + DROP, c); }
  // kontur
  const al = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] > 0;
  const add: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!al(x, y) && (al(x - 1, y) || al(x + 1, y) || al(x, y - 1) || al(x, y + 1))) add.push([x, y]);
  for (const [x, y] of add) put(x, y, ink);
  return { w, h, ax: src.ax, ay: src.ay, px };
}

/** powiększenie klatki w skali K (najbliższy sąsiad) – dla klatek rysowanych w siatce projektu */
export function upscale(f: FrameData): FrameData {
  const w = Math.round(f.w * K), h = Math.round(f.h * K), px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(f.w - 1, Math.floor((x + 0.5) / K)), sy = Math.min(f.h - 1, Math.floor((y + 0.5) / K));
    const o = (y * w + x) * 4, so = (sy * f.w + sx) * 4;
    px[o] = f.px[so]; px[o + 1] = f.px[so + 1]; px[o + 2] = f.px[so + 2]; px[o + 3] = f.px[so + 3];
  }
  return { w, h, ax: Math.round(f.ax * K), ay: Math.round((f.ay + 1) * K) - 1, px };
}

/** szkielet po śmierci: kupka kości z czaszką i zardzewiałym mieczem (30×16, kotwica pod środkiem) */
export function bonePile(): FrameData {
  const w = 32, h = 16, px = new Uint8ClampedArray(w * h * 4);
  const C: Record<string, RGB> = { a: hex('#e8e2cc'), b: hex('#b8b09a'), c: hex('#807860'), k: hex('#1a1414'), r: hex('#8a6a4a'), s: hex('#5a4430') };
  const put = (x: number, y: number, k: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 4, c = C[k]; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  };
  const bone = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); put(x, y, i % 3 ? 'a' : 'b'); put(x, y + 1, 'c'); }
    put(x0 - 1, y0, 'a'); put(x0, y0 - 1, 'a'); put(x1 + 1, y1, 'a'); put(x1, y1 - 1, 'a');   // główki kości
  };
  // miecz pod spodem
  for (let x = 3; x <= 24; x++) put(x, 13 - Math.floor((x - 3) / 8), x < 8 ? 's' : 'r');
  bone(6, 10, 15, 8); bone(17, 11, 26, 12); bone(9, 12, 18, 13); bone(20, 8, 27, 9); bone(4, 7, 10, 9);
  // żebra
  for (let i = 0; i < 4; i++) { put(13 + i * 2, 10, 'b'); put(13 + i * 2, 11, 'a'); put(14 + i * 2, 12, 'c'); }
  // czaszka
  for (let y = 3; y <= 8; y++) for (let x = 20; x <= 26; x++) {
    const dx = (x - 23) / 3.4, dy = (y - 5.6) / 2.9;
    if (dx * dx + dy * dy <= 1) put(x, y, dx + dy < -0.3 ? 'a' : dx + dy < 0.5 ? 'b' : 'c');
  }
  put(21, 5, 'k'); put(22, 5, 'k'); put(24, 5, 'k'); put(23, 7, 'k'); put(22, 8, 'a'); put(24, 8, 'a');
  // kontur
  const al = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] > 0;
  const add: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!al(x, y) && (al(x - 1, y) || al(x + 1, y) || al(x, y - 1) || al(x, y + 1))) add.push([x, y]);
  for (const [x, y] of add) { const o = (y * w + x) * 4; px[o] = 22; px[o + 1] = 15; px[o + 2] = 18; px[o + 3] = 255; }
  return { w, h, ax: 16, ay: 13, px };
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
    data.set(`${prefix}_${d}_atkg0`, std(frame(look, d, 0, 0, false, 'atk0', true)));
    data.set(`${prefix}_${d}_atkg1`, std(frame(look, d, 0, 0, false, 'atk1', true)));
    data.set(`${prefix}_${d}_sit0`, sitting(data.get(`${prefix}_${d}_idle0`)!, d));
    data.set(`${prefix}_${d}_sit1`, sitting(data.get(`${prefix}_${d}_idle1`)!, d));
  }
  data.set(`${prefix}_dead`, lying(data.get(`${prefix}_E_idle0`)!));
  if (look.kind === 'skeleton') data.set(`${prefix}_bones`, upscale(bonePile()));
  return { names: [...data.keys()], data };
}
