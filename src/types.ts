// Dane świata z tools/export_live.py (assets/generated/meta.json).

/** [x, y, w, h, pivotX, pivotY] w atlasie sprites.png */
export type FrameRect = [number, number, number, number, number, number];

export interface Band { z: number; x: number; y: number; ax: number; ay: number; w: number; h: number }
export interface WorldEnt { k: string; s: string[]; x: number; y: number; z: number; ph?: number }

export interface WorldMeta {
  W: number; H: number; X0: number; Y0: number;
  OFF: number; N: number; CELL: number; NC: number;
  bands: Band[];
  frames: Record<string, FrameRect>;
  ents: WorldEnt[];
  hero: [number, number];
  dog: [number, number];
  /** paleta wody: 9 kolorów RGB */
  WA: [number, number, number][];
  BAYER: number[][];
}

/** Układ HUD z tools/ui2.py (assets/generated/ui2/ui2.json), w pikselach natywnych. */
export interface Ui2Meta {
  portrait: { cx: number; cy: number };
  orb: { ocx: number; ocy: number; lx: number; ly: number };
  console: { h: number; oh: number; ow: number };
  tray: { w: number; h: number; numy: number; slots: [number, number, number][] };
  eq: Record<string, [number, number, number, number]>;
  stats: [number, number, number, number];
  bag: [number, number, number][];
  gold: [number, number, number, number];
  inv: { w: number; h: number; title: [number, number, number, number]; close: [number, number, number, number] };
}

/** Połączenie gry z HUD-em (zamiast globalnych zmiennych window.*). */
export interface GameBridge {
  /** mnożnik szybkości ruchu (np. wierzchowiec) */
  speed: number;
  teleport(): void;
  ring(color: number): void;
}

export interface HudApi {
  /** wywoływane co klatkę: pozycja głowy bohatera na ekranie */
  update(x: number, y: number, zoom: number, dt: number): void;
}
