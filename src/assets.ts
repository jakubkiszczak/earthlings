// Ładowanie grafik i danych jako osobnych plików (assets/ → publicDir Vite).
import type { CellInfo, CellMeta, Ui2Meta, WorldInfo } from './types';

/** Ścieżka do pliku z assets/, działa pod dowolnym adresem (base './'). */
export const assetUrl = (path: string): string => import.meta.env.BASE_URL + path;

export const loadImage = (src: string): Promise<HTMLImageElement> =>
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

/** pliki jednej komórki świata (assets/generated/world/cXY/) */
export const CELL_IMAGES = { ground: 'ground.webp', bands: 'bands.webp', water_a: 'water_a.png', water_b: 'water_b.png', walk: 'walk.png', pick: 'pick.png' } as const;
export type CellImage = keyof typeof CELL_IMAGES;

export interface CellAssets {
  meta: CellMeta;
  img: Record<CellImage, HTMLImageElement>;
}

const cellPath = (c: CellInfo, file: string) => `generated/world/${c.dir}/${file}`;

/** plik widoku r (obrót co 90°): ground_r1.webp itd.; siatka chodzenia wspólna dla wszystkich widoków */
const rotFile = (file: string, r: number) => (r && file !== 'walk.png' ? file.replace(/\.(\w+)$/, `_r${r}.$1`) : file);

export async function loadCell(c: CellInfo, r = 0): Promise<CellAssets> {
  const keys = Object.keys(CELL_IMAGES) as CellImage[];
  const [meta, ...imgs] = await Promise.all([
    loadJson<CellMeta>(cellPath(c, rotFile('meta.json', r))),
    ...keys.map((k) => loadImage(assetUrl(cellPath(c, rotFile(CELL_IMAGES[k], r))))),
  ]);
  return { meta: meta as CellMeta, img: Object.fromEntries(keys.map((k, i) => [k, imgs[i]])) as Record<CellImage, HTMLImageElement> };
}

const prefetched = new Set<string>();
/** pobiera pliki komórki (widok r) do pamięci podręcznej przeglądarki (szybsze przejście / obrót), raz na plik */
export function prefetchCell(c: CellInfo, r = 0): void {
  for (const f of ['meta.json', ...Object.values(CELL_IMAGES)]) {
    const url = assetUrl(cellPath(c, rotFile(f, r)));
    if (prefetched.has(url)) continue;
    prefetched.add(url);
    fetch(url, { priority: 'low' } as RequestInit).catch(() => prefetched.delete(url));
  }
}

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
  world: WorldInfo;
  sprites: HTMLImageElement;
  ui2meta: Ui2Meta;
  /** adresy grafik HUD (używane w DOM jako <img src>) */
  ui2: Record<Ui2Image, string>;
  /** adresy ikon 14×14: klucz 'icon_<nazwa>' */
  icons: Record<string, string>;
}

export async function loadAssets(): Promise<Assets> {
  const [world, ui2meta, sprites] = await Promise.all([
    loadJson<WorldInfo>('generated/world/world.json'),
    loadJson<Ui2Meta>('generated/ui2/ui2.json'),
    loadImage(assetUrl('generated/world/sprites.png')),
  ]);
  const ui2 = Object.fromEntries(UI2_IMAGES.map((k) => [k, assetUrl(`generated/ui2/${k}.png`)])) as Record<Ui2Image, string>;
  const icons = Object.fromEntries(ICONS.map((k) => [`icon_${k}`, assetUrl(`legacy_ui/icon_${k}.png`)]));
  // HUD podmienia źródła <img> (płomienie) – wczytaj z wyprzedzeniem, żeby nie migały
  await Promise.all(Object.values(ui2).map(loadImage));
  return { world, sprites, ui2meta, ui2, icons };
}
