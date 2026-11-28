// Wczytanie postaci „paper doll” w przeglądarce i arkusz klatek bohatera (8 kierunków, bez odbić).
// Wspólne pliki (rejestr, palety, punkty zaczepienia, przedmioty) raz na starcie; warstwy wyglądu (ciało, włosy,
// broda, uszy) dopiero dla wybranej postaci – prepareLook().
import { assetUrl, loadImage, readPixels } from '../assets';
import { START_GEAR, type Gear } from './chargen';
import {
  buildFrames, commonFiles, equipmentFromGear, lookFiles, normalizeAppearance,
  type Appearance, type DollAssets, type Palettes, type Registry,
} from './paperdoll';
import { CharSheet } from './sheet';

const DIR = 'art/sprites/';
let assets: DollAssets | null = null;
const pending = new Map<string, Promise<void>>();

async function loadImg(A: DollAssets, file: string) {
  if (A.images[file]) return;
  let p = pending.get(file);
  if (!p) {
    p = loadImage(assetUrl(DIR + file)).then((img) => { A.images[file] = { w: img.width, h: img.height, px: readPixels(img) }; });
    pending.set(file, p);
  }
  await p;
}

/** wczytuje items.json, palety, punkty zaczepienia i obrazy przedmiotów (raz); bez nich gra używa dawnego generatora */
export async function loadDoll(): Promise<boolean> {
  if (assets) return true;
  try {
    const reg = (await (await fetch(assetUrl(DIR + 'items.json'))).json()) as Registry;
    const pal = (await (await fetch(assetUrl(DIR + reg.appearance.palettes))).json()) as Palettes;
    const { images, anchors } = commonFiles(reg);
    const A: DollAssets = { reg, pal, anchors: {}, images: {} };
    await Promise.all([
      ...anchors.map(async (a) => { A.anchors[a] = await (await fetch(assetUrl(DIR + a))).json(); }),
      ...images.map((i) => loadImg(A, i)),
    ]);
    assets = A;
    return true;
  } catch (e) {
    console.warn('Postać paper doll niedostępna – używam generatora', e);
    return false;
  }
}

export const dollReady = () => !!assets;
export const dollRegistry = () => assets?.reg ?? null;
/** dane do składania (strona testowa) */
export const dollAssets = () => assets;

/** wygląd postaci z gry (Look + rasa) → poprawny wygląd paper doll */
export function appearanceOf(look: Partial<Appearance>): Appearance {
  if (!assets) throw new Error('Postać nie została wczytana');
  return normalizeAppearance(assets.reg.appearance, look);
}

/** doczytuje warstwy wyglądu postaci (8 kierunków, oba arkusze) */
export async function prepareLook(look: Partial<Appearance>): Promise<void> {
  if (!assets) return;
  const A = assets;
  await Promise.all(lookFiles(A.reg, appearanceOf(look)).map((f) => loadImg(A, f)));
}

/** czy warstwy wyglądu są już w pamięci */
export const lookLoaded = (look: Partial<Appearance>) => !!assets && lookFiles(assets.reg, appearanceOf(look)).every((f) => !!assets!.images[f]);

/** arkusz bohatera z 8 kierunkami (gra nie odbija go lustrzanie) */
export class PlayerSheet extends CharSheet { readonly eightDir = true; }

/** klatki bohatera dla wyglądu i ekwipunku z gry (warstwy wyglądu muszą być wczytane – prepareLook) */
export function playerSheet(look: Partial<Appearance> & { cls: string; gear?: Gear }, gear?: Gear): PlayerSheet {
  if (!assets) throw new Error('Postać nie została wczytana');
  const eq = equipmentFromGear(look.cls, gear ?? look.gear ?? START_GEAR);
  return new PlayerSheet(buildFrames(assets, appearanceOf(look), eq));
}
