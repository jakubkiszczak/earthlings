// Świat 3×3: bieżąca komórka + jej sąsiedzi (widok bez pustki przy krawędziach).
// Współrzędne gry są lokalne dla bieżącej komórki; sąsiedzi są przesunięci o (dx, dy) komórek.
// Przejście przez krawędź przestawia środek bez przeładowania obrazu (płynnie), brakujących sąsiadów doczytuje w tle.
import { Container, ImageSource, Sprite, Texture } from 'pixi.js';
import { loadCell, type CellAssets } from '../assets';
import { subTexture, type Atlas } from '../render/atlas';
import { createWater } from '../render/water';
import type { CellInfo, CellMeta, WorldInfo } from '../types';
import { WorldGrid } from './grid';

/** zIndex w warstwie głębi: z = u + v (lokalnie), obiekty po terenie o tym samym z */
export const depthZ = (z: number, offset: number) => z * 10 + offset;

interface Item { obj: Container; x: number; y: number; z: number }

interface LoadedCell {
  info: CellInfo;
  meta: CellMeta;
  assets: CellAssets;
  ground: Sprite;
  water: ReturnType<typeof createWater>;
  items: Item[];
  sway: { s: Sprite; ph: number; amp: number }[];
  sources: ImageSource[];
  grid?: WorldGrid;
}

const key = (cx: number, cy: number) => `${cx},${cy}`;

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

  constructor(readonly info: WorldInfo, private readonly atlas: Atlas) {
    this.layer.sortableChildren = true;
    this.view.addChild(this.waterLayer, this.groundLayer, this.layer);
  }

  get size() { return this.info.cellSize; }
  get gridSize() { return this.info.grid; }

  cellAt(cx: number, cy: number): CellInfo | undefined {
    return this.info.cells.find((c) => c.cx === cx && c.cy === cy);
  }

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
      items.push({ obj: s, x: b.x, y: b.y, z: depthZ(b.z, 0) });
    }
    // obiekty tylko z rdzenia komórki (margines pokazują sąsiedzi – bez podwójnych drzew)
    const sway: LoadedCell['sway'] = [];
    for (const e of meta.ents) {
      const a = e.x - meta.X0, u = (e.z + a) / 2, v = (e.z - a) / 2;
      if (u < 0 || v < 0 || u >= C || v >= C) continue;
      const c = new Container();
      for (const n of e.s) {
        const s = this.atlas.sprite(n);
        c.addChild(s);
        if (n.endsWith('_c') || e.k === 'bush') sway.push({ s, ph: e.ph ?? 0, amp: e.k === 'bush' ? 0.55 : 0.85 });
      }
      items.push({ obj: c, x: e.x, y: e.y, z: depthZ(e.z, 5) });
    }
    for (const it of items) this.layer.addChild(it.obj);
    return { info, meta, assets, ground, water, items, sway, sources: [groundSrc, bandsSrc] };
  }

  /** położenie komórki względem bieżącego środka: przesunięcie obrazu i głębi */
  private place(c: LoadedCell) {
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
