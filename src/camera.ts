// Kamera: wygładzanie wykładnicze, zoom tylko całkowity (pixel art), ograniczenie do granic mapy.
import type { Container, Rectangle } from 'pixi.js';

const ZOOM_MIN = 1;      // najdalsze oddalenie (scroll)
const ZOOM_MAX = 6;

export class Camera {
  x = 0;
  y = 0;
  zoom: number;

  /** granice obrazu (null = bez ograniczeń, kamera zawsze na postaci) */
  private bounds: { w: number; h: number } | null = null;

  constructor() {
    this.zoom = Math.max(2, Math.min(5, Math.floor(Math.min(innerWidth / 330, innerHeight / 200))));
    addEventListener('wheel', (e) => {
      this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom + (e.deltaY < 0 ? 1 : -1)));
    }, { passive: true });
  }

  /** rozmiar obrazu bieżącej komórki (granice kamery) */
  setBounds(w: number, h: number) { this.bounds = { w, h }; }

  /** przesunięcie układu (zmiana komórki) bez skoku obrazu */
  shift(dx: number, dy: number) { this.x += dx; this.y += dy; }

  snap(x: number, y: number) { this.x = x; this.y = y; }

  /** podąża za punktem (tx, ty) obrazu świata i ustawia kontener świata na ekranie */
  update(world: Container, screen: Rectangle, tx: number, ty: number, dt: number) {
    const k = 1 - Math.exp(-6 * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    const z = this.zoom;
    let cx = this.x, cy = this.y;
    if (this.bounds) {
      const { w: W, h: H } = this.bounds;
      const hw = screen.width / (2 * z), hh = screen.height / (2 * z);
      cx = W < 2 * hw ? W / 2 : Math.min(Math.max(this.x, hw), W - hw);
      cy = H < 2 * hh ? H / 2 : Math.min(Math.max(this.y, hh), H - hh);
    }
    world.scale.set(z);
    world.position.set(Math.round(screen.width / 2 - cx * z), Math.round(screen.height / 2 - cy * z));
  }
}
