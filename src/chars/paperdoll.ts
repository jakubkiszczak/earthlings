// Postać gracza „paper doll”: ciało (mężczyzna / kobieta) + wymienne wyposażenie (miecz, tarcza, hełm, buty),
// 8 kierunków × 15 klatek, bez odbić lustrzanych (tarcza zawsze w lewej ręce). Źródło prawdy: docs/CHARACTER_SPEC.md,
// assets/art/sprites/items.json i *_anchors.json; wzorzec: tools/compose_preview.py.
//
// Warstwy składamy na CPU w gotowe klatki (FrameData → CharSheet), zamiast trzymać w grze kontener z wieloma
// sprite'ami: (1) system konturów zasłoniętych postaci (Xray) potrzebuje jednej tekstury na klatkę, (2) obrót
// odtwarza dokładnie Pillow (NEAREST, arytmetyka stałoprzecinkowa), więc obraz jest identyczny co do piksela ze wzorcem.
// Kolejność warstw i zasada „miecz zawsze przed tarczą” – drawOrder().
import type { CharFrames, FrameData } from './chargen';

export const DIRS8 = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'] as const;
export type Dir8 = (typeof DIRS8)[number];
export type Gender = 'male' | 'female';
export type Slot = 'weapon' | 'shield' | 'helmet' | 'boots';
export type Equipment = Record<Slot, string | null>;
export const NO_EQUIPMENT: Equipment = { weapon: null, shield: null, helmet: null, boots: null };

/** obraz RGBA (piksele w kolejności wierszy) */
export interface Img { w: number; h: number; px: Uint8ClampedArray }

interface Point { x: number; y: number; angle: number }
export type ZOrder = 'front' | 'behind';
export interface AnchorFrame { index: number; anim: string; hand_r: Point; hand_l: Point; head: Point; z: { weapon: ZOrder; shield: ZOrder } }
export interface AnchorFile { direction: Dir8; frames: AnchorFrame[]; items: Record<string, { center_offset_from_hand_l?: [number, number] }> }

export interface ItemDef {
  id: string; slot: Slot; attach?: 'hand_r' | 'hand_l' | 'head'; rotate?: boolean; pivot?: [number, number];
  type?: 'full_frame_overlay'; files: Record<Dir8, string>;
}
interface BodyDef { nohair: Record<Dir8, string>; hair: Record<Dir8, string> | null; anchors: Record<Dir8, string> }
export interface Registry {
  cell: [number, number]; feet_anchor: [number, number]; directions: Dir8[]; items: ItemDef[];
  body: BodyDef; body_female: BodyDef;
  animations: Record<'idle' | 'walk' | 'attack' | 'sit' | 'power_strike' | 'death', { frames: number[]; fps: number; loop: boolean; then?: string }>;
}

/** wszystko, czego potrzeba do składania: rejestr, punkty zaczepienia (pliki → dane) i obrazy (pliki → piksele) */
export interface DollAssets { reg: Registry; anchors: Record<string, AnchorFile>; images: Record<string, Img> }

export const CELL_W = 42, CELL_H = 63, FEET: [number, number] = [21, 62];
/** płótno klatki jak we wzorcu: 82×93, komórka 42×63 przesunięta o (20, 20) – miejsce na wystający miecz */
export const CANVAS_W = 82, CANVAS_H = 93, PAD = 20;
const DEATH_FRAME = 14;

// ------------------------------------------------------------------ kierunek
/** wektor na ekranie (dx w prawo, dy w dół) → jeden z 8 kierunków, sektory po 45°, S = w dół ekranu */
export function dirFromVector(dx: number, dy: number): Dir8 {
  const oct = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;   // 0 = E, 2 = S (zgodnie z ruchem wskazówek)
  return (['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const)[oct];
}

// ------------------------------------------------------------------ kolejność rysowania
export type Layer = 'shield' | 'weapon' | 'body' | 'boots' | 'hair' | 'helmet' | 'weapon_clip';

/** kolejność warstw w klatce (docs/CHARACTER_SPEC.md): tarcza(za) → miecz(za) → ciało → buty → włosy → hełm →
 *  tarcza(przed) → miecz(przed) → [miecz przycięty do tarczy, gdy miecz za ciałem, a tarcza przed nim] */
export function drawOrder(f: Pick<AnchorFrame, 'index' | 'z'>, eq: Equipment, hasHair: boolean): Layer[] {
  const out: Layer[] = [];
  const zw = f.z.weapon, zs = f.z.shield;
  if (eq.shield && zs === 'behind') out.push('shield');
  if (eq.weapon && zw === 'behind') out.push('weapon');
  out.push('body');
  if (eq.boots) out.push('boots');
  if (hasHair) out.push('hair');
  if (eq.helmet && f.index !== DEATH_FRAME) out.push('helmet');
  if (eq.shield && zs === 'front') out.push('shield');
  if (eq.weapon && zw === 'front') out.push('weapon');
  if (eq.weapon && eq.shield && zw === 'behind' && zs === 'front') out.push('weapon_clip');
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

/** nakłada src na dst w (x, y) – piksele pixel artu są pełne albo puste, więc „over” to kopia nieprzezroczystych */
function blit(dst: Img, src: Img, x: number, y: number, sx = 0, sy = 0, sw = src.w, sh = src.h) {
  for (let j = 0; j < sh; j++) {
    const ty = y + j;
    if (ty < 0 || ty >= dst.h) continue;
    for (let i = 0; i < sw; i++) {
      const tx = x + i;
      if (tx < 0 || tx >= dst.w) continue;
      const s = ((sy + j) * src.w + sx + i) * 4;
      if (!src.px[s + 3]) continue;
      const o = (ty * dst.w + tx) * 4;
      dst.px[o] = src.px[s]; dst.px[o + 1] = src.px[s + 1]; dst.px[o + 2] = src.px[s + 2]; dst.px[o + 3] = src.px[s + 3];
    }
  }
}

/** sprite obracany wokół pivota (miecz, hełm): jak rot() we wzorcu – płótno 3×większe, obrót wokół środka */
function rotated(spr: Img, pv: [number, number], ang: number): { img: Img; c: number } {
  const W = Math.max(spr.w, spr.h) * 3, half = Math.floor(W / 2);
  const cv = blank(W, W);
  blit(cv, spr, half - pv[0], half - pv[1]);
  return { img: pilRotate(cv, -ang, half, half), c: half };
}

const itemOf = (reg: Registry, id: string | null) => (id ? reg.items.find((i) => i.id === id) ?? null : null);

/** jedna klatka 82×93 (komórka 42×63 w (20, 20)), dokładnie jak frame() w tools/compose_preview.py */
export function composeFrame(A: DollAssets, gender: Gender, eq: Equipment, d: Dir8, i: number): Img {
  const reg = A.reg, B = gender === 'female' ? reg.body_female : reg.body;
  const f = A.anchors[B.anchors[d]].frames[i];
  const c = blank(CANVAS_W, CANVAS_H);
  const order = drawOrder(f, eq, !!B.hair);
  // przesunięcie tarczy z pliku punktów zaczepienia mężczyzny (jak we wzorcu – wartości są wspólne dla obu płci)
  const baseAnchors = A.anchors[reg.body.anchors[d]];
  const layerAt = (img: Img, x: number, y: number) => { const l = blank(CANVAS_W, CANVAS_H); blit(l, img, x, y); return l; };
  let weaponL: Img | null = null, shieldL: Img | null = null;
  const weapon = itemOf(reg, eq.weapon), shield = itemOf(reg, eq.shield), helmet = itemOf(reg, eq.helmet), boots = itemOf(reg, eq.boots);
  if (weapon) {
    const { img, c: pc } = rotated(A.images[weapon.files[d]], weapon.pivot ?? [0, 0], f.hand_r.angle);
    weaponL = layerAt(img, f.hand_r.x + PAD - pc, f.hand_r.y + PAD - pc);
  }
  if (shield) {
    const file = shield.files[d], s = A.images[file];
    const off = baseAnchors.items[file]?.center_offset_from_hand_l ?? [0, 0];
    shieldL = layerAt(s, f.hand_l.x + PAD + off[0] - Math.floor(s.w / 2), f.hand_l.y + PAD + off[1] - Math.floor(s.h / 2));
  }
  const cell = (file: string) => blit(c, A.images[file], PAD, PAD, CELL_W * i, 0, CELL_W, CELL_H);
  for (const L of order) {
    if (L === 'shield' && shieldL) blit(c, shieldL, 0, 0);
    else if (L === 'weapon' && weaponL) blit(c, weaponL, 0, 0);
    else if (L === 'body') cell(B.nohair[d]);
    else if (L === 'boots' && boots) cell(boots.files[d]);
    else if (L === 'hair' && B.hair) cell(B.hair[d]);
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
/** nazwy klatek gry → indeks w arkuszu (animacje z items.json) */
export function frameNames(reg: Registry): [string, number][] {
  const A = reg.animations, out: [string, number][] = [];
  const add = (prefix: string, frames: number[]) => frames.forEach((fi, k) => out.push([`${prefix}${k}`, fi]));
  add('idle', A.idle.frames); add('walk', A.walk.frames); add('atk', A.attack.frames);
  add('sit', A.sit.frames); add('pow', A.power_strike.frames);
  out.push(['dead', A.death.frames[0]]);
  return out;
}

/** wszystkie klatki postaci: hero_<DIR>_<anim><k> (8 kierunków), hero_<DIR>_dead; kotwica w stopach */
export function buildFrames(A: DollAssets, gender: Gender, eq: Equipment, prefix = 'hero'): CharFrames {
  const data = new Map<string, FrameData>();
  const names = frameNames(A.reg);
  for (const d of DIRS8) {
    const cache = new Map<number, FrameData>();
    for (const [n, fi] of names) {
      let fd = cache.get(fi);
      if (!fd) {
        const img = composeFrame(A, gender, eq, d, fi);
        fd = { w: img.w, h: img.h, ax: FEET[0] + PAD, ay: FEET[1] + PAD, px: img.px };
        cache.set(fi, fd);
      }
      data.set(`${prefix}_${d}_${n}`, fd);
    }
  }
  return { names: [...data.keys()], data };
}

/** ekwipunek gry (poziomy przedmiotów w slotach) → 4 sloty postaci; brak odpowiednika = null */
export function equipmentFromGear(cls: string, gear: { weapon: number; shield: number; helm: number; boots: number }): Equipment {
  return {
    weapon: cls === 'warrior' && gear.weapon > 0 ? 'sword_short' : null,     // łuku jeszcze nie ma w paczce
    shield: gear.shield > 0 ? 'shield_round' : null,
    helmet: gear.helm > 0 ? 'helmet_spangen' : null,
    boots: gear.boots > 0 ? 'boots_leather' : null,
  };
}

/** lista plików do wczytania: obrazy i punkty zaczepienia */
export function filesOf(reg: Registry): { images: string[]; anchors: string[] } {
  const images = new Set<string>(), anchors = new Set<string>();
  for (const B of [reg.body, reg.body_female]) {
    for (const d of DIRS8) {
      images.add(B.nohair[d]);
      if (B.hair) images.add(B.hair[d]);
      anchors.add(B.anchors[d]);
    }
  }
  for (const it of reg.items) for (const d of DIRS8) images.add(it.files[d]);
  return { images: [...images], anchors: [...anchors] };
}
