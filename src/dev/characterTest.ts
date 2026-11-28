// Strona testowa postaci paper doll (dev/character-test.html): siatka 8×15, przełączniki płci, wyposażenia i animacji,
// jedna postać ×4 sterowana strzałkami/WASD, podgląd punktów zaczepienia.
import { assetUrl, loadImage, readPixels } from '../assets';
import { composeFrame, dirFromVector, DIRS8, filesOf, CANVAS_W, CANVAS_H, PAD, type Dir8, type DollAssets, type Equipment, type Gender, type Registry } from '../chars/paperdoll';

const qs = new URLSearchParams(location.search);
const SCALE = Number(qs.get('scale') ?? 2), BG = qs.get('bg') !== '0';
const DIR = 'art/sprites/';

async function load(): Promise<DollAssets> {
  const reg = (await (await fetch(assetUrl(DIR + 'items.json'))).json()) as Registry;
  const { images, anchors } = filesOf(reg);
  const A: DollAssets = { reg, anchors: {}, images: {} };
  await Promise.all([
    ...anchors.map(async (a) => { A.anchors[a] = await (await fetch(assetUrl(DIR + a))).json(); }),
    ...images.map(async (i) => { const img = await loadImage(assetUrl(DIR + i)); A.images[i] = { w: img.width, h: img.height, px: readPixels(img) }; }),
  ]);
  return A;
}

const A = await load();
const state = { gender: 'male' as Gender, eq: { weapon: 'sword_short', shield: 'shield_round', helmet: 'helmet_spangen', boots: 'boots_leather' } as Equipment, anim: 'walk', dots: false };
const ui = document.getElementById('ui')!;
const sel = (label: string, opts: [string, string][], get: () => string, set: (v: string) => void) => {
  const l = document.createElement('label'); l.textContent = label;
  const s = document.createElement('select');
  for (const [v, n] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = n; s.append(o); }
  s.value = get(); s.addEventListener('change', () => { set(s.value); drawGrid(); });
  l.append(s); ui.append(l);
};
sel('Płeć', [['male', 'mężczyzna'], ['female', 'kobieta']], () => state.gender, (v) => { state.gender = v as Gender; });
const itemsBySlot = (slot: string) => [['', '— brak —'] as [string, string], ...A.reg.items.filter((i) => i.slot === slot).map((i) => [i.id, i.id] as [string, string])];
for (const slot of ['weapon', 'shield', 'helmet', 'boots'] as const) {
  sel(slot, itemsBySlot(slot), () => state.eq[slot] ?? '', (v) => { state.eq[slot] = v || null; });
}
sel('Animacja', Object.keys(A.reg.animations).map((k) => [k, k]), () => state.anim, (v) => { state.anim = v; });
const dl = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox';
cb.addEventListener('change', () => { state.dots = cb.checked; drawGrid(); }); dl.append(cb, 'punkty zaczepienia'); ui.append(dl);

const frameCanvas = (d: Dir8, i: number) => {
  const f = composeFrame(A, state.gender, state.eq, d, i);
  const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(f.px), f.w, f.h), 0, 0);
  return c;
};

const grid = document.getElementById('grid') as HTMLCanvasElement;
function drawGrid() {
  grid.width = CANVAS_W * 15 * SCALE; grid.height = CANVAS_H * 8 * SCALE;
  const g = grid.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  if (BG) { g.fillStyle = 'rgb(46,72,44)'; g.fillRect(0, 0, grid.width, grid.height); } else g.clearRect(0, 0, grid.width, grid.height);
  const B = state.gender === 'female' ? A.reg.body_female : A.reg.body;
  DIRS8.forEach((d, r) => {
    for (let i = 0; i < 15; i++) {
      const x = i * CANVAS_W * SCALE, y = r * CANVAS_H * SCALE;
      g.drawImage(frameCanvas(d, i), x, y, CANVAS_W * SCALE, CANVAS_H * SCALE);
      if (state.dots) {
        const f = A.anchors[B.anchors[d]].frames[i];
        for (const [p, col] of [[f.hand_r, '#ff3030'], [f.hand_l, '#3a7aff'], [f.head, '#30e040']] as const) {
          g.fillStyle = col; g.fillRect(x + (p.x + PAD) * SCALE, y + (p.y + PAD) * SCALE, SCALE, SCALE);
        }
      }
    }
  });
}
drawGrid();

// jedna postać ×4 sterowana klawiaturą
const one = document.getElementById('one') as HTMLCanvasElement;
one.width = CANVAS_W * 4; one.height = CANVAS_H * 4;
const keys = new Set<string>();
addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let dir: Dir8 = 'S', t = 0, last = performance.now();
const cache = new Map<string, HTMLCanvasElement>();
function tick(now: number) {
  t += (now - last) / 1000; last = now;
  const dx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
  const dy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
  const moving = dx || dy;
  if (moving) dir = dirFromVector(dx, dy);
  const an = A.reg.animations[(moving ? 'walk' : state.anim) as keyof Registry['animations']];
  const k = an.loop ? Math.floor(t * an.fps) % an.frames.length : Math.min(an.frames.length - 1, Math.floor(t * an.fps) % (an.frames.length + 3));
  const fi = an.frames[k];
  const key = `${state.gender}|${JSON.stringify(state.eq)}|${dir}|${fi}`;
  let c = cache.get(key);
  if (!c) { c = frameCanvas(dir, fi); cache.set(key, c); }
  const g = one.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgb(46,72,44)'; g.fillRect(0, 0, one.width, one.height);
  g.drawImage(c, PAD, PAD, 42, 63, 0, 0, 42 * 4, 63 * 4);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
