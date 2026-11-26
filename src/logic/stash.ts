// Skrzynia gracza przy fontannie: wspólna dla wszystkich postaci z tej przeglądarki („konto” w prototypie).
import { ITEMS, type Inventory } from './items';

export const STASH_KEY = 'glastemia.stash';
export const STASH_SIZE = 24;

export interface Stash { items: (string | null)[] }

export function parseStash(text: string | null): Stash {
  const items: (string | null)[] = Array(STASH_SIZE).fill(null);
  try {
    const raw = text ? (JSON.parse(text) as { items?: unknown }) : null;
    if (raw && Array.isArray(raw.items)) {
      for (let i = 0; i < STASH_SIZE; i++) {
        const v = raw.items[i];
        items[i] = typeof v === 'string' && v in ITEMS ? v : null;
      }
    }
  } catch { /* uszkodzony zapis – pusta skrzynia */ }
  return { items };
}

/** z plecaka do skrzyni; zwraca błąd albo null */
export function deposit(s: Stash, inv: Inventory, bagIndex: number): string | null {
  const id = inv.bag[bagIndex];
  if (!id) return 'Puste miejsce.';
  const i = s.items.indexOf(null);
  if (i < 0) return 'Skrzynia jest pełna.';
  s.items[i] = id;
  inv.bag[bagIndex] = null;
  return null;
}

/** ze skrzyni do plecaka */
export function withdraw(s: Stash, inv: Inventory, stashIndex: number): string | null {
  const id = s.items[stashIndex];
  if (!id) return 'Puste miejsce.';
  const i = inv.bag.indexOf(null);
  if (i < 0) return 'Plecak jest pełny.';
  inv.bag[i] = id;
  s.items[stashIndex] = null;
  return null;
}

export class StashStore {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safe()) {}
  load(): Stash { try { return parseStash(this.storage?.getItem(STASH_KEY) ?? null); } catch { return parseStash(null); } }
  save(s: Stash) { try { this.storage?.setItem(STASH_KEY, JSON.stringify(s)); } catch { /* brak dostępu do pamięci */ } }
}

function safe(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
