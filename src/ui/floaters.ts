// Liczby obrażeń i komunikaty nad punktami świata (DOM, przeliczane z pozycji świata na ekran co klatkę).
const LIFE = 1.1;

interface Floater { el: HTMLElement; x: number; y: number; t: number }

export class Floaters {
  private readonly root = document.createElement('div');
  private readonly list: Floater[] = [];

  constructor(host: HTMLElement) {
    this.root.className = 'wfloats';
    host.append(this.root);
  }

  /** (x, y) – piksele obrazu świata (jak pozycje sprite'ów) */
  add(x: number, y: number, text: string, color: string, big = false) {
    const el = document.createElement('div');
    el.className = 'wfloat' + (big ? ' big' : '');
    el.textContent = text;
    el.style.color = color;
    this.root.append(el);
    this.list.push({ el, x: x + (Math.random() - 0.5) * 6, y, t: 0 });
  }

  /** przesunięcie przy zmianie komórki (płynne przejście) */
  shift(dx: number, dy: number) { for (const f of this.list) { f.x += dx; f.y += dy; } }

  update(stageX: number, stageY: number, zoom: number, dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.t += dt;
      if (f.t > LIFE) { f.el.remove(); this.list.splice(i, 1); continue; }
      const k = 1 - Math.pow(1 - f.t / LIFE, 3);
      f.el.style.transform = `translate(${Math.round(stageX + f.x * zoom)}px, ${Math.round(stageY + (f.y - 10 - k * 18) * zoom)}px) translate(-50%, -100%)`;
      f.el.style.opacity = String(f.t > LIFE - 0.3 ? (LIFE - f.t) / 0.3 : 1);
    }
  }
}
