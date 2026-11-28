// Wczytanie postaci „paper doll” w przeglądarce i arkusz klatek bohatera (8 kierunków, bez odbić).
import { assetUrl, loadImage, readPixels } from '../assets';
import { START_GEAR, type Gear } from './chargen';
import { buildFrames, equipmentFromGear, filesOf, type DollAssets, type Gender, type Registry } from './paperdoll';
import { CharSheet } from './sheet';

const DIR = 'art/sprites/';
let assets: DollAssets | null = null;

/** wczytuje items.json, punkty zaczepienia i obrazy (raz); bez nich gra używa dawnego generatora postaci */
export async function loadDoll(): Promise<boolean> {
  if (assets) return true;
  try {
    const reg = (await (await fetch(assetUrl(DIR + 'items.json'))).json()) as Registry;
    const { images, anchors } = filesOf(reg);
    const A: DollAssets = { reg, anchors: {}, images: {} };
    await Promise.all([
      ...anchors.map(async (a) => { A.anchors[a] = await (await fetch(assetUrl(DIR + a))).json(); }),
      ...images.map(async (i) => { const img = await loadImage(assetUrl(DIR + i)); A.images[i] = { w: img.width, h: img.height, px: readPixels(img) }; }),
    ]);
    assets = A;
    return true;
  } catch (e) {
    console.warn('Postać paper doll niedostępna – używam generatora', e);
    return false;
  }
}

export const dollReady = () => !!assets;

/** arkusz bohatera z 8 kierunkami (gra nie odbija go lustrzanie) */
export class PlayerSheet extends CharSheet { readonly eightDir = true; }

/** klatki bohatera dla wyglądu (płeć) i ekwipunku z gry */
export function playerSheet(look: { cls: string; gender?: Gender; gear?: Gear }, gear?: Gear): PlayerSheet {
  if (!assets) throw new Error('Postać nie została wczytana');
  const eq = equipmentFromGear(look.cls, gear ?? look.gear ?? START_GEAR);
  return new PlayerSheet(buildFrames(assets, look.gender ?? 'male', eq));
}
