// Zapis postaci w przeglądarce (localStorage): format wersjonowany, walidacja przy odczycie, maks. 3 postacie.
import {
  CLASSES, MAX_LEVEL, RACES, normalizeLook, type Attributes, type ClassId, type Look, type Race,
} from './character';
import type { CellPos } from '../types';

export const SAVE_KEY = 'earthlings.saves';
export const SAVE_VERSION = 1;
export const MAX_CHARS = 3;

export interface SavedChar {
  id: string;
  name: string;
  race: Race;
  cls: ClassId;
  look: Look;
  /** punkty rozdzielone przez gracza (dodawane do bazowych z klasy i rasy) */
  alloc: Attributes;
  level: number;
  exp: number;
  gold: number;
  pos: CellPos | null;
  /** nierozdzielone punkty atrybutów (z awansów) */
  points?: number;
  /** strzały łowcy */
  arrows?: number;
  /** ekwipunek (sprawdzany przy wczytaniu przez sanitizeInventory) */
  inv?: unknown;
  created: number;
  played: number;
}

export interface SaveFile { version: number; chars: SavedChar[] }

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const oneOf = <T extends string>(x: unknown, list: readonly T[]): x is T => typeof x === 'string' && (list as readonly string[]).includes(x);

function validChar(c: unknown): c is SavedChar {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  const look = o.look as Record<string, unknown> | undefined;
  const alloc = o.alloc as Record<string, unknown> | undefined;
  return typeof o.id === 'string' && typeof o.name === 'string'
    && oneOf(o.race, Object.keys(RACES) as Race[]) && oneOf(o.cls, Object.keys(CLASSES) as ClassId[])
    && !!look && typeof look === 'object'
    && !!alloc && ['str', 'dex', 'vit', 'ene'].every((k) => isNum(alloc[k]))
    && isNum(o.level) && o.level >= 1 && o.level <= MAX_LEVEL && isNum(o.exp) && isNum(o.gold)
    && (o.points === undefined || isNum(o.points)) && (o.arrows === undefined || isNum(o.arrows));
}

/** odczyt z tekstu (np. localStorage); uszkodzone wpisy są pomijane, nieznana wersja → pusty zapis */
export function parseSave(text: string | null): SaveFile {
  if (!text) return { version: SAVE_VERSION, chars: [] };
  try {
    const raw = JSON.parse(text) as { version?: unknown; chars?: unknown };
    if (raw.version !== SAVE_VERSION || !Array.isArray(raw.chars)) return { version: SAVE_VERSION, chars: [] };
    // wygląd poprawiany przy odczycie (także zapisy sprzed fryzur i koloru skóry)
    const chars = raw.chars.filter(validChar).slice(0, MAX_CHARS).map((c) => ({ ...c, look: normalizeLook(c.race, c.look) }));
    return { version: SAVE_VERSION, chars };
  } catch {
    return { version: SAVE_VERSION, chars: [] };
  }
}

export const serializeSave = (s: SaveFile): string => JSON.stringify({ version: SAVE_VERSION, chars: s.chars });

/** dostęp do localStorage z obsługą błędów (tryb prywatny, zablokowane dane) */
export class SaveStore {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()) {}

  load(): SaveFile {
    try { return parseSave(this.storage?.getItem(SAVE_KEY) ?? null); } catch { return parseSave(null); }
  }

  write(s: SaveFile): boolean {
    try { this.storage?.setItem(SAVE_KEY, serializeSave(s)); return !!this.storage; } catch { return false; }
  }

  list(): SavedChar[] { return this.load().chars; }

  upsert(c: SavedChar): boolean {
    const s = this.load();
    const i = s.chars.findIndex((x) => x.id === c.id);
    if (i >= 0) s.chars[i] = c;
    else if (s.chars.length < MAX_CHARS) s.chars.push(c);
    else return false;
    return this.write(s);
  }

  remove(id: string): void {
    const s = this.load();
    s.chars = s.chars.filter((c) => c.id !== id);
    this.write(s);
  }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
