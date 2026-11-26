// Arkusz klatek jednej postaci: klatki z generatora składane w płótno → tekstury Pixi z kotwicą w stopach.
import { CanvasSource, Rectangle, Sprite, Texture } from 'pixi.js';
import type { FrameRect } from '../types';
import { generateFrames, type CharFrames, type CharLook } from './chargen';

/** wspólny interfejs atlasu świata i arkusza postaci (klatki, tekstury, obraz źródłowy do konturu) */
export interface FrameSource {
  readonly id: string;
  readonly image: CanvasImageSource;
  frame(name: string): FrameRect;
  texture(name: string): Texture;
  setFrame(s: Sprite, name: string): void;
}

let nextId = 0;

export class CharSheet implements FrameSource {
  readonly id = `char${nextId++}`;
  readonly image: HTMLCanvasElement;
  private readonly frames = new Map<string, FrameRect>();
  private readonly textures = new Map<string, Texture>();
  private readonly source: CanvasSource;

  /** look – wygląd postaci, albo gotowe klatki (np. wilk) */
  constructor(look: CharLook | CharFrames, prefix = 'hero') {
    const { names, data } = 'names' in look ? look : generateFrames(look, prefix);
    const cell = Math.max(...[...data.values()].map((f) => Math.max(f.w, f.h))) + 2;
    const cols = 8, rows = Math.ceil(names.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * cell;
    c.height = rows * cell;
    const ctx = c.getContext('2d')!;
    names.forEach((n, i) => {
      const f = data.get(n)!;
      const x = (i % cols) * cell + 1, y = Math.floor(i / cols) * cell + 1;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(f.px), f.w, f.h), x, y);
      this.frames.set(n, [x, y, f.w, f.h, f.ax, f.ay]);
    });
    this.image = c;
    this.source = new CanvasSource({ resource: c, scaleMode: 'nearest' });
  }

  has(name: string) { return this.frames.has(name); }

  frame(name: string): FrameRect {
    const f = this.frames.get(name);
    if (!f) throw new Error(`Brak klatki postaci: ${name}`);
    return f;
  }

  texture(name: string): Texture {
    let t = this.textures.get(name);
    if (!t) {
      const f = this.frame(name);
      t = new Texture({ source: this.source, frame: new Rectangle(f[0], f[1], f[2], f[3]) });
      this.textures.set(name, t);
    }
    return t;
  }

  setFrame(s: Sprite, name: string) {
    s.texture = this.texture(name);
    const f = this.frame(name);
    s.pivot.set(f[4], f[5]);
  }

  /** obraz pojedynczej klatki w powiększeniu (podgląd w menu, portret) */
  drawTo(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, scale: number, crop?: [number, number, number, number]) {
    const f = this.frame(name);
    const [cx, cy, cw, ch] = crop ?? [0, 0, f[2], f[3]];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, f[0] + cx, f[1] + cy, cw, ch, x, y, cw * scale, ch * scale);
  }

  destroy() {
    for (const t of this.textures.values()) t.destroy();
    this.source.destroy();
  }
}
