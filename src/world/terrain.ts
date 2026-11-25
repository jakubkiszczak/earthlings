// Teren w pasmach głębi (bands.png) + obiekty świata (drzewa, krzaki) sortowane po s = u + v.
import { Container, ImageSource, Sprite } from 'pixi.js';
import { Atlas, subTexture } from '../render/atlas';
import type { WorldMeta } from '../types';

/** zIndex w warstwie świata: obiekty o tym samym u+v rysowane po terenie */
export const depthZ = (z: number, offset: number) => z * 10 + offset;

export function createTerrain(M: WorldMeta, bandsImg: HTMLImageElement, atlas: Atlas) {
  const layer = new Container();
  layer.sortableChildren = true;

  const bandsSrc = new ImageSource({ resource: bandsImg, scaleMode: 'nearest' });
  for (const b of M.bands) {
    const s = new Sprite(subTexture(bandsSrc, b.ax, b.ay, b.w, b.h));
    s.position.set(b.x, b.y);
    s.zIndex = depthZ(b.z, 0);
    layer.addChild(s);
  }

  // korony drzew i krzaki kołyszą się na wietrze
  const sway: { s: Sprite; ph: number; amp: number }[] = [];
  for (const e of M.ents) {
    const c = new Container();
    c.position.set(e.x, e.y);
    c.zIndex = depthZ(e.z, 5);
    for (const n of e.s) {
      const s = atlas.sprite(n);
      c.addChild(s);
      if (n.endsWith('_c') || e.k === 'bush') sway.push({ s, ph: e.ph ?? 0, amp: e.k === 'bush' ? 0.55 : 0.85 });
    }
    layer.addChild(c);
  }

  return {
    layer,
    update(t: number) {
      for (const w of sway) w.s.x = Math.round(Math.sin(t * 1.3 + w.ph) * w.amp);
    },
  };
}
