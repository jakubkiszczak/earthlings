// Portal przy drzwiach: pulsująca, niebieska poświata na ziemi (pikselowe elipsy, mieszanie addytywne).
import { Container, Graphics } from 'pixi.js';

export class Portal {
  readonly view = new Container();
  private readonly g = new Graphics();
  /** czy postać musi najpierw odejść od portalu, zanim znów zadziała (np. zaraz po przejściu) */
  armed = true;

  constructor(readonly u: number, readonly v: number, readonly radius = 11) {
    this.g.blendMode = 'add';
    this.view.addChild(this.g);
  }

  /** (x, y) – środek na obrazie świata, z – głębia (u+v) */
  update(t: number, x: number, y: number, z: number) {
    this.view.position.set(Math.round(x), Math.round(y));
    this.view.zIndex = Math.round(z) * 10 + 4;
    const g = this.g.clear();
    const p = (Math.sin(t * 3.2) + 1) / 2;
    g.ellipse(0, 0, 13, 6.5).fill({ color: 0x1a5cff, alpha: 0.28 + 0.12 * p });
    g.ellipse(0, 0, 10, 5).fill({ color: 0x3a8aff, alpha: 0.35 + 0.15 * p });
    g.ellipse(0, 0, 6, 3).fill({ color: 0x9adcff, alpha: 0.45 + 0.2 * p });
    g.ellipse(0, 0, 12 + p * 2, 6 + p).stroke({ width: 1, color: 0x8ad0ff, alpha: 0.9 });
    // unoszące się iskry
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.6 + i / 6) % 1;
      const ang = i * 1.7 + t * 0.8;
      const sx = Math.round(Math.cos(ang) * 8 * (1 - ph * 0.4));
      const sy = Math.round(Math.sin(ang) * 3 - ph * 26);
      g.rect(sx, sy, 1, 1 + (i % 2)).fill({ color: 0xc8f0ff, alpha: 1 - ph });
    }
    // słup światła
    g.rect(-6, -22, 12, 22).fill({ color: 0x3a8aff, alpha: 0.10 + 0.06 * p });
    g.rect(-3, -28, 6, 28).fill({ color: 0x8ad0ff, alpha: 0.10 + 0.06 * p });
  }

  /** „duch” portalu nad światem: mocny błękitny kontur widoczny, gdy portal zasłania budynek lub drzewo */
  readonly ghost = new Graphics();

  /** occluded – czy coś zasłania portal; rysuje kontur w warstwie nad światem */
  setOccluded(occluded: boolean, t: number) {
    const g = this.ghost.clear();
    g.visible = occluded && this.view.visible;
    if (!g.visible) return;
    g.position.copyFrom(this.view.position);
    const p = (Math.sin(t * 3.2) + 1) / 2;
    g.ellipse(0, 0, 13, 6.5).fill({ color: 0x3a9aff, alpha: 0.22 + 0.1 * p });
    g.ellipse(0, 0, 13 + p * 2, 6.5 + p).stroke({ width: 2, color: 0x5ad8ff, alpha: 1 });
    g.ellipse(0, 0, 8, 4).stroke({ width: 1, color: 0xc8f4ff, alpha: 0.9 });
    g.rect(-7, -30, 14, 30).stroke({ width: 1, color: 0x5ad8ff, alpha: 0.55 + 0.3 * p });
    g.rect(-6, -30, 12, 30).fill({ color: 0x3a9aff, alpha: 0.12 });
  }

  /** czy postać w (u, v) wchodzi w portal; po wyjściu z promienia portal się „uzbraja” */
  check(u: number, v: number): boolean {
    const d = Math.hypot(u - this.u, v - this.v);
    if (d > this.radius * 1.8) this.armed = true;
    return this.armed && d < this.radius;
  }
}
