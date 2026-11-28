// Postać: rasy, klasy, atrybuty i wartości pochodne (wg docs/PLAN_PROTOTYPU.md). Czysta logika, bez grafiki.

export type Race = 'human' | 'elf';
export type ClassId = 'warrior' | 'hunter';
export type Hair = 'black' | 'white' | 'blond' | 'brown' | 'bald';
export type Build = 'thin' | 'normal' | 'stocky';
export type Beard = 'short' | 'long' | 'mustache' | 'none';
export type AttrId = 'str' | 'dex' | 'vit' | 'ene';

export interface Attributes { str: number; dex: number; vit: number; ene: number }
export type Gender = 'male' | 'female';
export interface Look { hair: Hair; build: Build; beard: Beard; gender?: Gender }

export const RACES: Record<Race, { name: string; bonus: Partial<Attributes> }> = {
  human: { name: 'Człowiek', bonus: { str: 2, vit: 2 } },
  elf: { name: 'Elf', bonus: { dex: 2, ene: 2 } },
};

export const CLASSES: Record<ClassId, { name: string; base: Attributes }> = {
  warrior: { name: 'Wojownik', base: { str: 20, dex: 10, vit: 20, ene: 10 } },
  hunter: { name: 'Łowca', base: { str: 10, dex: 20, vit: 15, ene: 15 } },
};

export const ATTRS: { id: AttrId; name: string; hint: string }[] = [
  { id: 'str', name: 'Siła', hint: 'obrażenia wręcz' },
  { id: 'dex', name: 'Zręczność', hint: 'obrażenia z łuku, unik' },
  { id: 'vit', name: 'Witalność', hint: 'punkty zdrowia' },
  { id: 'ene', name: 'Energia', hint: 'mana i jej odnawianie' },
];

export const HAIRS: { id: Hair; name: string }[] = [
  { id: 'black', name: 'Czarne' }, { id: 'white', name: 'Białe' }, { id: 'blond', name: 'Blond' },
  { id: 'brown', name: 'Brązowe' }, { id: 'bald', name: 'Łysy' },
];
export const BUILDS: { id: Build; name: string }[] = [
  { id: 'thin', name: 'Chudy' }, { id: 'normal', name: 'Normalny' }, { id: 'stocky', name: 'Krępy' },
];
export const GENDERS: { id: Gender; name: string }[] = [{ id: 'male', name: 'Mężczyzna' }, { id: 'female', name: 'Kobieta' }];
export const BEARDS: { id: Beard; name: string }[] = [
  { id: 'short', name: 'Krótka' }, { id: 'long', name: 'Długa' }, { id: 'mustache', name: 'Wąsy' },
];

/** punkty do rozdzielenia przy tworzeniu postaci */
export const START_POINTS = 10;
/** punkty za każdy awans */
export const POINTS_PER_LEVEL = 5;
export const MAX_LEVEL = 5;
/** exp potrzebny na awans z poziomu n na n+1 (indeks = n) */
export const EXP_TO_NEXT = [0, 1000, 1300, 1800, 2500];

/** atrybuty bazowe: klasa + bonus rasy (bez rozdzielonych punktów) */
export function baseAttributes(race: Race, cls: ClassId): Attributes {
  const b = CLASSES[cls].base, r = RACES[race].bonus;
  return { str: b.str + (r.str ?? 0), dex: b.dex + (r.dex ?? 0), vit: b.vit + (r.vit ?? 0), ene: b.ene + (r.ene ?? 0) };
}

export const addAttrs = (a: Attributes, b: Attributes): Attributes =>
  ({ str: a.str + b.str, dex: a.dex + b.dex, vit: a.vit + b.vit, ene: a.ene + b.ene });

export const sumAttrs = (a: Attributes) => a.str + a.dex + a.vit + a.ene;

export interface Derived { hp: number; mana: number; manaRegen: number; dodge: number }

/** wartości pochodne z atrybutów (formuły z planu) */
export function derived(a: Attributes): Derived {
  return {
    hp: 100 + 10 * a.vit,
    mana: 20 + 5 * a.ene,
    manaRegen: 1 + a.ene / 20,
    dodge: Math.min(25, a.dex * 0.5),
  };
}

/** czy rozdział punktów jest poprawny: nieujemne, suma ≤ dostępne */
export function validAllocation(alloc: Attributes, available: number): boolean {
  const v = [alloc.str, alloc.dex, alloc.vit, alloc.ene];
  return v.every((x) => Number.isInteger(x) && x >= 0) && sumAttrs(alloc) <= available;
}

/** nazwa: 3–16 znaków, litery (także polskie), cyfry i pojedyncze spacje; zwraca błąd albo null */
export function nameError(name: string, taken: string[] = []): string | null {
  const n = name.trim();
  if (n.length < 3) return 'Nazwa musi mieć co najmniej 3 znaki.';
  if (n.length > 16) return 'Nazwa może mieć najwyżej 16 znaków.';
  if (!/^[\p{L}\d]+( [\p{L}\d]+)*$/u.test(n)) return 'Dozwolone są litery, cyfry i pojedyncze spacje.';
  if (taken.some((t) => t.toLowerCase() === n.toLowerCase())) return 'Masz już postać o tej nazwie.';
  return null;
}

/** elf nie ma brody – poprawia wygląd do zgodnego z rasą */
export function normalizeLook(race: Race, look: Look): Look {
  const gender = look.gender ?? 'male';
  return race === 'elf' || gender === 'female' ? { ...look, gender, beard: 'none' } : { ...look, gender, beard: look.beard === 'none' ? 'short' : look.beard };
}
