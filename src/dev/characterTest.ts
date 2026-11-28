// Strona testowa postaci paper doll (dev/character-test.html): siatka 8×15 (albo 8×4 dla strzału), przełączniki wyglądu
// (płeć, rasa, kolor skóry, fryzura, broda, kolory), wyposażenia i animacji; jedna postać ×4 sterowana strzałkami/WASD,
// podgląd punktów zaczepienia. Parametry adresu: ?scale=1&bg=0 (zrzut), &gender=&race=&hair=&hairColor=&beard=&beardColor=&skin=&helmet=0
import { dollAssets, loadDoll, prepareLook } from '../chars/doll';
import {
  composeFrame, dirFromVector, DIRS8, CANVAS_W, CANVAS_H, PAD, SKINS, normalizeAppearance,
  type Appearance, type Dir8, type Equipment, type Registry, type Sheet,
} from '../chars/paperdoll';

const qs = new URLSearchParams(location.search);
const SCALE = Number(qs.get('scale') ?? 2), BG = qs.get('bg') !== '0';
await loadDoll();
const A = dollAssets()!;
const AP = A.reg.appearance;
const state = {
  look: normalizeAppearance(AP, Object.fromEntries(qs) as Partial<Appearance>),
  eq: { weapon: 'sword_short', shield: 'shield_round', helmet: qs.get('helmet') === '0' ? null : 'helmet_spangen', boots: 'boots_leather' } as Equipment,
  anim: 'walk', dots: false,
};
const ui = document.getElementById('ui')!;
const sels: (() => void)[] = [];
const sel = (label: string, opts: () => [string, string][], get: () => string, set: (v: string) => void) => {
  const l = document.createElement('label'); l.textContent = label;
  const s = document.createElement('select');
  const fillOpts = () => {
    s.innerHTML = '';
    for (const [v, n] of opts()) { const o = document.createElement('option'); o.value = v; o.textContent = n; s.append(o); }
    s.value = get();
  };
  fillOpts(); sels.push(fillOpts);
  s.addEventListener('change', () => { set(s.value); void redraw(); });
  l.append(s); ui.append(l);
};
const L = (xs: string[]) => xs.map((x) => [x, x] as [string, string]);
const setLook = (p: Partial<Appearance>) => { state.look = normalizeAppearance(AP, { ...state.look, ...p }); };
sel('Płeć', () => L(AP.genders), () => state.look.gender, (v) => setLook({ gender: v as Appearance['gender'], hair: undefined }));
sel('Rasa', () => L(AP.races), () => state.look.race, (v) => setLook({ race: v as Appearance['race'], skin: undefined }));
sel('Skóra', () => L(SKINS), () => state.look.skin, (v) => setLook({ skin: v as Appearance['skin'] }));
sel('Fryzura', () => L(AP.hair_styles[state.look.gender]), () => state.look.hair, (v) => setLook({ hair: v }));
sel('Kolor włosów', () => L(AP.colors), () => state.look.hairColor, (v) => setLook({ hairColor: v }));
sel('Broda', () => L(AP.beard_styles[state.look.gender]), () => state.look.beard, (v) => setLook({ beard: v }));
sel('Kolor brody', () => L(AP.colors), () => state.look.beardColor, (v) => setLook({ beardColor: v }));
const itemsBySlot = (slot: string) => [['', '— brak —'] as [string, string], ...A.reg.items.filter((i) => i.slot === slot).map((i) => [i.id, i.id] as [string, string])];
for (const slot of ['weapon', 'shield', 'helmet', 'boots'] as const) {
  sel(slot, () => itemsBySlot(slot), () => state.eq[slot] ?? '', (v) => { state.eq[slot] = v || null; });
}
sel('Animacja', () => L(Object.keys(A.reg.animations)), () => state.anim, (v) => { state.anim = v; });
const dl = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox';
cb.addEventListener('change', () => { state.dots = cb.checked; void redraw(); }); dl.append(cb, 'punkty zaczepienia'); ui.append(dl);

const sheetOf = (): Sheet => (state.anim === 'shoot' ? 'shoot' : 'anim');
const frameCanvas = (d: Dir8, i: number, sheet: Sheet) => {
  const f = composeFrame(A, state.look, state.eq, d, i, sheet);
  const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(f.px), f.w, f.h), 0, 0);
  return c;
};

const grid = document.getElementById('grid') as HTMLCanvasElement;
async function redraw() {
  for (const f of sels) f();
  await prepareLook(state.look);
  cache.clear();
  const sheet = sheetOf(), n = sheet === 'shoot' ? 4 : 15;
  grid.width = CANVAS_W * n * SCALE; grid.height = CANVAS_H * 8 * SCALE;
  const g = grid.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  if (BG) { g.fillStyle = 'rgb(46,72,44)'; g.fillRect(0, 0, grid.width, grid.height); } else g.clearRect(0, 0, grid.width, grid.height);
  const B = state.look.gender === 'female' ? A.reg.body_female : A.reg.body;
  DIRS8.forEach((d, r) => {
    for (let i = 0; i < n; i++) {
      const x = i * CANVAS_W * SCALE, y = r * CANVAS_H * SCALE;
      g.drawImage(frameCanvas(d, i, sheet), x, y, CANVAS_W * SCALE, CANVAS_H * SCALE);
      if (state.dots) {
        const f = A.anchors[(sheet === 'shoot' ? B.shoot.anchors : B.anchors)[d]].frames[i];
        for (const [p, col] of [[f.hand_r, '#ff3030'], [f.hand_l, '#3a7aff'], [f.head, '#30e040']] as const) {
          g.fillStyle = col; g.fillRect(x + (p.x + PAD) * SCALE, y + (p.y + PAD) * SCALE, SCALE, SCALE);
        }
      }
    }
  });
  document.body.dataset.ready = '1';
}

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
  const name = (moving ? 'walk' : state.anim) as keyof Registry['animations'];
  const an = A.reg.animations[name];
  const k = an.loop ? Math.floor(t * an.fps) % an.frames.length : Math.min(an.frames.length - 1, Math.floor(t * an.fps) % (an.frames.length + 3));
  const fi = an.frames[k], sheet: Sheet = name === 'shoot' ? 'shoot' : 'anim';
  const key = `${dir}|${sheet}|${fi}`;
  let c = cache.get(key);
  if (!c && document.body.dataset.ready) { c = frameCanvas(dir, fi, sheet); cache.set(key, c); }
  const g = one.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgb(46,72,44)'; g.fillRect(0, 0, one.width, one.height);
  if (c) g.drawImage(c, PAD, PAD, 42, 63, 0, 0, 42 * 4, 63 * 4);
  requestAnimationFrame(tick);
}
await redraw();
requestAnimationFrame(tick);
