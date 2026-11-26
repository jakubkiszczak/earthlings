// Kontury zasłoniętych postaci („prześwietlenie”): gdy postać stoi za drzewem, budynkiem lub klifem,
// w miejscach zasłoniętych widać jej kontur w kolorze zależnym od rodzaju (bohater, NPC, potwór).
// Działanie: dla każdej postaci znajdujemy obiekty przed nią (World.occluders), renderujemy ich kopie
// do małej tekstury o rozmiarze postaci i używamy jej jako maski konturu narysowanego nad światem.
import { Container, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Item, World } from '../world/world';
import type { FrameSource } from '../chars/sheet';

export const XRAY_COLORS = { hero: 0xa8e4ff, npc: 0x8af59a, mob: 0xff6a6a } as const;
export type XrayKind = keyof typeof XRAY_COLORS;

/** postać do śledzenia: kontener (pozycja, zIndex) i sprite ciała z bieżącą klatką */
export interface XrayTarget { view: Container; body: Sprite; frame(): string; kind: XrayKind; source: FrameSource }

interface Entry {
  t: XrayTarget;
  outline: Sprite;
  mask: Sprite;
  rt: RenderTexture;
  proxies: Container;
}

const PAD = 2;

export class Xray {
  /** warstwa konturów – nad światem */
  readonly overlay = new Container();
  private readonly entries: Entry[] = [];
  private readonly tex = new Map<string, Texture>();
  private readonly found: Item[] = [];
  private readonly pool: Sprite[] = [];

  constructor(private readonly renderer: Renderer, private readonly world: World) {}

  add(t: XrayTarget) {
    const rt = RenderTexture.create({ width: 40, height: 56, scaleMode: 'nearest' });
    const mask = new Sprite(rt);
    const outline = new Sprite();
    outline.tint = XRAY_COLORS[t.kind];
    outline.mask = mask;
    this.overlay.addChild(mask, outline);
    this.entries.push({ t, outline, mask, rt, proxies: new Container() });
  }

  remove(t: XrayTarget) {
    const i = this.entries.findIndex((e) => e.t === t);
    if (i < 0) return;
    const e = this.entries[i];
    e.outline.destroy(); e.mask.destroy(); e.rt.destroy(true); e.proxies.destroy({ children: true });
    this.entries.splice(i, 1);
  }

  /** kontur klatki: obwódka 1 px (pełna) + wypełnienie sylwetki (półprzezroczyste), białe – kolor nadaje tint */
  private outlineTexture(src: FrameSource, name: string): Texture {
    const key = `${src.id}:${name}`;
    let t = this.tex.get(key);
    if (t) return t;
    const [fx, fy, w, h] = src.frame(name);
    const W = w + 2 * PAD, H = h + 2 * PAD;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src.image, fx, fy, w, h, PAD, PAD, w, h);
    const px = ctx.getImageData(0, 0, W, H);
    const a = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : px.data[(y * W + x) * 4 + 3]);
    const out = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const inside = a(x, y) > 0;
      const ring = !inside && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1));
      if (!inside && !ring) continue;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = 255;
      out.data[o + 3] = ring ? 255 : 120;
    }
    ctx.putImageData(out, 0, 0);
    t = Texture.from(c);
    t.source.scaleMode = 'nearest';
    this.tex.set(key, t);
    return t;
  }

  /** liczba widocznych konturów (do testów) */
  visibleCount(): number { return this.entries.filter((e) => e.outline.visible).length; }

  update() {
    for (const e of this.entries) {
      const { view, body } = e.t;
      if (!view.parent || !view.visible) { e.outline.visible = false; continue; }
      const name = e.t.frame();
      const [, , w, h, px, py] = e.t.source.frame(name);
      const flip = body.scale.x < 0;
      // prostokąt ciała w pikselach widoku świata (z obwódką)
      const x0 = Math.round(view.x + body.x + (flip ? px - w : -px)) - PAD;
      const y0 = Math.round(view.y + body.y - py) - PAD;
      const W = w + 2 * PAD, H = h + 2 * PAD;
      const occ = this.world.occluders(x0, y0, x0 + W, y0 + H, view.zIndex, this.found);
      if (!occ.length) { e.outline.visible = false; continue; }
      // kopie obiektów zasłaniających do maski
      for (const s of e.proxies.removeChildren() as Sprite[]) this.pool.push(s);
      for (const it of occ) {
        const kids = it.obj.children.length ? it.obj.children : [it.obj];
        for (const k of kids) {
          if (!(k instanceof Sprite)) continue;
          const s = this.pool.pop() ?? new Sprite();
          s.texture = k.texture;
          s.pivot.copyFrom(k.pivot);
          s.scale.copyFrom(k.scale);
          const ox = k === it.obj ? 0 : k.x, oy = k === it.obj ? 0 : k.y;
          s.position.set(it.obj.x + ox - x0, it.obj.y + oy - y0);
          e.proxies.addChild(s);
        }
      }
      if (e.rt.width !== W || e.rt.height !== H) e.rt.resize(W, H);
      this.renderer.render({ container: e.proxies, target: e.rt, clear: true });
      e.mask.position.set(x0, y0);
      e.outline.texture = this.outlineTexture(e.t.source, name);
      e.outline.scale.x = flip ? -1 : 1;
      e.outline.position.set(flip ? x0 + W : x0, y0);
      e.outline.visible = true;
    }
  }
}
