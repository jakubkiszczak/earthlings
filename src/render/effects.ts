// Efekty w warstwie świata: znacznik celu ruchu i rozchodzący się pierścień (np. po użyciu umiejętności).
import { Container, Graphics } from 'pixi.js';

const RING_TIME = 0.7;
const MARK_TIME = 1.2;
const TOP = 1e9;

export class Effects {
  private readonly fx = new Graphics();
  private readonly marker = new Graphics();
  private readonly rings: { t: number; color: number }[] = [];
  private markT = 0;

  constructor(layer: Container) {
    this.fx.zIndex = TOP;
    this.marker.zIndex = TOP;
    layer.addChild(this.fx, this.marker);
  }

  /** obiekty efektów do przeniesienia do warstwy nowej komórki */
  get views(): Container[] { return [this.fx, this.marker]; }

  ring(color: number) { this.rings.push({ t: 0, color }); }

  clearMark() { this.marker.clear(); this.markT = 0; }

  /** romb w miejscu celu ruchu (piksele obrazu świata) */
  mark(x: number, y: number) {
    this.marker.clear().poly([x, y - 4, x + 8, y, x, y + 4, x - 8, y]).stroke({ width: 1, color: 0xfff1c4, alpha: 1 });
    this.markT = MARK_TIME;
  }

  /** (hx, hy) – stopy bohatera na obrazie świata */
  update(dt: number, hx: number, hy: number) {
    this.fx.clear();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const e = this.rings[i];
      e.t += dt;
      if (e.t > RING_TIME) { this.rings.splice(i, 1); continue; }
      const r = Math.round(4 + e.t * 30), a = 1 - e.t / RING_TIME;
      this.fx.ellipse(hx, hy, r, Math.round(r / 2)).stroke({ width: 1, color: e.color, alpha: a });
      this.fx.ellipse(hx, hy - 18, Math.round(r * 0.5), Math.round(r * 0.5)).stroke({ width: 1, color: 0xffffff, alpha: a * 0.5 });
    }
    if (this.markT > 0) { this.markT -= dt; this.marker.alpha = Math.max(0, this.markT); }
  }
}
