// Przedmioty (20), łup z potworów, ekwipunek i statystyki postaci z ekwipunku. Czysta logika (wg planu prototypu).
import { derived, type Attributes, type ClassId } from './character';
import type { MobKind, Rng, Weapon } from './combat';

export type Slot = 'weapon' | 'shield' | 'helm' | 'armor' | 'gloves' | 'boots' | 'ring' | 'amulet';
export const SLOTS: Slot[] = ['weapon', 'shield', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
export const SLOT_NAMES: Record<Slot, string> = {
  weapon: 'Broń', shield: 'Tarcza', helm: 'Hełm', armor: 'Zbroja', gloves: 'Rękawice', boots: 'Buty', ring: 'Pierścień', amulet: 'Amulet',
};
export const BAG_SIZE = 16;

export interface ItemDef {
  id: string; name: string; slot: Slot; tier: 1 | 2 | 3;
  /** wymagany poziom */
  level: number;
  /** tylko dla klasy (broń, tarcza) */
  cls?: ClassId;
  /** broń łowcy to łuk */
  bow?: boolean;
  min?: number; max?: number;
  armor?: number;
  /** premia do szybkości ruchu (0.05 = +5%) */
  speed?: number;
  dex?: number; luck?: number;
  /** premia do maks. HP (0.1 = +10%) */
  hpPct?: number;
  /** wartość w złocie (sklep: skup 25%) */
  value: number;
  /** element specjalny (pierścień, rękawice, amulet) – inny kolor rzadkości */
  special?: boolean;
}

const I = (d: ItemDef) => d;
export const ITEMS: Record<string, ItemDef> = Object.fromEntries([
  I({ id: 'sword1', name: 'Krótki miecz', slot: 'weapon', tier: 1, level: 1, cls: 'warrior', min: 8, max: 12, value: 40 }),
  I({ id: 'sword2', name: 'Miecz żołnierski', slot: 'weapon', tier: 2, level: 3, cls: 'warrior', min: 14, max: 20, value: 160 }),
  I({ id: 'sword3', name: 'Ostrze Świtu', slot: 'weapon', tier: 3, level: 5, cls: 'warrior', min: 22, max: 30, value: 480 }),
  I({ id: 'bow1', name: 'Krótki łuk', slot: 'weapon', tier: 1, level: 1, cls: 'hunter', bow: true, min: 8, max: 12, value: 40 }),
  I({ id: 'bow2', name: 'Łuk myśliwski', slot: 'weapon', tier: 2, level: 3, cls: 'hunter', bow: true, min: 14, max: 20, value: 160 }),
  I({ id: 'bow3', name: 'Łuk elficki', slot: 'weapon', tier: 3, level: 5, cls: 'hunter', bow: true, min: 22, max: 30, value: 480 }),
  I({ id: 'shield1', name: 'Drewniana tarcza', slot: 'shield', tier: 1, level: 1, cls: 'warrior', armor: 5, value: 30 }),
  I({ id: 'shield2', name: 'Okuta tarcza', slot: 'shield', tier: 2, level: 3, cls: 'warrior', armor: 12, value: 120 }),
  I({ id: 'shield3', name: 'Tarcza Wieży', slot: 'shield', tier: 3, level: 5, cls: 'warrior', armor: 20, value: 360 }),
  I({ id: 'helm1', name: 'Skórzany kaptur', slot: 'helm', tier: 1, level: 1, armor: 5, value: 30 }),
  I({ id: 'helm2', name: 'Żelazny hełm', slot: 'helm', tier: 2, level: 3, armor: 12, value: 120 }),
  I({ id: 'helm3', name: 'Hełm Świtu', slot: 'helm', tier: 3, level: 5, armor: 20, value: 360 }),
  I({ id: 'armor1', name: 'Skórznia', slot: 'armor', tier: 1, level: 1, armor: 15, value: 50 }),
  I({ id: 'armor2', name: 'Kolczuga', slot: 'armor', tier: 2, level: 3, armor: 35, value: 200 }),
  I({ id: 'armor3', name: 'Zbroja płytowa', slot: 'armor', tier: 3, level: 5, armor: 60, value: 600 }),
  I({ id: 'boots1', name: 'Skórzane buty', slot: 'boots', tier: 1, level: 1, armor: 5, speed: 0.05, value: 50 }),
  I({ id: 'boots2', name: 'Buty wędrowca', slot: 'boots', tier: 2, level: 3, armor: 10, speed: 0.1, value: 250 }),
  I({ id: 'ring1', name: 'Pierścień Fortuny', slot: 'ring', tier: 2, level: 2, luck: 5, value: 200, special: true }),
  I({ id: 'gloves1', name: 'Rękawice łucznika', slot: 'gloves', tier: 2, level: 2, dex: 5, value: 180, special: true }),
  I({ id: 'amulet1', name: 'Amulet Wieży', slot: 'amulet', tier: 3, level: 4, hpPct: 0.1, value: 400, special: true }),
].map((d) => [d.id, d]));

export const RARITY_COLOR = (d: ItemDef) => (d.special ? '#a86af0' : d.tier === 3 ? '#4a8af0' : d.tier === 2 ? '#4ac04a' : '#b8b0a0');

/** opis przedmiotu do podpowiedzi (HTML) */
export function describe(d: ItemDef, level: number, cls: ClassId): string {
  const lines: string[] = [`<b style="color:${RARITY_COLOR(d)}">${d.name}</b>`, `<span class="t-dim">${SLOT_NAMES[d.slot]}${d.bow ? ' (łuk)' : ''}</span>`];
  if (d.min != null) lines.push(`Obrażenia ${d.min}–${d.max}`);
  if (d.armor) lines.push(`Pancerz ${d.armor}`);
  if (d.speed) lines.push(`+${Math.round(d.speed * 100)}% szybkości ruchu`);
  if (d.dex) lines.push(`+${d.dex} Zręczność`);
  if (d.luck) lines.push(`+${d.luck} Szczęście`);
  if (d.hpPct) lines.push(`+${Math.round(d.hpPct * 100)}% maks. zdrowia`);
  const req: string[] = [];
  if (d.level > 1) req.push(`<span style="color:${level >= d.level ? '#c8bca4' : '#ff8a7a'}">Wymagany poziom ${d.level}</span>`);
  if (d.cls) req.push(`<span style="color:${cls === d.cls ? '#c8bca4' : '#ff8a7a'}">Tylko ${d.cls === 'warrior' ? 'wojownik' : 'łowca'}</span>`);
  return [...lines, ...req, `<span class="t-dim">Wartość: ${d.value} zł</span>`].join('<br>');
}

// ------------------------------------------------------------------ ekwipunek
export interface Inventory {
  eq: Record<Slot, string | null>;
  bag: (string | null)[];
  hpPot: number;
  mpPot: number;
}

export function startInventory(cls: ClassId): Inventory {
  const eq = Object.fromEntries(SLOTS.map((s) => [s, null])) as Record<Slot, string | null>;
  eq.weapon = cls === 'warrior' ? 'sword1' : 'bow1';
  return { eq, bag: Array(BAG_SIZE).fill(null), hpPot: 0, mpPot: 0 };
}

/** powód, dla którego nie można założyć przedmiotu, albo null */
export function equipError(d: ItemDef, level: number, cls: ClassId): string | null {
  if (d.cls && d.cls !== cls) return `Tylko dla klasy ${d.cls === 'warrior' ? 'wojownik' : 'łowca'}.`;
  if (level < d.level) return `Wymagany poziom ${d.level}.`;
  return null;
}

export function addToBag(inv: Inventory, id: string): boolean {
  const i = inv.bag.indexOf(null);
  if (i < 0) return false;
  inv.bag[i] = id;
  return true;
}

/** załóż przedmiot z plecaka (zamiana z założonym); zwraca błąd albo null */
export function equipFromBag(inv: Inventory, bagIndex: number, level: number, cls: ClassId): string | null {
  const id = inv.bag[bagIndex];
  const d = id ? ITEMS[id] : undefined;
  if (!d) return 'Puste miejsce.';
  const e = equipError(d, level, cls);
  if (e) return e;
  inv.bag[bagIndex] = inv.eq[d.slot];
  inv.eq[d.slot] = d.id;
  return null;
}

/** zdejmij przedmiot do plecaka */
export function unequip(inv: Inventory, slot: Slot): string | null {
  if (!inv.eq[slot]) return null;
  if (!addToBag(inv, inv.eq[slot]!)) return 'Plecak jest pełny.';
  inv.eq[slot] = null;
  return null;
}

/** walidacja zapisanego ekwipunku: nieznane przedmioty znikają, rozmiary poprawione */
export function sanitizeInventory(raw: unknown, cls: ClassId): Inventory {
  const inv = startInventory(cls);
  if (!raw || typeof raw !== 'object') return inv;
  const r = raw as Partial<Inventory>;
  const ok = (x: unknown): x is string => typeof x === 'string' && x in ITEMS;
  if (r.eq && typeof r.eq === 'object') for (const s of SLOTS) {
    const v = (r.eq as Record<string, unknown>)[s];
    inv.eq[s] = ok(v) && ITEMS[v].slot === s ? v : null;
  }
  if (Array.isArray(r.bag)) for (let i = 0; i < BAG_SIZE; i++) inv.bag[i] = ok(r.bag[i]) ? r.bag[i] : null;
  inv.hpPot = Number.isInteger(r.hpPot) && r.hpPot! >= 0 ? r.hpPot! : 0;
  inv.mpPot = Number.isInteger(r.mpPot) && r.mpPot! >= 0 ? r.mpPot! : 0;
  return inv;
}

// ------------------------------------------------------------------ statystyki z ekwipunku
export interface Stats {
  attrs: Attributes;
  luck: number;
  armor: number;
  weapon: Weapon;
  bow: boolean;
  hpMax: number;
  manaMax: number;
  manaRegen: number;
  dodge: number;
  speed: number;
}

const FISTS: Weapon = { name: 'Pięści', min: 1, max: 3 };

/** szybkość ruchu ze Zręczności: do 30 bez zmian, potem +3% za każde pełne 10 punktów */
export const dexSpeed = (dex: number) => Math.floor(Math.max(0, dex - 30) / 10) * 0.03;

export function computeStats(base: Attributes, inv: Inventory): Stats {
  const items = SLOTS.map((s) => inv.eq[s]).filter((x): x is string => !!x).map((id) => ITEMS[id]);
  const attrs = { ...base, dex: base.dex + items.reduce((a, d) => a + (d.dex ?? 0), 0) };
  const dv = derived(attrs);
  const w = inv.eq.weapon ? ITEMS[inv.eq.weapon] : null;
  return {
    attrs,
    luck: items.reduce((a, d) => a + (d.luck ?? 0), 0),
    armor: items.reduce((a, d) => a + (d.armor ?? 0), 0),
    weapon: w ? { name: w.name, min: w.min!, max: w.max! } : FISTS,
    bow: !!w?.bow,
    hpMax: Math.round(dv.hp * (1 + items.reduce((a, d) => a + (d.hpPct ?? 0), 0))),
    manaMax: dv.mana,
    manaRegen: dv.manaRegen,
    dodge: dv.dodge,
    speed: 1 + items.reduce((a, d) => a + (d.speed ?? 0), 0) + dexSpeed(attrs.dex),
  };
}

// ------------------------------------------------------------------ łup
export const POTION_PCT = 0.15;
export const HP_POT_CHANCE = 0.2;
export const MP_POT_CHANCE = 0.15;
export const ITEM_CHANCE: Record<MobKind, number> = { wolf: 0.02, skeleton: 0.04, zombie: 0.06 };
/** wagi poziomów przedmiotów (1, 2, 3) wg potwora */
const TIER_WEIGHTS: Record<MobKind, [number, number, number]> = { wolf: [0.8, 0.18, 0.02], skeleton: [0.55, 0.37, 0.08], zombie: [0.35, 0.45, 0.2] };

export interface LootRoll { gold: number; hpPot: boolean; mpPot: boolean; item: string | null }

/** łup z potwora; Szczęście: +2% złota i +2% szansy na przedmiot za punkt */
export function rollLoot(kind: MobKind, luck: number, rng: Rng): LootRoll {
  const lk = 1 + 0.02 * luck;
  const gold = Math.max(1, Math.round((1 + Math.floor(rng() * 20)) * lk));
  const hpPot = rng() < HP_POT_CHANCE;
  const mpPot = rng() < MP_POT_CHANCE;
  let item: string | null = null;
  if (rng() < ITEM_CHANCE[kind] * lk) {
    const w = TIER_WEIGHTS[kind], r = rng();
    const tier = r < w[0] ? 1 : r < w[0] + w[1] ? 2 : 3;
    const pool = Object.values(ITEMS).filter((d) => d.tier === tier);
    item = pool[Math.floor(rng() * pool.length)].id;
  }
  return { gold, hpPot, mpPot, item };
}
