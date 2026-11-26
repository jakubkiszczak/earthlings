// Portret postaci do HUD (68×68, wyświetlany w medalionie): popiersie z cieniowaniem i ditheringiem,
// duże oczy z odblaskiem, włosy (kolor, objętość), broda, uszy elfa, piegi, strój klasy i hełm z ekwipunku.
import type { CharLook } from './chargen';

const S = 68;
type RGB = [number, number, number];
const hx = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

const HAIR: Record<string, string[]> = {
  black: ['#14101a', '#26202c', '#3a3242', '#544a5e', '#6e6478'],
  white: ['#8a8e9a', '#b0b4be', '#d0d4dc', '#ecedf0', '#ffffff'],
  blond: ['#8a6428', '#b8903c', '#dcb860', '#f2d888', '#fff0b8'],
  brown: ['#3a2010', '#5a3418', '#7a4a26', '#9a6438', '#bc8452'],
  bald: ['#8a5c3e', '#a87252', '#c8906a', '#e4b088', '#f6d0a8'],
};
const SKIN: Record<string, string[]> = {
  human: ['#7a4a30', '#a06648', '#c8906a', '#e4b088', '#f6d0a8', '#fff0dc'],
  elf: ['#9a6a4c', '#c08a68', '#dcb494', '#f0d0b0', '#fae4cc', '#fff6ea'],
};
const EYE: Record<string, string[]> = { human: ['#1a3a5a', '#2e6a9a', '#5aa0d8'], elf: ['#164a24', '#2e8a42', '#6ad87a'] };

export function drawPortrait(l: CharLook): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const put = (x: number, y: number, col: RGB) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const o = (y * S + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  };
  /** kolor z rampy dla wartości f (0..n-1) z ditheringiem Bayera */
  const shade = (pal: string[], f: number, x: number, y: number): RGB => {
    const k = Math.max(0, Math.min(pal.length - 1, Math.round(f + BAY[y & 3][x & 3] / 16 - 0.47)));
    return hx(pal[k]);
  };
  const inEll = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const elf = l.race === 'elf', hunter = l.cls === 'hunter', g = l.gear;
  const hair = HAIR[l.hair] ?? HAIR.brown, skin = SKIN[l.race], eye = EYE[l.race];

  // tło: ciemny granat z turkusową poświatą magii
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.hypot(x - 30, y - 26) / 46;
    put(x, y, shade(['#06060e', '#0c0e1c', '#14203a', '#1c3a52', '#245a64'], 3.2 - r * 3.4, x, y));
  }
  const FCX = 34, FCY = 31;      // środek twarzy

  // włosy z tyłu (długie u elfa, objętość)
  if (l.hair !== 'bald') {
    const long = elf;
    for (let y = 8; y < (long ? 66 : 44); y++) for (let x = 10; x < 58; x++) {
      const inside = inEll(x, y, FCX, 28, long ? 21 : 18, long ? 30 : 18) || (long && inEll(x, y, FCX, 50, 24, 16));
      if (!inside) continue;
      const wave = Math.sin(y * 0.55 + x * 0.15) * 0.8 + Math.sin(x * 0.9) * 0.3;
      put(x, y, shade(hair, 1.6 + wave - (x - FCX) / 30 - (y - 20) / 50, x, y));
    }
  }
  // ramiona i strój
  const armor = g?.armor ?? 0;
  const cloth = hunter ? ['#10200e', '#1e3a18', '#2e5426', '#43703a', '#5e8c50'] : ['#2a0a08', '#4a1410', '#6a2018', '#8a3020', '#a84630'];
  const metal = armor >= 2 ? ['#2a2e36', '#4a5060', '#7a8290', '#a8b0bc', '#dce2ea'] : ['#2a1608', '#4a2a12', '#6a4220', '#8a5a30', '#ad7844'];
  for (let y = 46; y < S; y++) for (let x = 0; x < S; x++) {
    if (!inEll(x, y, FCX, 72, 34, 26)) continue;
    const onPad = inEll(x, y, 12, 54, 11, 8) || inEll(x, y, 56, 54, 11, 8);
    const f = 2.2 - (x - FCX) / 40 + (onPad ? 0.6 : 0) - (y - 50) / 30;
    put(x, y, onPad && (armor > 0 || !hunter) ? shade(metal, f + 0.4, x, y) : shade(cloth, f, x, y));
  }
  // kołnierz: futro u łowcy (jak płaszcz zwiadowcy), kolczy u wojownika
  for (let y = 44; y < 56; y++) for (let x = 14; x < 54; x++) {
    if (!inEll(x, y, FCX, 50, 20, 6) || inEll(x, y, FCX, 47, 7, 6)) continue;
    if (hunter) put(x, y, shade(['#7a7a82', '#a8acb4', '#d4d8de', '#f0f2f4', '#ffffff'], 2.4 + Math.sin(x * 1.3 + y) * 0.9 - (x - FCX) / 26, x, y));
    else put(x, y, shade(['#3a3e46', '#5a606c', '#8a909c', '#b8bec8'], 1.8 + ((x + y) % 2) * 0.8 - (x - FCX) / 30, x, y));
  }
  if (armor === 3 || (!hunter && armor >= 1)) for (let x = 20; x < 48; x++) put(x, 56, hx(armor === 3 ? '#e8c050' : '#c8a060'));
  // pas kołczanu / pas przez pierś
  if (hunter) for (let y = 50; y < S; y++) { const x = 18 + (y - 50) * 1.4; put(x, y, hx('#3a2414')); put(x + 1, y, hx('#5a3a20')); }
  // szyja
  for (let y = 40; y < 50; y++) for (let x = FCX - 5; x <= FCX + 5; x++) put(x, y, shade(skin, 2.2 - (x - FCX) / 5 - (y - 40) / 12, x, y));

  // uszy elfa: długie, szpiczaste, w tył
  if (elf) for (const sgn of [-1, 1]) for (let t = 0; t < 14; t++) for (let w = -2; w <= 2; w++) {
    const x = FCX + sgn * (12 + t * 0.9), y = FCY - 2 - t * 0.85 + w * 0.55 + (t * t) * 0.02;
    if (Math.abs(w) > 2 - t / 8) continue;
    put(x, y, shade(skin, 3 - (sgn > 0 ? 1.2 : 0) - Math.abs(w) * 0.4 + (w < 0 ? 0.5 : 0), Math.round(x), Math.round(y)));
  }
  // twarz: owal, cieniowanie od światła z lewej-góry
  for (let y = 14; y < 46; y++) for (let x = 18; x < 51; x++) {
    const jaw = y > 32 ? 1 - (y - 32) / 22 : 1;
    if (!inEll(x, y, FCX, 30, 13 * jaw + 0.5, 15)) continue;
    const f = 3.4 - (x - FCX + 4) / 11 - (y - 26) / 26 - (Math.abs(x - FCX) > 10 ? 0.6 : 0);
    put(x, y, shade(skin, f, x, y));
  }
  // policzki, piegi (elf)
  for (const cx of [FCX - 8, FCX + 8]) for (let y = 33; y < 37; y++) for (let x = cx - 2; x <= cx + 2; x++)
    if (inEll(x, y, cx, 35, 3, 1.6) && (x + y) % 2 === 0) put(x, y, hx(elf ? '#f0a890' : '#e0907a'));
  if (elf) for (const [x, y] of [[26, 33], [28, 34], [25, 35], [40, 33], [42, 34], [43, 35]]) put(x, y, hx('#c8805a'));

  // oczy: duże, biel, tęczówka z gradientem, źrenica, odblask, rzęsy
  for (const ex of [FCX - 6, FCX + 6]) {
    for (let y = 27; y <= 31; y++) for (let x = ex - 3; x <= ex + 3; x++) if (inEll(x, y, ex, 29, 3.6, 2.4)) put(x, y, hx('#f4f0ec'));
    for (let y = 27; y <= 31; y++) for (let x = ex - 2; x <= ex + 2; x++) if (inEll(x, y, ex, 29.3, 2.2, 2.3)) put(x, y, shade(eye, (y - 27) / 1.6, x, y));
    put(ex, 29, hx('#0a0a10')); put(ex, 30, hx('#0a0a10'));
    put(ex - 1, 28, hx('#ffffff'));                                         // odblask
    for (let x = ex - 4; x <= ex + 3; x++) put(x, 26, hx('#1a1014'));       // górna powieka / rzęsy
    put(ex + (ex < FCX ? -4 : 4), 27, hx('#1a1014'));
    // brwi w kolorze włosów
    const bc = l.hair === 'bald' ? hx('#6a4a32') : hx(hair[0]);
    for (let x = ex - 3; x <= ex + 3; x++) put(x, 23 - (x === ex - 3 || x === ex + 3 ? 0 : 1) + (ex < FCX ? (x > ex ? 0 : 0) : 0), bc);
  }
  // nos (cień po prawej) i usta
  for (let y = 30; y <= 35; y++) put(FCX + 1, y, shade(skin, 1.4, FCX + 1, y));
  put(FCX - 1, 35, hx(skin[1])); put(FCX, 35, hx(skin[1])); put(FCX, 34, hx(skin[4]));
  for (let x = FCX - 3; x <= FCX + 3; x++) put(x, 39, hx(elf ? '#c05a5a' : '#a84a40'));
  put(FCX - 2, 40, hx('#d87a70')); put(FCX - 1, 40, hx('#d87a70')); put(FCX, 40, hx('#d87a70'));

  // broda / wąsy (człowiek)
  if (!elf && l.beard !== 'none') {
    const bh = l.beard === 'long' ? 64 : l.beard === 'short' ? 47 : 0;
    if (l.beard === 'mustache') {
      for (let x = FCX - 6; x <= FCX + 6; x++) { put(x, 38, shade(hair, 2 - (x - FCX) / 8, x, 38)); if (Math.abs(x - FCX) > 3) put(x, 39, shade(hair, 1.5, x, 39)); }
    } else {
      for (let y = 34; y < bh; y++) for (let x = 18; x < 51; x++) {
        const half = 13 - Math.max(0, (y - 40)) * (l.beard === 'long' ? 0.42 : 0.9);
        if (Math.abs(x - FCX) > half || (y < 38 && Math.abs(x - FCX) < 8) || (y >= 38 && y <= 40 && Math.abs(x - FCX) <= 4)) continue;
        put(x, y, shade(hair, 2.2 + Math.sin(x * 1.1 + y * 0.3) * 0.7 - (x - FCX) / 14, x, y));
      }
    }
  }
  // włosy z przodu: grzywka, pasma przy twarzy
  if (l.hair !== 'bald') {
    for (let y = 8; y < 26; y++) for (let x = 14; x < 55; x++) {
      if (!inEll(x, y, FCX, 22, 19, 14) || (y > 18 && inEll(x, y, FCX + 2, 30, 10, 9))) continue;
      const strand = Math.sin(x * 0.8 - y * 0.35) * 0.9;
      put(x, y, shade(hair, 2.4 + strand - (x - FCX) / 22 - (y - 12) / 20, x, y));
    }
    for (const sx of [FCX - 14, FCX + 13]) for (let y = 20; y < (elf ? 50 : 36); y++) for (let w = 0; w < 3; w++) {
      const x = sx + w + Math.round(Math.sin(y * 0.5) * 1.2);
      put(x, y, shade(hair, 2 + (w === 1 ? 0.8 : 0) - (sx > FCX ? 1 : 0), x, y));
    }
  } else {
    // łysa głowa: odblask na czubku
    for (let y = 14; y < 20; y++) for (let x = 26; x < 36; x++) if (inEll(x, y, 30, 17, 4, 2)) put(x, y, hx(skin[5]));
  }
  // hełm z ekwipunku
  const helm = g?.helm ?? 0;
  if (helm > 0) {
    const hp = helm === 1 ? ['#3e2410', '#5e3a1c', '#7e5028', '#9e6a3a'] : helm === 2 ? ['#3a3e46', '#5a606c', '#8a909c', '#c0c6d0'] : ['#5a606c', '#9aa2ae', '#d0d6e0', '#f4f6fa'];
    for (let y = 6; y < 26; y++) for (let x = 14; x < 55; x++) {
      if (!inEll(x, y, FCX, 22, 20, 15) || y > 24) continue;
      put(x, y, shade(hp, 2.2 - (x - FCX) / 18 - (y - 10) / 26, x, y));
    }
    const rim = helm === 3 ? '#e8c050' : hp[0];
    for (let x = 15; x < 54; x++) put(x, 24, hx(rim));
    if (helm >= 2) for (let y = 24; y < 34; y++) { put(FCX, y, hx(hp[2])); put(FCX + 1, y, hx(hp[1])); }   // nosal
    if (helm === 3) for (let y = 4; y < 10; y++) put(FCX, y, hx('#e8c050'));
  }
  ctx.putImageData(img, 0, 0);
  // ciemny kontur sylwetki na tle: lekkie przyciemnienie krawędzi medalionu
  const grd = ctx.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S * 0.52);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, S, S);
  return c;
}
