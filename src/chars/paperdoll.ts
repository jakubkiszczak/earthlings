// Postać gracza „paper doll”: wygląd (płeć, rasa, kolor skóry, fryzura, broda, kolory) + wymienne wyposażenie
// (miecz, tarcza, hełm, buty, łuk), 8 kierunków × 15 klatek (+ 4 klatki strzału z łuku), bez odbić lustrzanych
// (tarcza zawsze w lewej ręce). Źródło prawdy: docs/CHARACTER_SPEC.md, assets/art/sprites/items.json i *_anchors.json;
// wzorzec: tools/compose_preview.py.
//
// Warstwy składamy na CPU w gotowe klatki (FrameData → CharSheet), zamiast trzymać w grze kontener z wieloma
// sprite'ami: (1) system konturów zasłoniętych postaci (Xray) potrzebuje jednej tekstury na klatkę, (2) obrót
// odtwarza dokładnie Pillow (NEAREST, arytmetyka stałoprzecinkowa), więc obraz jest identyczny co do piksela ze wzorcem.
// Kolejność warstw i zasada „miecz zawsze przed tarczą” – drawOrder().
import type { CharFrames, FrameData } from './chargen';

export const DIRS8 = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'] as const;
export type Dir8 = (typeof DIRS8)[number];
export type Gender = 'male' | 'female';
export type Race = 'human' | 'elf';
/** kolor skóry z paczki: „warm” – tony ciała człowieka, „fair” – tony ciała elfa */
export type Skin = 'warm' | 'fair';
export type Sheet = 'anim' | 'shoot';
export type Slot = 'weapon' | 'shield' | 'helmet' | 'boots';
export type Equipment = Record<Slot, string | null>;
export const NO_EQUIPMENT: Equipment = { weapon: null, shield: null, helmet: null, boots: null };

export interface Appearance { gender: Gender; race: Race; skin: Skin; hair: string; hairColor: string; beard: string; beardColor: string }

/** obraz RGBA (piksele w kolejności wierszy) */
export interface Img { w: number; h: number; px: Uint8ClampedArray }

interface Point { x: number; y: number; angle: number }
export type ZOrder = 'front' | 'behind';
export interface AnchorFrame {
  index: number; anim: string; hand_r: Point; hand_l: Point; head: Point;
  z: { weapon?: ZOrder; shield?: ZOrder; bow?: ZOrder; arrow?: ZOrder };
}
export interface AnchorFile { direction: Dir8; frames: AnchorFrame[]; items: Record<string, { center_offset_from_hand_l?: [number, number] }> }

export interface ItemDef {
  id: string; slot: Slot; attach?: 'hand_r' | 'hand_l' | 'head'; rotate?: boolean; pivot?: [number, number];
  type?: 'full_frame_overlay' | 'bow'; two_handed?: boolean; disables?: Slot[]; ammo?: string; files: Record<Dir8, string>;
}
interface BodyDef { base: Record<Dir8, string>; anchors: Record<Dir8, string>; shoot: { base: Record<Dir8, string>; anchors: Record<Dir8, string> } }
export interface AppearanceDef {
  races: Race[]; genders: Gender[]; hair_styles: Record<Gender, string[]>; beard_styles: Record<Gender, string[]>;
  beard_races: Race[]; colors: string[]; palettes: string;
  defaults: Record<Gender, { race: Race; hair: string; hair_color: string; beard: string; beard_color?: string }>;
  files: { body: string; elf_ears: string; hair_back: string; hair_front: string; beard: string };
}
export interface Registry {
  cell: [number, number]; feet_anchor: [number, number]; directions: Dir8[]; items: ItemDef[];
  body: BodyDef; body_female: BodyDef; appearance: AppearanceDef;
  animations: Record<'idle' | 'walk' | 'attack' | 'sit' | 'power_strike' | 'death' | 'shoot', { frames: number[]; fps: number; loop: boolean; then?: string }>;
}
export interface Palettes { base: string[]; palettes: Record<string, string[]> }

/** wszystko, czego potrzeba do składania: rejestr, palety, punkty zaczepienia (pliki → dane) i obrazy (pliki → piksele) */
export interface DollAssets {
  reg: Registry; pal: Palettes; anchors: Record<string, AnchorFile>; images: Record<string, Img>;
  /** przygotowane warstwy (podmieniona paleta / skóra), klucz: plik|wariant */
  cache?: Map<string, Img>;
}

export const CELL_W = 42, CELL_H = 63, FEET: [number, number] = [21, 62];
/** płótno klatki jak we wzorcu: 82×93, komórka 42×63 przesunięta o (20, 20) – miejsce na wystający miecz */
export const CANVAS_W = 82, CANVAS_H = 93, PAD = 20;
const DEATH_FRAME = 14;
/** kolor cięciwy (docs/CHARACTER_SPEC.md) */
const STRING_RGB = [0xe6, 0xe1, 0xd2];
/** cięciwa luźna (łuk w ręce, poza strzałem) – ciemniejsza, żeby nie rysowała jasnej kreski przez postać */
const STRING_REST = [0x8c, 0x80, 0x6c];
/** tony skóry w ciałach z paczki (jasny → ciemny): człowiek i elf; ten sam indeks = to samo miejsce cieniowania */
export const SKIN_TONES: Record<Skin, string[]> = { warm: ['#eeb779', '#da945c', '#ba895b'], fair: ['#f6d4aa', '#e2b284', '#c89a72'] };
export const SKINS: Skin[] = ['warm', 'fair'];
export const raceSkin = (r: Race): Skin => (r === 'elf' ? 'fair' : 'warm');

// ------------------------------------------------------------------ wygląd
/** poprawny wygląd wg items.json → appearance: broda tylko dla człowieka-mężczyzny, nieznane wartości → domyślne */
export function normalizeAppearance(AP: AppearanceDef, a: Partial<Appearance>): Appearance {
  const gender: Gender = a.gender === 'female' ? 'female' : 'male';
  const d = AP.defaults[gender];
  const race: Race = a.race && AP.races.includes(a.race) ? a.race : d.race;
  const color = (c: string | undefined, def: string) => (c && AP.colors.includes(c) ? c : def);
  const hair = a.hair && AP.hair_styles[gender].includes(a.hair) ? a.hair : d.hair;
  const hairColor = color(a.hairColor, d.hair_color);
  const beardOk = gender === 'male' && AP.beard_races.includes(race);
  const beard = beardOk && a.beard && AP.beard_styles[gender].includes(a.beard) ? a.beard : 'none';
  return { gender, race, skin: a.skin && SKINS.includes(a.skin) ? a.skin : raceSkin(race), hair, hairColor, beard, beardColor: color(a.beardColor, hairColor) };
}

const fill = (t: string, a: Appearance, d: Dir8, sheet: Sheet) =>
  t.replace('{race}', a.race).replace('{gender}', a.gender).replace('{dir}', d).replace('{sheet}', sheet).replace('{hair}', a.hair).replace('{beard}', a.beard);

/** pliki warstw wyglądu dla kierunku i arkusza (ścieżki względem assets/art/sprites/) */
export function appearanceFiles(AP: AppearanceDef, a: Appearance, d: Dir8, sheet: Sheet) {
  const F = AP.files;
  return {
    body: fill(F.body, a, d, sheet),
    /** ciało elfa tej samej płci – maska skóry przy zmianie koloru skóry człowieka */
    elfBody: fill(F.body, { ...a, race: 'elf' }, d, sheet),
    hairBack: fill(F.hair_back, a, d, sheet),
    hairFront: fill(F.hair_front, a, d, sheet),
    beard: a.beard !== 'none' ? fill(F.beard, a, d, sheet) : null,
    ears: a.race === 'elf' ? fill(F.elf_ears, a, d, sheet) : null,
  };
}

// ------------------------------------------------------------------ kolory
const hex = (s: string) => (parseInt(s.slice(1, 3), 16) << 16) | (parseInt(s.slice(3, 5), 16) << 8) | parseInt(s.slice(5, 7), 16);
const rgbAt = (px: Uint8ClampedArray, o: number) => (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
const setRgb = (px: Uint8ClampedArray, o: number, c: number) => { px[o] = c >> 16; px[o + 1] = (c >> 8) & 255; px[o + 2] = c & 255; };

/** zamiana palety włosów/brody: piksel w kolorze base[k] → palettes[kolor][k], alfa bez zmian (dokładne RGB) */
export function recolor(img: Img, pal: Palettes, color: string): Img {
  const to = pal.palettes[color];
  if (!to) return img;
  const map = new Map(pal.base.map((b, k) => [hex(b), hex(to[k])]));
  const px = new Uint8ClampedArray(img.px);
  for (let o = 0; o < px.length; o += 4) {
    if (!px[o + 3]) continue;
    const m = map.get(rgbAt(px, o));
    if (m !== undefined) setRgb(px, o, m);
  }
  return { w: img.w, h: img.h, px };
}

/** kolor skóry inny niż domyślny dla rasy: tony skóry zamienione na tony drugiej rasy. Miejsca skóry wyznacza ciało elfa
 *  (w ciele człowieka ten sam odcień ma też płócienna koszula, więc nie wystarczy sama zamiana kolorów). */
export function reskin(body: Img, elfBody: Img, race: Race, skin: Skin): Img {
  if (skin === raceSkin(race)) return body;
  const from = SKIN_TONES[raceSkin(race)].map(hex), to = SKIN_TONES[skin].map(hex), fair = SKIN_TONES.fair.map(hex);
  const px = new Uint8ClampedArray(body.px);
  for (let o = 0; o < px.length; o += 4) {
    if (!px[o + 3] || !elfBody.px[o + 3] || !fair.includes(rgbAt(elfBody.px, o))) continue;
    const k = from.indexOf(rgbAt(px, o));
    if (k >= 0) setRgb(px, o, to[k]);
  }
  return { w: body.w, h: body.h, px };
}

// ------------------------------------------------------------------ kierunek
/** wektor na ekranie (dx w prawo, dy w dół) → jeden z 8 kierunków, sektory po 45°, S = w dół ekranu */
export function dirFromVector(dx: number, dy: number): Dir8 {
  const oct = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;   // 0 = E, 2 = S (zgodnie z ruchem wskazówek)
  return (['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const)[oct];
}

// ------------------------------------------------------------------ kolejność rysowania
export type Layer = 'hair_back' | 'shield' | 'weapon' | 'bow' | 'body' | 'boots' | 'beard' | 'hair_front' | 'ears' | 'helmet' | 'weapon_clip';

const itemOf = (reg: Registry, id: string | null) => (id ? reg.items.find((i) => i.id === id) ?? null : null);
const isBow = (it: ItemDef | null) => it?.type === 'bow';

/** łuk jest dwuręczny – wyłącza tarczę (items.json: disables) */
export function effectiveEquipment(reg: Registry, eq: Equipment): Equipment {
  const out = { ...eq };
  for (const s of itemOf(reg, eq.weapon)?.disables ?? []) out[s] = null;
  return out;
}

/** kolejność warstw w klatce (docs/CHARACTER_SPEC.md): włosy(tył) → tarcza(za) → miecz(za) → ciało → buty → broda →
 *  włosy(przód) → uszy → hełm → tarcza(przed) → miecz(przed) → [miecz przycięty do tarczy, gdy miecz za ciałem,
 *  a tarcza przed nim]. Łuk: w arkuszu strzału wg z.bow, w pozostałych klatkach jak tarcza (w lewej ręce). */
export function drawOrder(
  f: Pick<AnchorFrame, 'index' | 'z'>, eq: Equipment,
  look: { beard?: boolean; ears?: boolean; bow?: boolean; shoot?: boolean; back?: boolean } = {},
): Layer[] {
  const out: Layer[] = ['hair_back'];
  const bow = !!look.bow && !!eq.weapon;
  const zw = f.z.weapon ?? 'front', zs = f.z.shield ?? 'front';
  // poza strzałem łuk w lewej ręce, przed albo za ciałem jak tarcza
  const zb = look.shoot ? f.z.bow ?? 'front' : zs;
  const sword = !!eq.weapon && !bow, shield = !!eq.shield && !bow;
  if (shield && zs === 'behind') out.push('shield');
  if (sword && zw === 'behind') out.push('weapon');
  if (bow && zb === 'behind') out.push('bow');
  out.push('body');
  if (eq.boots && !look.shoot) out.push('boots');
  if (look.beard) out.push('beard');
  out.push('hair_front');
  if (look.ears) out.push('ears');
  if (eq.helmet && f.index !== DEATH_FRAME) out.push('helmet');
  if (shield && zs === 'front') out.push('shield');
  if (sword && zw === 'front') out.push('weapon');
  if (bow && zb === 'front') out.push('bow');
  if (sword && shield && zw === 'behind' && zs === 'front') out.push('weapon_clip');
  return out;
}

// ------------------------------------------------------------------ obrót jak w Pillow (Image.rotate, NEAREST, center)
const round15 = (x: number) => Number(x.toFixed(15));

/** Image.rotate(angle, resample=NEAREST, center=(cx, cy)) – ten sam rozmiar, przezroczyste tło */
export function pilRotate(src: Img, angle: number, cx: number, cy: number): Img {
  const { w, h } = src, out = new Uint8ClampedArray(w * h * 4);
  angle = ((angle % 360) + 360) % 360;
  const r = (-angle * Math.PI) / 180;
  const a = round15(Math.cos(r)), b = round15(Math.sin(r)), d = round15(-Math.sin(r)), e = round15(Math.cos(r));
  const c = a * -cx + b * -cy + cx, f = d * -cx + e * -cy + cy;
  const copy = (x: number, y: number, xi: number, yi: number) => {
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return;
    const s = (yi * w + xi) * 4, o = (y * w + x) * 4;
    out[o] = src.px[s]; out[o + 1] = src.px[s + 1]; out[o + 2] = src.px[s + 2]; out[o + 3] = src.px[s + 3];
  };
  if (b === 0 && d === 0) {
    // ImagingScaleAffine: kąty 0°/180°
    const coord = (v: number) => (v < 0 ? -1 : Math.trunc(v));
    for (let y = 0; y < h; y++) {
      const yi = coord(e * (y + 0.5) + f);
      for (let x = 0; x < w; x++) copy(x, y, coord(a * (x + 0.5) + c), yi);
    }
  } else {
    // affine_fixed: arytmetyka 16.16
    const FIX = (v: number) => Math.floor(v * 65536 + 0.5);
    const a0 = FIX(a), a1 = FIX(b), a3 = FIX(d), a4 = FIX(e);
    let a2 = FIX(c + a * 0.5 + b * 0.5), a5 = FIX(f + d * 0.5 + e * 0.5);
    for (let y = 0; y < h; y++) {
      let xx = a2, yy = a5;
      for (let x = 0; x < w; x++) {
        copy(x, y, Math.floor(xx / 65536), Math.floor(yy / 65536));
        xx += a0; yy += a3;
      }
      a2 += a1; a5 += a4;
    }
  }
  return { w, h, px: out };
}

// ------------------------------------------------------------------ składanie
const blank = (w: number, h: number): Img => ({ w, h, px: new Uint8ClampedArray(w * h * 4) });
/** SHIFTFORDIV255 z Pillow */
const div255 = (a: number) => ((a >> 8) + a) >> 8;

/** alpha_composite (Pillow, ImagingAlphaComposite) src na dst w (x, y); pełne piksele to zwykła kopia */
function blit(dst: Img, src: Img, x: number, y: number, sx = 0, sy = 0, sw = src.w, sh = src.h) {
  for (let j = 0; j < sh; j++) {
    const ty = y + j;
    if (ty < 0 || ty >= dst.h) continue;
    for (let i = 0; i < sw; i++) {
      const tx = x + i;
      if (tx < 0 || tx >= dst.w) continue;
      const s = ((sy + j) * src.w + sx + i) * 4;
      const sa = src.px[s + 3];
      if (!sa) continue;
      const o = (ty * dst.w + tx) * 4;
      const da = dst.px[o + 3];
      if (sa === 255 || !da) {
        dst.px[o] = src.px[s]; dst.px[o + 1] = src.px[s + 1]; dst.px[o + 2] = src.px[s + 2]; dst.px[o + 3] = sa;
        continue;
      }
      // półprzezroczysty piksel (np. zarost) na pikselu nieprzezroczystym – arytmetyka Pillow (PRECISION_BITS = 7)
      const outa = sa * 255 + da * (255 - sa);
      const coef1 = Math.floor((sa * 255 * 255 * 128) / outa), coef2 = 255 * 128 - coef1;
      for (let ch = 0; ch < 3; ch++) dst.px[o + ch] = div255(src.px[s + ch] * coef1 + dst.px[o + ch] * coef2 + (0x80 << 7)) >> 7;
      dst.px[o + 3] = div255(outa + 0x80);
    }
  }
}

/** sprite obracany wokół pivota (miecz, hełm, łuk, strzała): jak rot() we wzorcu – płótno 3×większe, obrót wokół środka */
function rotated(spr: Img, pv: [number, number], ang: number): { img: Img; c: number } {
  const W = Math.max(spr.w, spr.h) * 3, half = Math.floor(W / 2);
  const cv = blank(W, W);
  blit(cv, spr, half - pv[0], half - pv[1]);
  return { img: pilRotate(cv, -ang, half, half), c: half };
}

/** linia 1 px (Bresenham) – cięciwa */
function line(dst: Img, x0: number, y0: number, x1: number, y1: number, rgb: number[]) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 >= 0 && y0 >= 0 && x0 < dst.w && y0 < dst.h) { const o = (y0 * dst.w + x0) * 4; dst.px[o] = rgb[0]; dst.px[o + 1] = rgb[1]; dst.px[o + 2] = rgb[2]; dst.px[o + 3] = 255; }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** punkt sprite'a (lx, ly) po obrocie o kąt ekranowy wokół pivota umieszczonego w (px, py) */
const rotPt = (lx: number, ly: number, pv: [number, number], ang: number, px: number, py: number): [number, number] => {
  const r = (ang * Math.PI) / 180, x = lx - pv[0], y = ly - pv[1];
  return [px + x * Math.cos(r) - y * Math.sin(r), py + x * Math.sin(r) + y * Math.cos(r)];
};

/** warstwa wyglądu po zmianach koloru (cache w A.cache) */
function prepared(A: DollAssets, file: string, variant: string, make: () => Img): Img {
  A.cache ??= new Map();
  const k = file + '|' + variant;
  let v = A.cache.get(k);
  if (!v) { v = make(); A.cache.set(k, v); }
  return v;
}

/** łuk + cięciwa + strzała w lewej ręce (docs/CHARACTER_SPEC.md, „Łuk i animacja strzału”) */
function drawBow(A: DollAssets, c: Img, bow: ItemDef, d: Dir8, f: AnchorFrame, shoot: boolean) {
  const pv = bow.pivot ?? [3, 11];
  // poza strzałem łuk trzymany w lewej ręce za majdan, pionowo z lekkim pochyleniem, brzuścem w stronę patrzenia
  const back = Math.cos((f.hand_l.angle * Math.PI) / 180) < -0.01;
  const ang = shoot ? f.hand_l.angle : back ? 180 + 12 : -12;
  // w ręce łuk zwisa niżej (dłoń w górnej części majdanu), żeby górny koniec nie zasłaniał twarzy
  const gx = f.hand_l.x + PAD, gy = f.hand_l.y + PAD + (shoot ? 0 : 5);
  const { img, c: pc } = rotated(A.images[bow.files[d]], pv, ang);
  blit(c, img, gx - pc, gy - pc);
  const t0 = rotPt(1, 0, pv, ang, gx, gy), t1 = rotPt(1, 22, pv, ang, gx, gy);
  const i = f.index;
  if (shoot && (i === 1 || i === 2)) {
    const hx = f.hand_r.x + PAD, hy = f.hand_r.y + PAD;
    line(c, t0[0], t0[1], hx, hy, STRING_RGB); line(c, t1[0], t1[1], hx, hy, STRING_RGB);
  } else line(c, t0[0], t0[1], t1[0], t1[1], shoot ? STRING_RGB : STRING_REST);
  if (shoot && i <= 2 && bow.ammo) {
    const r = (ang * Math.PI) / 180;
    const [nx, ny] = i === 0 ? [gx - 12 * Math.cos(r), gy - 12 * Math.sin(r)] : [f.hand_r.x + PAD, f.hand_r.y + PAD];
    const { img: ar, c: ac } = rotated(A.images[bow.ammo], [0, 1], ang);
    blit(c, ar, Math.round(nx) - ac, Math.round(ny) - ac);
  }
}

/** jedna klatka 82×93 (komórka 42×63 w (20, 20)), dokładnie jak frame() w tools/compose_preview.py;
 *  sheet = 'shoot' – klatka strzału z łuku (4 klatki, osobne arkusze) */
export function composeFrame(A: DollAssets, look: Appearance, eq0: Equipment, d: Dir8, i: number, sheet: Sheet = 'anim'): Img {
  const reg = A.reg, B = look.gender === 'female' ? reg.body_female : reg.body;
  const shoot = sheet === 'shoot';
  const f = A.anchors[(shoot ? B.shoot.anchors : B.anchors)[d]].frames[i];
  const eq = effectiveEquipment(reg, eq0);
  const c = blank(CANVAS_W, CANVAS_H);
  const F = appearanceFiles(reg.appearance, look, d, sheet);
  const order = drawOrder(f, eq, { beard: !!F.beard, ears: !!F.ears, bow: isBow(itemOf(reg, eq.weapon)), shoot, back: d.startsWith('N') });
  // przesunięcie tarczy z pliku punktów zaczepienia mężczyzny (jak we wzorcu – wartości są wspólne dla obu płci)
  const baseAnchors = A.anchors[reg.body.anchors[d]];
  const layerAt = (img: Img, x: number, y: number) => { const l = blank(CANVAS_W, CANVAS_H); blit(l, img, x, y); return l; };
  let weaponL: Img | null = null, shieldL: Img | null = null;
  const weapon = itemOf(reg, eq.weapon), shield = itemOf(reg, eq.shield), helmet = itemOf(reg, eq.helmet), boots = itemOf(reg, eq.boots);
  if (weapon && !isBow(weapon)) {
    const { img, c: pc } = rotated(A.images[weapon.files[d]], weapon.pivot ?? [0, 0], f.hand_r.angle);
    weaponL = layerAt(img, f.hand_r.x + PAD - pc, f.hand_r.y + PAD - pc);
  }
  if (shield) {
    const file = shield.files[d], s = A.images[file];
    const off = baseAnchors.items[file]?.center_offset_from_hand_l ?? [0, 0];
    shieldL = layerAt(s, f.hand_l.x + PAD + off[0] - Math.floor(s.w / 2), f.hand_l.y + PAD + off[1] - Math.floor(s.h / 2));
  }
  const cell = (img: Img) => blit(c, img, PAD, PAD, CELL_W * i, 0, CELL_W, CELL_H);
  const hairImg = (file: string, color: string) => prepared(A, file, color, () => recolor(A.images[file], A.pal, color));
  for (const L of order) {
    if (L === 'hair_back') cell(hairImg(F.hairBack, look.hairColor));
    else if (L === 'shield' && shieldL) blit(c, shieldL, 0, 0);
    else if (L === 'weapon' && weaponL) blit(c, weaponL, 0, 0);
    else if (L === 'bow' && weapon) drawBow(A, c, weapon, d, f, shoot);
    else if (L === 'body') cell(prepared(A, F.body, look.skin, () => reskin(A.images[F.body], A.images[F.elfBody], look.race, look.skin)));
    else if (L === 'boots' && boots) cell(A.images[boots.files[d]]);
    else if (L === 'beard' && F.beard) cell(hairImg(F.beard, look.beardColor));
    else if (L === 'hair_front') cell(hairImg(F.hairFront, look.hairColor));
    else if (L === 'ears' && F.ears) cell(prepared(A, F.ears, look.skin, () => reskin(A.images[F.ears!], A.images[F.ears!], 'elf', look.skin)));
    else if (L === 'helmet' && helmet) {
      const { img, c: pc } = rotated(A.images[helmet.files[d]], helmet.pivot ?? [0, 0], f.head.angle);
      blit(c, img, f.head.x + PAD - pc, f.head.y + PAD - pc);
    } else if (L === 'weapon_clip' && weaponL && shieldL) {
      // miecz przycięty do pikseli tarczy: nad tarczą, ale nadal za ciałem
      const clip = blank(CANVAS_W, CANVAS_H);
      for (let k = 3; k < clip.px.length; k += 4) {
        const al = Math.round((weaponL.px[k] * shieldL.px[k]) / 255);
        if (al) { clip.px[k - 3] = weaponL.px[k - 3]; clip.px[k - 2] = weaponL.px[k - 2]; clip.px[k - 1] = weaponL.px[k - 1]; clip.px[k] = al; }
      }
      blit(c, clip, 0, 0);
    }
  }
  return c;
}

// ------------------------------------------------------------------ klatki do gry
/** nazwy klatek gry → [arkusz, indeks] (animacje z items.json) */
export function frameNames(reg: Registry, bow: boolean): [string, Sheet, number][] {
  const A = reg.animations, out: [string, Sheet, number][] = [];
  const add = (prefix: string, frames: number[], sheet: Sheet = 'anim') => frames.forEach((fi, k) => out.push([`${prefix}${k}`, sheet, fi]));
  add('idle', A.idle.frames); add('walk', A.walk.frames); add('atk', A.attack.frames);
  add('sit', A.sit.frames); add('pow', A.power_strike.frames);
  if (bow) add('shoot', A.shoot.frames, 'shoot');
  out.push(['dead', 'anim', A.death.frames[0]]);
  return out;
}

/** wszystkie klatki postaci: hero_<DIR>_<anim><k> (8 kierunków), hero_<DIR>_dead, z łukiem także hero_<DIR>_shoot<k>;
 *  kotwica w stopach */
export function buildFrames(A: DollAssets, look: Appearance, eq: Equipment, prefix = 'hero'): CharFrames {
  const data = new Map<string, FrameData>();
  const names = frameNames(A.reg, isBow(itemOf(A.reg, eq.weapon)));
  for (const d of DIRS8) {
    const cache = new Map<string, FrameData>();
    for (const [n, sheet, fi] of names) {
      const key = sheet + fi;
      let fd = cache.get(key);
      if (!fd) {
        fd = trim(composeFrame(A, look, eq, d, fi, sheet), FEET[0] + PAD, FEET[1] + PAD);
        cache.set(key, fd);
      }
      data.set(`${prefix}_${d}_${n}`, fd);
    }
  }
  return { names: [...data.keys()], data };
}

/** przycięcie klatki do zajętych pikseli (mniejszy prostokąt – dokładniejsze wykrywanie zasłaniania); kotwica przesunięta */
export function trim(img: Img, ax: number, ay: number): FrameData {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (!img.px[(y * img.w + x) * 4 + 3]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { w: 1, h: 1, ax: 0, ay: 0, px: new Uint8ClampedArray(4) };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) px.set(img.px.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x1 + 1) * 4), y * w * 4);
  return { w, h, ax: ax - x0, ay: ay - y0, px };
}

/** ekwipunek gry (poziomy przedmiotów w slotach) → sloty postaci; brak odpowiednika = null.
 *  Wojownik: krótki miecz; łowca: krótki łuk (dwuręczny – bez tarczy). */
export function equipmentFromGear(cls: string, gear: { weapon: number; shield: number; helm: number; boots: number }): Equipment {
  const bow = cls === 'hunter' && gear.weapon > 0;
  return {
    weapon: gear.weapon > 0 ? (cls === 'hunter' ? 'bow_short' : 'sword_short') : null,
    shield: gear.shield > 0 && !bow ? 'shield_round' : null,
    helmet: gear.helm > 0 ? 'helmet_spangen' : null,
    boots: gear.boots > 0 ? 'boots_leather' : null,
  };
}

/** pliki wspólne (przedmioty, punkty zaczepienia obu płci) */
export function commonFiles(reg: Registry): { images: string[]; anchors: string[] } {
  const images = new Set<string>(), anchors = new Set<string>();
  for (const B of [reg.body, reg.body_female]) for (const d of DIRS8) { anchors.add(B.anchors[d]); anchors.add(B.shoot.anchors[d]); }
  for (const it of reg.items) { for (const d of DIRS8) images.add(it.files[d]); if (it.ammo) images.add(it.ammo); }
  return { images: [...images], anchors: [...anchors] };
}

/** obrazy wyglądu potrzebne dla danej postaci (8 kierunków, oba arkusze) */
export function lookFiles(reg: Registry, look: Appearance): string[] {
  const out = new Set<string>();
  for (const d of DIRS8) for (const sh of ['anim', 'shoot'] as Sheet[]) {
    const F = appearanceFiles(reg.appearance, look, d, sh);
    for (const f of [F.body, F.elfBody, F.hairBack, F.hairFront, F.beard, F.ears]) if (f) out.add(f);
  }
  return [...out];
}

/** wszystkie pliki wyglądu z rejestru (test: każda kombinacja ma komplet plików) */
export function allLookFiles(reg: Registry): string[] {
  const AP = reg.appearance, out = new Set<string>();
  for (const gender of AP.genders) for (const race of AP.races) for (const hair of AP.hair_styles[gender]) {
    const beards = gender === 'male' && AP.beard_races.includes(race) ? AP.beard_styles[gender] : ['none'];
    for (const beard of beards) for (const f of lookFiles(reg, { gender, race, hair, beard, skin: raceSkin(race), hairColor: 'brown', beardColor: 'brown' })) out.add(f);
  }
  return [...out];
}
