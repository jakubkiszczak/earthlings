// Fontanna na placu: strumienie wody z kolumny do misy (krople rysowane co klatkę, mieszanie addytywne).
import { Graphics } from 'pixi.js';
import type { World } from '../world/world';

const TOP = 30, WATER = 3, BASE = 48;

export class Fountain {
  readonly g = new Graphics();
  constructor(private readonly world: World, private readonly gu: number, private readonly gv: number) {
    this.g.blendMode = 'add';
  }

  update(t: number) {
    const C = this.world.size;
    const on = !this.world.inInterior && this.world.isLoaded(Math.floor(this.gu / C), Math.floor(this.gv / C));
    this.g.visible = on;
    if (!on) return;
    const g = this.g.clear();
    const [cx, cy] = this.world.toScreenGlobalH(this.gu, this.gv, BASE + TOP);
    this.g.zIndex = Math.round(this.gu - this.world.cx * C + this.gv - this.world.cy * C) * 10 + 7;
    // 8 strumieni po łuku do misy, krople przesuwają się w czasie
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const du = Math.cos(a) * 22, dv = Math.sin(a) * 22;
      for (let i = 0; i < 6; i++) {
        const p = ((t * 0.9 + i / 6 + k * 0.13) % 1);
        const u = du * p, v = dv * p, h = TOP + 8 * Math.sin(p * Math.PI) - (TOP - WATER) * p * p;
        const x = cx + (u - v), y = cy + Math.floor((u + v) / 2) - (h - TOP);
        g.rect(Math.round(x), Math.round(y), 1, 1).fill({ color: p > 0.85 ? 0xffffff : 0x9ae8ff, alpha: 0.85 });
      }
    }
    // pióropusz nad kolumną
    for (let i = 0; i < 5; i++) {
      const p = (t * 1.4 + i / 5) % 1;
      g.rect(Math.round(cx + Math.sin(i * 2.1 + t) * 1.5), Math.round(cy - 2 - p * 9), 1, 2).fill({ color: 0xc8f4ff, alpha: 1 - p });
    }
  }
}
