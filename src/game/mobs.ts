// Potwory w świecie: rozmieszczenie (30 na komórkę poza miastem), AI, widok (sprite, cień, pasek HP), trafianie myszą.
import { Container, Graphics, Sprite } from 'pixi.js';
import { CharSheet } from '../chars/sheet';
import { wolfFrames } from '../chars/wolfgen';
import {
  CORPSE_TIME, MOBS, makeMob, pickKind, seeded, spawnPoints, updateMob, type Mob, type MobEvent, type MobKind, type Rng, type Vec,
} from '../logic/combat';
import type { Atlas } from '../render/atlas';
import type { World } from '../world/world';

export const MOBS_PER_CELL = 30;
const OCT_DIR = ['E', 'SE', 'S', 'SE', 'E', 'NE', 'N', 'NE'] as const;

interface MobView { c: Container; s: Sprite; bar: Graphics; ring: Graphics; frame: string }

export class MobManager {
  readonly mobs = new Map<number, Mob>();
  private readonly views = new Map<number, MobView>();
  private readonly seededCells = new Set<string>();
  private readonly sheets: Record<MobKind, CharSheet>;
  private nextId = 1;
  private readonly rng: Rng = seeded(Date.now() & 0xffff);
  target: number | null = null;
  private t = 0;

  constructor(private readonly world: World, private readonly atlas: Atlas) {
    this.sheets = {
      wolf: new CharSheet(wolfFrames()),
      skeleton: new CharSheet({ race: 'human', cls: 'warrior', hair: 'bald', build: 'thin', beard: 'none', kind: 'skeleton' }, 'skeleton'),
      zombie: new CharSheet({ race: 'human', cls: 'warrior', hair: 'black', build: 'stocky', beard: 'none', kind: 'zombie' }, 'zombie'),
    };
  }

  sheet(kind: MobKind) { return this.sheets[kind]; }

  /** rozmieszczenie potworów w nowo wczytanych komórkach (raz na komórkę, deterministycznie) */
  private seedLoaded() {
    const C = this.world.size;
    for (const c of this.world.loadedCells()) {
      const k = `${c.cx},${c.cy}`;
      if (this.seededCells.has(k) || c.biome === 'interior' || c.biome === 'town') continue;
      const g = this.world.gridAt(c.cx, c.cy);
      if (!g) continue;
      this.seededCells.add(k);
      const rng = seeded(c.cx * 7919 + c.cy * 104729 + 17);
      const walk = (u: number, v: number) => g.cellH(...g.cellOf(u, v)) > 0;
      for (const p of spawnPoints(C, MOBS_PER_CELL, walk, rng)) {
        const kind = pickKind(c.biome, rng());
        if (!kind) continue;
        const m = makeMob(this.nextId++, kind, [c.cx, c.cy], [c.cx * C + p[0], c.cy * C + p[1]]);
        m.wanderT = rng() * 4;
        this.mobs.set(m.id, m);
      }
    }
  }

  private active(m: Mob) { return this.world.isLoaded(m.cell[0], m.cell[1]) && !this.world.inInterior; }

  /** AI wszystkich aktywnych potworów; zdarzenia (ataki, odrodzenia) trafiają do out */
  update(dt: number, player: { pos: Vec; alive: boolean }, out: MobEvent[]) {
    this.t += dt;
    this.seedLoaded();
    for (const m of this.mobs.values()) {
      if (!this.active(m)) continue;
      updateMob(m, dt, player, this.world.walkableGlobal, this.rng, out);
    }
  }

  /** widoki: pozycja, klatka, pasek HP, znacznik celu */
  render(layer: Container) {
    for (const [id, v] of this.views) {
      const m = this.mobs.get(id);
      if (!m || !this.active(m)) { v.c.destroy({ children: true }); this.views.delete(id); }
    }
    if (this.world.inInterior) return;
    for (const m of this.mobs.values()) {
      if (!this.active(m)) continue;
      let v = this.views.get(m.id);
      if (!v) {
        const c = new Container();
        const ring = new Graphics();
        const sh = this.atlas.sprite('shadow');
        if (m.kind === 'wolf') sh.scale.set(1.3, 1);
        const s = new Sprite();
        const bar = new Graphics();
        c.addChild(ring, sh, s, bar);
        layer.addChild(c);
        v = { c, s, bar, ring, frame: '' };
        this.views.set(m.id, v);
      }
      const dead = m.state === 'dead';
      if (dead && m.deadT > CORPSE_TIME) { v.c.visible = false; continue; }
      v.c.visible = true;
      v.c.alpha = dead ? Math.max(0, Math.min(1, (CORPSE_TIME - m.deadT) / 0.6)) : 1;
      const [x, y] = this.world.toScreenGlobal(m.pos[0], m.pos[1]);
      v.c.position.set(Math.round(x), Math.round(y));
      const lu = m.pos[0] - this.world.cx * this.world.size, lv = m.pos[1] - this.world.cy * this.world.size;
      v.c.zIndex = Math.round(lu + lv) * 10 + (dead ? 3 : 6);
      // klatka
      const sheet = this.sheets[m.kind];
      const sdx = m.face[0] - m.face[1], sdy = (m.face[0] + m.face[1]) / 2;
      let name: string, flip: boolean;
      const act = m.atkT >= 0 ? (m.atkT < 0.15 ? 'atk0' : 'atk1') : m.moving ? `walk${Math.floor(this.t * 9 + m.id) % 4}` : `idle${Math.floor(this.t * 1.5 + m.id * 0.37) % 2}`;
      if (dead) { name = `${m.kind}_dead`; flip = sdx < 0; }
      else if (m.kind === 'wolf') { name = `wolf_E_${act}`; flip = sdx < 0; }
      else {
        const oct = ((Math.round(Math.atan2(sdy, sdx) / (Math.PI / 4)) % 8) + 8) % 8;
        name = `${m.kind}_${OCT_DIR[oct]}_${act}`;
        flip = oct >= 3 && oct <= 5;
      }
      if (name !== v.frame) { sheet.setFrame(v.s, name); v.frame = name; }
      v.s.scale.x = flip ? -1 : 1;
      if (m.stun > 0 && !dead) v.s.tint = 0xb0b0ff; else v.s.tint = 0xffffff;
      // pasek HP i znacznik celu
      const def = MOBS[m.kind];
      const top = m.kind === 'wolf' ? -26 : -48;
      v.bar.clear();
      if (!dead && (m.hp < def.hp || this.target === m.id)) {
        v.bar.rect(-11, top, 22, 4).fill(0x0a0706);
        v.bar.rect(-10, top + 1, Math.max(0, Math.round((20 * m.hp) / def.hp)), 2).fill(0xd8384a);
      }
      v.ring.clear();
      if (!dead && this.target === m.id) {
        v.ring.ellipse(0, 0, m.kind === 'wolf' ? 15 : 11, m.kind === 'wolf' ? 6 : 5).stroke({ width: 1, color: 0xff5a4a, alpha: 0.6 + 0.4 * Math.sin(this.t * 6) });
      }
    }
  }

  /** potwór pod punktem widoku (piksele obrazu komórki) – żywy, najbliższy przodem */
  at(wx: number, wy: number): Mob | null {
    let best: Mob | null = null, bestZ = -Infinity;
    for (const [id, v] of this.views) {
      const m = this.mobs.get(id);
      if (!m || m.state === 'dead' || !v.c.visible) continue;
      const [, , w, h, px, py] = this.sheets[m.kind].frame(v.frame);
      const x0 = v.c.x - (v.s.scale.x < 0 ? w - px : px) - 2, y0 = v.c.y - py - 2;
      if (wx >= x0 && wx <= x0 + w + 4 && wy >= y0 && wy <= y0 + h + 4 && v.c.zIndex > bestZ) { best = m; bestZ = v.c.zIndex; }
    }
    return best;
  }

  /** widok potwora (do konturu) */
  view(id: number): MobView | undefined { return this.views.get(id); }

  /** wszyscy aktywni (żywi) – do testów i podpowiedzi */
  alive(): Mob[] { return [...this.mobs.values()].filter((m) => this.active(m) && m.state !== 'dead'); }

  /** po śmierci gracza: wszystkie wracają */
  calmDown() { for (const m of this.mobs.values()) if (m.state === 'chase') m.state = 'return'; }
}
