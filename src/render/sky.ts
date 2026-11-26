// Tło za krawędzią świata: ciemne niebo z migoczącymi gwiazdami (w układzie ekranu, lekka paralaksa).
import { Container, Graphics } from 'pixi.js';

interface Star { x: number; y: number; s: number; ph: number; sp: number; c: number }

const COLORS = [0xffffff, 0xcfe4ff, 0xfff2c8, 0xa8c8ff];

export class Sky {
  readonly view = new Container();
  private readonly bg = new Graphics();
  private readonly g = new Graphics();
  private readonly stars: Star[] = [];
  private w = 0;
  private h = 0;

  constructor() {
    this.view.addChild(this.bg, this.g);
    // gwiazdy w kafelku 1024×1024 powtarzanym na ekranie (deterministycznie)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      this.stars.push({
        x: rnd() * 1024, y: rnd() * 1024, s: rnd() < 0.12 ? 2 : 1,
        ph: rnd() * Math.PI * 2, sp: 0.6 + rnd() * 2.2, c: COLORS[Math.floor(rnd() * COLORS.length)],
      });
    }
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.bg.clear();
    // pasy gradientu (pikselowo, bez rozmycia)
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      const k = i / (bands - 1);
      const r = Math.round(6 + 8 * k), gg = Math.round(8 + 10 * k), b = Math.round(20 + 22 * k);
      this.bg.rect(0, Math.floor((h * i) / bands), w, Math.ceil(h / bands) + 1).fill((r << 16) | (gg << 8) | b);
    }
  }

  /** t – czas, (px, py) – przesunięcie kamery w pikselach ekranu (paralaksa 10%) */
  update(t: number, px: number, py: number, scale: number) {
    const g = this.g.clear();
    const s = Math.max(1, Math.round(scale / 2));
    const ox = (((px * 0.1) % 1024) + 1024) % 1024, oy = (((py * 0.1) % 1024) + 1024) % 1024;
    for (let ty = -1024; ty < this.h + 1024; ty += 1024) for (let tx = -1024; tx < this.w + 1024; tx += 1024) {
      for (const st of this.stars) {
        const x = Math.round(st.x + tx + ox), y = Math.round(st.y + ty + oy);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
        g.rect(x, y, st.s * s, st.s * s).fill({ color: st.c, alpha: a });
      }
    }
  }
}
