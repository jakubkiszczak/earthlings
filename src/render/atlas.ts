// Atlas sprite'ów (sprites.png + ramki z meta.json): tekstury z pivotem w punkcie kotwicy.
import { ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import type { FrameRect } from '../types';

export const subTexture = (source: ImageSource, x: number, y: number, w: number, h: number) =>
  new Texture({ source, frame: new Rectangle(x, y, w, h) });

export class Atlas {
  private readonly source: ImageSource;
  private readonly cache = new Map<string, Texture>();

  constructor(img: HTMLImageElement, private readonly frames: Record<string, FrameRect>) {
    this.source = new ImageSource({ resource: img, scaleMode: 'nearest' });
  }

  texture(name: string): Texture {
    let t = this.cache.get(name);
    if (!t) {
      const f = this.frame(name);
      t = subTexture(this.source, f[0], f[1], f[2], f[3]);
      this.cache.set(name, t);
    }
    return t;
  }

  frame(name: string): FrameRect {
    const f = this.frames[name];
    if (!f) throw new Error(`Brak ramki w atlasie: ${name}`);
    return f;
  }

  sprite(name: string): Sprite {
    const s = new Sprite(this.texture(name));
    const f = this.frame(name);
    s.pivot.set(f[4], f[5]);
    return s;
  }

  /** podmienia klatkę istniejącego sprite'a (z pivotem) */
  setFrame(s: Sprite, name: string): void {
    s.texture = this.texture(name);
    const f = this.frame(name);
    s.pivot.set(f[4], f[5]);
  }
}
