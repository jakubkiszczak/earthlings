// Ładowanie grafik i danych jako osobnych plików (assets/ → publicDir Vite).
import type { Ui2Meta, WorldMeta } from './types';

/** Ścieżka do pliku z assets/, działa pod dowolnym adresem (base './'). */
export const assetUrl = (path: string): string => import.meta.env.BASE_URL + path;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(`Nie udało się wczytać: ${src}`));
    i.src = src;
  });

const loadJson = async <T>(path: string): Promise<T> => {
  const r = await fetch(assetUrl(path));
  if (!r.ok) throw new Error(`Nie udało się wczytać: ${path} (${r.status})`);
  return r.json() as Promise<T>;
};

/** Surowe piksele RGBA obrazka (mapy danych: woda, siatka chodzenia, mapa wyboru). */
export function readPixels(img: HTMLImageElement): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height).data;
}

export const WORLD_IMAGES = ['bands', 'sprites', 'water_a', 'water_b', 'walk', 'pick'] as const;
export type WorldImage = (typeof WORLD_IMAGES)[number];

export const UI2_IMAGES = [
  'cap_left', 'cap_right', 'console_fill', 'corner_tl', 'corner_tr', 'crest', 'edge_left', 'edge_right', 'edge_top',
  'flame0', 'flame1', 'inv_bg', 'orb_glass', 'panel9', 'portrait', 'rbtn', 'rbtn_h', 'tray',
] as const;
export type Ui2Image = (typeof UI2_IMAGES)[number];

const ICONS = [
  'amulet', 'bash', 'belt', 'boots', 'cape', 'chest', 'gloves', 'heal', 'helm', 'horse', 'hp', 'legs', 'light',
  'mp', 'ring', 'ring2', 'scroll', 'shield', 'sword',
] as const;

export interface Assets {
  meta: WorldMeta;
  ui2meta: Ui2Meta;
  img: Record<WorldImage, HTMLImageElement>;
  /** adresy grafik HUD (używane w DOM jako <img src>) */
  ui2: Record<Ui2Image, string>;
  /** adresy ikon 14×14: klucz 'icon_<nazwa>' */
  icons: Record<string, string>;
}

export async function loadAssets(): Promise<Assets> {
  const [meta, ui2meta, ...imgs] = await Promise.all([
    loadJson<WorldMeta>('generated/meta.json'),
    loadJson<Ui2Meta>('generated/ui2/ui2.json'),
    ...WORLD_IMAGES.map((k) => loadImage(assetUrl(`generated/${k}.png`))),
  ]);
  const img = Object.fromEntries(WORLD_IMAGES.map((k, i) => [k, imgs[i]])) as Record<WorldImage, HTMLImageElement>;
  const ui2 = Object.fromEntries(UI2_IMAGES.map((k) => [k, assetUrl(`generated/ui2/${k}.png`)])) as Record<Ui2Image, string>;
  const icons = Object.fromEntries(ICONS.map((k) => [`icon_${k}`, assetUrl(`legacy_ui/icon_${k}.png`)]));
  // HUD podmienia źródła <img> (płomienie) – wczytaj z wyprzedzeniem, żeby nie migały
  await Promise.all(Object.values(ui2).map(loadImage));
  return { meta, ui2meta, img, ui2, icons };
}
