// Świat 3×3: bieżąca komórka + jej sąsiedzi (widok bez pustki przy krawędziach).
// Współrzędne gry są lokalne dla bieżącej komórki; sąsiedzi są przesunięci o (dx, dy) komórek.
// Przejście przez krawędź przestawia środek bez przeładowania obrazu (płynnie), brakujących sąsiadów doczytuje w tle.
import { Container, Graphics, ImageSource, Sprite, Texture } from 'pixi.js';
import { loadCell, type CellAssets } from '../assets';
import { subTexture, type Atlas } from '../render/atlas';
import { createWater } from '../render/water';
import type { CellInfo, CellMeta, WorldInfo } from '../types';
import { WorldGrid } from './grid';

/** zIndex w warstwie głębi: z = u + v (lokalnie), obiekty po terenie o tym samym z */
export const depthZ = (z: number, offset: number) => z * 10 + offset;

/** obiekt warstwy głębi: pozycja bazowa (w komórce), z, prostokąt względem pozycji (do wykrywania zasłaniania) */
export interface Item { obj: Container; x: number; y: number; z: number; bx0: number; by0: number; bx1: number; by1: number }

const BUCKET = 128;

interface LoadedCell {
  info: CellInfo;
  meta: CellMeta;
  assets: CellAssets;
  ground: Sprite;
  water: ReturnType<typeof createWater>;
  items: Item[];
  sway: { s: Sprite; ph: number; amp: number }[];
  /** poświata latarni i pochodni (migotanie) */
  glows: { g: Graphics; ph: number }[];
  /** pochodnie: sprite płomienia (2 klatki) */
  torches: { s: Sprite; ph: number; flag?: string }[];   // pochodnie (2 klatki), flagi i ogień w kominku (3 klatki, prefiks)
  /** dym z kominów */
  smokes: { g: Graphics; ph: number }[];
  sources: ImageSource[];
  grid?: WorldGrid;
}

const key = (cx: number, cy: number) => `${cx},${cy}`;
const INTERIOR_BASE = 100;

/** komórka doczytana, gdy środek już się przesunął dalej – pomijana */
class StaleCell extends Error {}

export class World {
  /** kontener świata: woda, grunt, warstwa głębi (pasma, obiekty, postacie) */
  readonly view = new Container();
  /** warstwa sortowana po głębi – tu trafiają też postacie i efekty */
  readonly layer = new Container();
  private readonly waterLayer = new Container();
  private readonly groundLayer = new Container();
  private readonly cells = new Map<string, LoadedCell>();
  private readonly loading = new Map<string, Promise<LoadedCell>>();
  cx = 0;
  cy = 0;
  /** środek, do którego zmierzamy (ustawiany przed wczytaniem – do odrzucania spóźnionych sąsiadów) */
  private want = { cx: 0, cy: 0 };

  /** komórki świata + wnętrza (wnętrza mają współrzędne 100+, daleko od świata – bez sąsiadów) */
  private readonly all: CellInfo[];

  constructor(readonly info: WorldInfo, private readonly atlas: Atlas) {
    this.all = [...info.cells];
    Object.entries(info.interiors ?? {}).forEach(([, it], i) => {
      this.all.push({ cx: INTERIOR_BASE + i, cy: INTERIOR_BASE, name: it.name, biome: 'interior', dir: it.dir });
    });
    this.layer.sortableChildren = true;
    this.view.addChild(this.waterLayer, this.groundLayer, this.layer);
  }

  get size() { return this.info.cellSize; }
  get gridSize() { return this.info.grid; }

  cellAt(cx: number, cy: number): CellInfo | undefined {
    return this.all.find((c) => c.cx === cx && c.cy === cy);
  }

  /** współrzędne komórki wnętrza o danym kluczu (np. 'shop') */
  interiorCell(name: string): { cx: number; cy: number } | undefined {
    const dir = this.info.interiors?.[name]?.dir;
    const c = this.all.find((x) => x.biome === 'interior' && x.dir === dir);
    return c && { cx: c.cx, cy: c.cy };
  }

  get inInterior(): boolean { return this.cx >= INTERIOR_BASE; }

  /** bieżąca komórka (zawsze wczytana) */
  get current(): LoadedCell { return this.cells.get(key(this.cx, this.cy))!; }
  get meta(): CellMeta { return this.current.meta; }
  get name(): string { return this.current.info.name; }

  /** siatka chodzenia bieżącej komórki (tworzona przy pierwszym użyciu) */
  get grid(): WorldGrid {
    const c = this.current;
    return (c.grid ??= new WorldGrid(c.meta, c.assets.img.walk, c.assets.img.pick));
  }

  isLoaded(cx: number, cy: number) { return this.cells.has(key(cx, cy)); }

  /** komórki aktualnie wczytane (bieżąca i sąsiedzi) */
  loadedCells(): { cx: number; cy: number; biome: string }[] {
    return [...this.cells.values()].map((c) => ({ cx: c.info.cx, cy: c.info.cy, biome: c.info.biome }));
  }

  /** siatka chodzenia dowolnej wczytanej komórki */
  gridAt(cx: number, cy: number): WorldGrid | null {
    const c = this.cells.get(key(cx, cy));
    if (!c) return null;
    return (c.grid ??= new WorldGrid(c.meta, c.assets.img.walk, c.assets.img.pick));
  }

  /** współrzędne globalne (teksele świata) → komórka i lokalne */
  private locate(gu: number, gv: number): { g: WorldGrid; u: number; v: number } | null {
    const C = this.size, cx = Math.floor(gu / C), cy = Math.floor(gv / C);
    const g = this.gridAt(cx, cy);
    return g ? { g, u: gu - cx * C, v: gv - cy * C } : null;
  }

  /** czy punkt globalny jest przechodni (komórka musi być wczytana) */
  walkableGlobal = (gu: number, gv: number): boolean => {
    const l = this.locate(gu, gv);
    return !!l && l.g.cellH(...l.g.cellOf(l.u, l.v)) > 0;
  };

  /** punkt globalny o znanej wysokości (np. obiekt poza siatką chodzenia) → piksel widoku */
  toScreenGlobalH(gu: number, gv: number, h: number): [number, number] {
    const u = gu - this.cx * this.size, v = gv - this.cy * this.size, M = this.meta;
    return [u - v + M.X0, Math.floor((u + v) / 2) - h + M.Y0];
  }

  /** punkt globalny → piksel widoku bieżącej komórki */
  toScreenGlobal(gu: number, gv: number): [number, number] {
    const l = this.locate(gu, gv);
    const u = gu - this.cx * this.size, v = gv - this.cy * this.size;
    const h = l ? l.g.heightAt(l.u, l.v) : 0;
    const M = this.meta;
    return [u - v + M.X0, Math.floor((u + v) / 2) - h + M.Y0];
  }

  /** Ustawia środek na (cx, cy): czeka na tę komórkę, sąsiadów doczytuje w tle. */
  async center(cx: number, cy: number): Promise<void> {
    this.want = { cx, cy };
    await this.ensure(cx, cy);
    this.cx = cx;
    this.cy = cy;
    // zwolnij komórki dalsze niż 1 od środka
    for (const [k, c] of this.cells) {
      if (Math.abs(c.info.cx - cx) > 1 || Math.abs(c.info.cy - cy) > 1) { this.unload(c); this.cells.delete(k); }
    }
    for (const c of this.cells.values()) this.place(c);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && this.cellAt(cx + dx, cy + dy)) {
        void this.ensure(cx + dx, cy + dy).catch((e) => { if (!(e instanceof StaleCell)) console.error(e); });
      }
    }
  }

  update(t: number, dt: number) {
    for (const c of this.cells.values()) {
      c.water.update(t, dt);
      for (const w of c.sway) w.s.x = Math.round(Math.sin(t * 1.3 + w.ph) * w.amp);
      for (const l of c.glows) l.g.alpha = 0.8 + 0.2 * Math.sin(t * 7.3 + l.ph) * Math.sin(t * 2.1 + l.ph * 2);
      for (const sm of c.smokes) {
        // dym z komina: kłęby unoszą się, rosną i znikają, wiatr znosi je w prawo
        const g = sm.g.clear();
        for (let i = 0; i < 9; i++) {
          const p = (t * 0.22 + i / 9 + sm.ph) % 1;
          const x = Math.sin(t * 0.9 + i * 1.7) * 2 + p * 16, y = -p * 64;
          g.circle(Math.round(x), Math.round(y), 2.5 + p * 7).fill({ color: p < 0.3 ? 0x8a8690 : 0xb8b4bc, alpha: 0.5 * (1 - p) * Math.min(1, p * 6) });
        }
      }
      for (const tc of c.torches) {
        if (tc.flag) this.atlas.setFrame(tc.s, `${tc.flag}_${Math.floor(t * 5 + tc.ph * 3) % 3}`);
        else this.atlas.setFrame(tc.s, Math.floor(t * 7 + tc.ph * 7) % 2 ? 'torch1' : 'torch0');
      }
    }
  }

  // ------------------------------------------------------------------ wczytywanie i rozmieszczenie
  private ensure(cx: number, cy: number): Promise<LoadedCell> {
    const k = key(cx, cy);
    const have = this.cells.get(k);
    if (have) return Promise.resolve(have);
    let p = this.loading.get(k);
    if (!p) {
      const info = this.cellAt(cx, cy);
      if (!info) return Promise.reject(new Error(`Brak komórki ${k}`));
      p = loadCell(info).then((assets) => {
        this.loading.delete(k);
        // w międzyczasie środek mógł odjechać – wtedy nie budujemy
        if (this.cells.size && (Math.abs(cx - this.want.cx) > 1 || Math.abs(cy - this.want.cy) > 1)) throw new StaleCell();
        const c = this.build(info, assets);
        this.cells.set(k, c);
        this.place(c);
        return c;
      });
      p.catch(() => this.loading.delete(k));
      this.loading.set(k, p);
    }
    return p;
  }

  private build(info: CellInfo, assets: CellAssets): LoadedCell {
    const meta = assets.meta, C = meta.size;
    const groundSrc = new ImageSource({ resource: assets.img.ground, scaleMode: 'nearest' });
    const bandsSrc = new ImageSource({ resource: assets.img.bands, scaleMode: 'nearest' });
    const ground = new Sprite(new Texture({ source: groundSrc }));
    const water = createWater(meta.W, meta.H, this.info.WA, this.info.BAYER, assets.img.water_a, assets.img.water_b);
    this.groundLayer.addChild(ground);
    this.waterLayer.addChild(water.sprite);
    const items: Item[] = [];
    for (const b of meta.bands) {
      const s = new Sprite(subTexture(bandsSrc, b.ax, b.ay, b.w, b.h));
      items.push({ obj: s, x: b.x, y: b.y, z: depthZ(b.z, 0), bx0: 0, by0: 0, bx1: b.w, by1: b.h });
    }
    // obiekty tylko z rdzenia komórki (margines pokazują sąsiedzi – bez podwójnych drzew)
    const sway: LoadedCell['sway'] = [];
    const glows: LoadedCell['glows'] = [];
    const torches: LoadedCell['torches'] = [];
    const smokes: LoadedCell['smokes'] = [];
    for (const e of meta.ents) {
      const a = e.x - meta.X0, u = (e.z + a) / 2, v = (e.z - a) / 2;
      if (u < 0 || v < 0 || u >= C || v >= C) continue;
      const c = new Container();
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const n of e.s) {
        const s = this.atlas.sprite(n);
        c.addChild(s);
        const f = this.atlas.frame(n);
        bx0 = Math.min(bx0, -f[4] - 2); by0 = Math.min(by0, -f[5]);
        bx1 = Math.max(bx1, f[2] - f[4] + 2); by1 = Math.max(by1, f[3] - f[5]);
        if (n.endsWith('_c') || e.k === 'bush') sway.push({ s, ph: e.ph ?? 0, amp: e.k === 'bush' ? 0.55 : 0.85 });
      }
      if (e.k === 'lamp' || e.k === 'torch') {
        const lamp = e.k === 'lamp';
        const g = new Graphics();
        g.blendMode = 'add';
        const ly = lamp ? -49 : -20;
        if (lamp) g.ellipse(1, 0, 28, 12).fill({ color: 0xffb040, alpha: 0.10 });
        g.circle(1, ly, lamp ? 18 : 14).fill({ color: 0xffc860, alpha: 0.10 });
        g.circle(1, ly, lamp ? 10 : 7).fill({ color: 0xffe090, alpha: 0.16 });
        c.addChild(g);
        glows.push({ g, ph: (e.x * 0.37 + e.y * 0.11) % 6.28 });
        if (!lamp) torches.push({ s: c.children[0] as Sprite, ph: (e.x * 0.13) % 1 });
      }
      if (e.k === 'smoke') { const g = new Graphics(); c.addChild(g); smokes.push({ g, ph: (e.x * 0.071) % 1 }); }
      if (e.k === 'fire') {
        torches.push({ s: c.children[0] as Sprite, ph: e.ph ?? 0, flag: e.s[0].replace(/_\d+$/, '') });
        const g = new Graphics();
        g.blendMode = 'add';
        g.ellipse(0, -8, 60, 26).fill({ color: 0xff9a30, alpha: 0.10 });
        g.ellipse(0, -14, 30, 16).fill({ color: 0xffc060, alpha: 0.12 });
        c.addChild(g);
        glows.push({ g, ph: 1.3 });
      }
      if (e.k === 'flag') torches.push({ s: c.children[0] as Sprite, ph: e.ph ?? 0, flag: e.s[0].replace(/_\d+$/, '') });
      items.push({ obj: c, x: e.x, y: e.y, z: depthZ(e.z, 5), bx0, by0, bx1, by1 });
    }
    for (const it of items) this.layer.addChild(it.obj);
    return { info, meta, assets, ground, water, items, sway, glows, torches, smokes, sources: [groundSrc, bandsSrc] };
  }

  /** położenie komórki względem bieżącego środka: przesunięcie obrazu i głębi */
  // ------------------------------------------------------------------ wykrywanie zasłaniania (siatka kubełków)
  private hash = new Map<number, Item[]>();
  private hashDirty = true;

  /** obiekty warstwy głębi z z > zMin, których prostokąt przecina (x0, y0)–(x1, y1) w pikselach widoku */
  occluders(x0: number, y0: number, x1: number, y1: number, zMin: number, out: Item[]): Item[] {
    if (this.hashDirty) this.rebuildHash();
    out.length = 0;
    const seen = new Set<Item>();
    for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++) {
      for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++) {
        const list = this.hash.get(bx * 65536 + by);
        if (!list) continue;
        for (const it of list) {
          if (it.obj.zIndex <= zMin || seen.has(it)) continue;
          const px = it.obj.x, py = it.obj.y;
          if (px + it.bx1 < x0 || px + it.bx0 > x1 || py + it.by1 < y0 || py + it.by0 > y1) continue;
          seen.add(it);
          out.push(it);
        }
      }
    }
    return out;
  }

  private rebuildHash() {
    this.hash.clear();
    for (const c of this.cells.values()) {
      for (const it of c.items) {
        const px = it.obj.x, py = it.obj.y;
        for (let by = Math.floor((py + it.by0) / BUCKET); by <= Math.floor((py + it.by1) / BUCKET); by++) {
          for (let bx = Math.floor((px + it.bx0) / BUCKET); bx <= Math.floor((px + it.bx1) / BUCKET); bx++) {
            const k = bx * 65536 + by;
            let l = this.hash.get(k);
            if (!l) this.hash.set(k, (l = []));
            l.push(it);
          }
        }
      }
    }
    this.hashDirty = false;
  }

  private place(c: LoadedCell) {
    this.hashDirty = true;
    const dx = c.info.cx - this.cx, dy = c.info.cy - this.cy, C = c.meta.size;
    const ox = (dx - dy) * C, oy = ((dx + dy) * C) / 2, oz = (dx + dy) * C * 10;
    c.ground.position.set(ox, oy);
    c.water.sprite.position.set(ox, oy);
    for (const it of c.items) {
      it.obj.position.set(it.x + ox, it.y + oy);
      it.obj.zIndex = it.z + oz;
    }
  }

  private unload(c: LoadedCell) {
    this.hashDirty = true;
    for (const it of c.items) it.obj.destroy({ children: true });
    c.ground.destroy();
    c.water.destroy();
    for (const s of c.sources) s.destroy();
  }

  /** przesunięcie obrazu przy zmianie środka o (dx, dy) komórek – do korekty kamery */
  static screenShift(dx: number, dy: number, size: number): [number, number] {
    return [(dx - dy) * size, ((dx + dy) * size) / 2];
  }
}
