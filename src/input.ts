// Mysz: kliknięcie = idź; przytrzymanie = cel odświeżany co 0,15 s.
import type { Application } from 'pixi.js';

const HOLD_REPEAT = 0.15;

export class PointerInput {
  private down = false;
  private x = 0;
  private y = 0;
  private t = 0;

  /** onTarget(x, y, showMark) – punkt ekranu, w który gracz chce iść; onRight – prawy przycisk (odskok) */
  constructor(app: Application, private readonly onTarget: (x: number, y: number, showMark: boolean) => void, onRight?: (x: number, y: number) => void) {
    app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    const stage = app.stage;
    stage.eventMode = 'static';
    stage.hitArea = app.screen;
    stage.cursor = 'pointer';
    stage.on('pointerdown', (e) => {
      if (e.button === 2) { onRight?.(e.global.x, e.global.y); return; }
      if (e.button !== 0) return;
      this.down = true;
      this.x = e.global.x;
      this.y = e.global.y;
      this.t = 0;
      onTarget(this.x, this.y, true);
    });
    stage.on('globalpointermove', (e) => { this.x = e.global.x; this.y = e.global.y; });
    const up = () => {
      if (!this.down) return;
      this.down = false;
      onTarget(this.x, this.y, true);
    };
    stage.on('pointerup', up);
    stage.on('pointerupoutside', up);
    addEventListener('blur', () => { this.down = false; });
  }

  update(dt: number) {
    if (!this.down) return;
    this.t += dt;
    if (this.t > HOLD_REPEAT) { this.t = 0; this.onTarget(this.x, this.y, false); }
  }
}
