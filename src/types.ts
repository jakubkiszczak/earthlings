// Dane świata z tools/worldgen.py (assets/generated/world/).

/** [x, y, w, h, pivotX, pivotY] w atlasie sprites.png */
export type FrameRect = [number, number, number, number, number, number];

export interface Band { z: number; x: number; y: number; ax: number; ay: number; w: number; h: number }
export interface WorldEnt { k: string; s: string[]; x: number; y: number; z: number; ph?: number }

export interface CellInfo { cx: number; cy: number; name: string; biome: string; dir: string }
export interface CellPos { cx: number; cy: number; u: number; v: number }

/** world.json: wspólne dane świata 3×3 */
export interface WorldInfo {
  grid: number;
  tiles: number;
  /** bok komórki w jednostkach świata (tekselach) */
  cellSize: number;
  cells: CellInfo[];
  frames: Record<string, FrameRect>;
  /** paleta wody: 9 kolorów RGB */
  WA: [number, number, number][];
  BAYER: number[][];
  start: CellPos;
  /** portal przed drzwiami sklepu (w komórce miasta) */
  shop: CellPos;
  interiors?: Record<string, InteriorInfo>;
}

/** wnętrze budynku: osobny mały widok wczytywany przez portal */
export interface InteriorInfo {
  dir: string;
  name: string;
  /** gdzie staje postać po wejściu */
  spawn: [number, number];
  /** portal wyjścia */
  exit: [number, number];
  /** sprzedawca za ladą */
  npc: [number, number];
  /** wysokość podłogi */
  floor?: number;
}

/** meta.json komórki: obraz terenu, pasma głębi, obiekty. Współrzędne (u, v) lokalne dla komórki. */
export interface CellMeta {
  cx: number; cy: number; name: string; biome: string;
  /** rozmiar obrazu terenu w pikselach */
  W: number; H: number;
  X0: number; Y0: number;
  /** margines: indeks teksela = u + OFF */
  OFF: number; N: number;
  /** siatka chodzenia: komórka CELL×CELL tekseli, NC×NC komórek */
  CELL: number; NC: number;
  size: number;
  bands: Band[];
  ents: WorldEnt[];
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
  /** użycie miejsca z tacy (umiejętność, mikstura) */
  useSlot(i: number): void;
  /** kliknięcie w panelu ekwipunku: założony przedmiot (klucz miejsca) albo plecak (indeks) */
  invClick(kind: 'eq' | 'bag', key: string | number): void;
  /** dodanie punktu atrybutu */
  addPoint(attr: string): void;
}

export interface HudCharacter { name: string; title: string; level: number; hpMax: number; mpMax: number; exp: number; expMax: number; gold: number; portrait: string }

/** komórka panelu ekwipunku */
export interface InvCell { icon: string; color: string; tip: string; dim?: boolean }
export interface InvView {
  /** klucze miejsc panelu: sword, shield, helm, chest, gloves, boots, ring, amulet */
  eq: Record<string, InvCell | null>;
  eqNames: Record<string, string>;
  bag: (InvCell | null)[];
  statsHtml: string;
  gold: number;
  /** nierozdzielone punkty atrybutów */
  points: number;
}

export interface SlotDef { key: string; icon: string; name: string; desc: string; mana?: number; cd?: number; count?: number }

export interface HudApi {
  setInventory(v: InvView): void;
  toggleInventory(): void;
  setSlots(defs: (SlotDef | null)[]): void;
  /** stan miejsca: pozostałe odnowienie, pełny czas, liczba (np. strzał), wyszarzenie */
  setSlotState(i: number, left: number, cd: number, count: number | undefined, off: boolean): void;
  setVitals(hp: number, hpMax: number, mp: number, mpMax: number): void;
  /** podświetlenie aktywnego miejsca (np. siedzenie) */
  setSlotActive(i: number, on: boolean): void;
  setExp(exp: number, expMax: number): void;
  setGold(gold: number): void;
  /** krótki napis nad postacią */
  float(text: string, color: string): void;
  /** komunikat systemowy na czacie */
  say(msg: string): void;
  /** dane wybranej postaci (nazwa, poziom, HP/mana, portret) */
  setCharacter(c: HudCharacter): void;
  /** komunikat o wejściu do strefy (komórki świata) */
  zone(name: string): void;
  /** wywoływane co klatkę: pozycja głowy bohatera na ekranie */
  update(x: number, y: number, zoom: number, dt: number): void;
}
