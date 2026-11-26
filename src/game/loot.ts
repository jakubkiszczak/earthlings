// Łup na ziemi: złoto, mikstury, przedmioty. Złoto i mikstury podnoszą się same po wejściu na nie,
// przedmioty – po kliknięciu (postać podchodzi). Znikają po 2 minutach.
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { ITEMS, RARITY_COLOR, type LootRoll } from '../logic/items';
import type { Vec } from '../logic/combat';
import type { World } from '../world/world';

export type DropKind = 'gold' | 'hp' | 'mp' | 'item';
export interface Drop { id: number; kind: DropKind; amount: number; item: string | null; pos: Vec; from: Vec; pop: number; t: number; view: Container; icon: Sprite; glow: Graphics }

const POP_TIME = 0.45;   // s – łup wylatuje z potwora łukiem

const LIFETIME = 120;
export const PICK_RADIUS = 16;

export class LootManager {
  readonly drops: Drop[] = [];
  private nextId = 1;
  private readonly tex = new Map<string, Texture>();
  /** przedmiot, po który postać idzie */
  wanted: number | null = null;

  constructor(private readonly world: World, private readonly layer: Container, private readonly iconUrl: (kind: DropKind, item: string | null) => string) {}

  /** tekstury ikon trzeba wczytać przed użyciem – obraz utworzony w locie (data URL) nie zdążyłby się wczytać
   *  i sprite zostałby pusty (to był powód niewidocznego złota) */
  async preload(urls: string[]) {
    await Promise.all([...new Set(urls)].map((url) => new Promise<void>((res) => {
      if (this.tex.has(url)) { res(); return; }
      const img = new Image();
      img.onload = () => { const t = Texture.from(img); t.source.scaleMode = 'nearest'; this.tex.set(url, t); res(); };
      img.onerror = () => res();
      img.src = url;
    })));
  }

  private texture(url: string, onReady: (t: Texture) => void): Texture {
    const t = this.tex.get(url);
    if (t) return t;
    // awaryjnie: wczytaj i podmień, gdy gotowe
    void this.preload([url]).then(() => { const r = this.tex.get(url); if (r) onReady(r); });
    return Texture.EMPTY;
  }

  /** rozrzuć łup z potwora wokół punktu */
  spawn(at: Vec, roll: LootRoll) {
    const parts: [DropKind, number, string | null][] = [['gold', roll.gold, null]];
    if (roll.hpPot) parts.push(['hp', 1, null]);
    if (roll.mpPot) parts.push(['mp', 1, null]);
    if (roll.item) parts.push(['item', 1, roll.item]);
    parts.forEach(([kind, amount, item], i) => {
      const a = (i / parts.length) * Math.PI * 2 + Math.random() * 0.6, r = parts.length > 1 ? 10 : 0;
      let pos: Vec = [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r];
      if (!this.world.walkableGlobal(pos[0], pos[1])) pos = [at[0], at[1]];
      const view = new Container();
      const glow = new Graphics();
      const color = item ? parseInt(RARITY_COLOR(ITEMS[item]).slice(1), 16) : kind === 'gold' ? 0xffd84a : kind === 'hp' ? 0xff5a6a : 0x5a9aff;
      // poświata: plama na ziemi, aureola wokół przedmiotu i słup światła
      glow.ellipse(0, 0, 12, 5).fill({ color, alpha: 0.35 });
      glow.ellipse(0, 0, 7, 3).fill({ color: 0xffffff, alpha: 0.18 });
      glow.circle(0, -11, 11).fill({ color, alpha: 0.16 });
      glow.rect(-3, -34, 6, 34).fill({ color, alpha: 0.10 });
      glow.blendMode = 'add';
      const icon = new Sprite();
      icon.texture = this.texture(this.iconUrl(kind, item), (t) => { if (!icon.destroyed) icon.texture = t; });
      icon.anchor.set(0.5, 1);
      icon.scale.set(1.5);                      // przedmioty o 50% większe
      view.addChild(glow, icon);
      if (item) {
        const label = new Text({ text: ITEMS[item].name, style: { fontFamily: 'Jersey', fontSize: 8, fill: RARITY_COLOR(ITEMS[item]), stroke: { color: 0x0a0706, width: 2 } } });
        label.resolution = 4;
        label.anchor.set(0.5, 1);
        label.position.set(0, -24);
        view.addChild(label);
      }
      this.layer.addChild(view);
      this.drops.push({ id: this.nextId++, kind, amount, item, pos, from: [at[0], at[1]], pop: 0, t: Math.random() * 6, view, icon, glow });
    });
  }

  /** położenie i animacja; usuwa przeterminowane */
  update(dt: number) {
    const C = this.world.size;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (d.t > LIFETIME) { this.remove(i); continue; }
      const cx = Math.floor(d.pos[0] / C), cy = Math.floor(d.pos[1] / C);
      const vis = !this.world.inInterior && this.world.isLoaded(cx, cy);
      d.view.visible = vis;
      if (!vis) continue;
      const [x, y] = this.world.toScreenGlobal(d.pos[0], d.pos[1]);
      // wylot z potwora: łuk od miejsca śmierci do miejsca leżenia
      let lift = 0;
      if (d.pop < 1) {
        d.pop = Math.min(1, d.pop + dt / POP_TIME);
        const k = d.pop, e = 1 - (1 - k) * (1 - k);
        const [fx, fy] = this.world.toScreenGlobal(d.from[0], d.from[1]);
        lift = Math.sin(k * Math.PI) * 18;
        d.view.position.set(Math.round(fx + (x - fx) * e), Math.round(fy + (y - fy) * e - lift));
      } else d.view.position.set(Math.round(x), Math.round(y));
      d.icon.y = -Math.round(1 + Math.abs(Math.sin(d.t * 2.4)) * 2);
      d.glow.alpha = 0.7 + 0.3 * Math.sin(d.t * 3.1);
      const lu = d.pos[0] - this.world.cx * C, lv = d.pos[1] - this.world.cy * C;
      d.view.zIndex = Math.round(lu + lv) * 10 + 2;
      d.view.alpha = d.t > LIFETIME - 5 ? (LIFETIME - d.t) / 5 : 1;
    }
  }

  /** łup pod punktem widoku (do kliknięcia) */
  at(wx: number, wy: number): Drop | null {
    for (const d of this.drops) {
      if (!d.view.visible) continue;
      if (Math.abs(wx - d.view.x) <= 13 && wy <= d.view.y + 5 && wy >= d.view.y - (d.item ? 32 : 26)) return d;
    }
    return null;
  }

  /** łup w zasięgu podniesienia (auto: złoto i mikstury; przedmiot – tylko wskazany) */
  inReach(p: Vec): Drop[] {
    return this.drops.filter((d) => d.view.visible && Math.hypot(d.pos[0] - p[0], d.pos[1] - p[1]) < PICK_RADIUS && (d.kind !== 'item' || d.id === this.wanted));
  }

  take(d: Drop) {
    const i = this.drops.indexOf(d);
    if (i >= 0) this.remove(i);
    if (this.wanted === d.id) this.wanted = null;
  }

  private remove(i: number) {
    this.drops[i].view.destroy({ children: true });
    this.drops.splice(i, 1);
  }
}
