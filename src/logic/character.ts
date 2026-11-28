// Postać: rasy, klasy, atrybuty i wartości pochodne (wg docs/PLAN_PROTOTYPU.md). Czysta logika, bez grafiki.

export type Race = 'human' | 'elf';
export type ClassId = 'warrior' | 'hunter';
/** kolor włosów i brody (palety z assets/art/sprites/appearance/palettes.json) */
export type HairColor = 'brown' | 'black' | 'blond' | 'red' | 'platinum' | 'gray';
/** kolor skóry z grafik paczki: tony ciała człowieka albo elfa */
export type Skin = 'warm' | 'fair';
export type AttrId = 'str' | 'dex' | 'vit' | 'ene';

export interface Attributes { str: number; dex: number; vit: number; ene: number }
export type Gender = 'male' | 'female';
/** wygląd postaci gracza (paper doll, items.json → appearance); hair i beard to nazwy fryzury i brody */
export interface Look { gender: Gender; skin: Skin; hair: string; hairColor: HairColor; beard: string; beardColor: HairColor }

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

export const GENDERS: { id: Gender; name: string }[] = [{ id: 'male', name: 'Mężczyzna' }, { id: 'female', name: 'Kobieta' }];
export const SKINS: { id: Skin; name: string; swatch: string }[] = [
  { id: 'warm', name: 'Śniada', swatch: '#da945c' }, { id: 'fair', name: 'Jasna', swatch: '#f6d4aa' },
];
/** fryzury z paczki (kolejność i nazwy plików jak w items.json → appearance.hair_styles) */
export const HAIR_STYLES: Record<Gender, { id: string; name: string }[]> = {
  male: [{ id: 'short', name: 'Krótkie' }, { id: 'buzz', name: 'Na jeża' }, { id: 'long', name: 'Długie' }, { id: 'ponytail', name: 'Kucyk' }],
  female: [{ id: 'long', name: 'Długie' }, { id: 'ponytail', name: 'Kucyk' }, { id: 'bob', name: 'Bob' }, { id: 'bun', name: 'Kok' }],
};
export const HAIR_COLORS: { id: HairColor; name: string; swatch: string }[] = [
  { id: 'brown', name: 'Brązowe', swatch: '#a5532a' }, { id: 'black', name: 'Czarne', swatch: '#444254' },
  { id: 'blond', name: 'Blond', swatch: '#deb460' }, { id: 'red', name: 'Rude', swatch: '#c65a28' },
  { id: 'platinum', name: 'Platynowe', swatch: '#d4ceb6' }, { id: 'gray', name: 'Siwe', swatch: '#a2a2a8' },
];
/** brody (tylko człowiek-mężczyzna) */
export const BEARDS: { id: string; name: string }[] = [
  { id: 'none', name: 'Bez brody' }, { id: 'stubble', name: 'Zarost' }, { id: 'medium', name: 'Średnia' },
  { id: 'long', name: 'Długa' }, { id: 'mustache', name: 'Wąsy' },
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

const OLD_COLOR: Record<string, HairColor> = { black: 'black', white: 'platinum', blond: 'blond', brown: 'brown', bald: 'brown' };
const OLD_BEARD: Record<string, string> = { short: 'medium', long: 'long', mustache: 'mustache', none: 'none' };
export const canHaveBeard = (race: Race, gender: Gender) => race === 'human' && gender === 'male';
export const defaultLook = (race: Race, gender: Gender = 'male'): Look =>
  ({ gender, skin: race === 'elf' ? 'fair' : 'warm', hair: HAIR_STYLES[gender][0].id, hairColor: 'brown', beard: 'none', beardColor: 'brown' });

/** wygląd zgodny z rasą i płcią: elfy i kobiety bez brody, fryzura z listy danej płci; zapis w starym formacie
 *  (kolor włosów w polu hair, budowa ciała) zamieniany na nowy */
export function normalizeLook(race: Race, look0: Partial<Look> | object): Look {
  const look = look0 as Partial<Look> & Record<string, unknown>;
  const gender: Gender = look.gender === 'female' ? 'female' : 'male';
  const d = defaultLook(race, gender);
  const isColor = (c: unknown): c is HairColor => HAIR_COLORS.some((h) => h.id === c);
  const old = !('hairColor' in look) && typeof look.hair === 'string' && look.hair in OLD_COLOR;
  const hairColor = old ? OLD_COLOR[look.hair as string] : isColor(look.hairColor) ? look.hairColor : d.hairColor;
  const hair = !old && HAIR_STYLES[gender].some((h) => h.id === look.hair) ? (look.hair as string) : d.hair;
  const beardId = old ? OLD_BEARD[look.beard as string] ?? 'none' : (look.beard as string);
  const beard = canHaveBeard(race, gender) && BEARDS.some((b) => b.id === beardId) ? beardId : 'none';
  const skin: Skin = look.skin === 'warm' || look.skin === 'fair' ? look.skin : d.skin;
  return { gender, skin, hair, hairColor, beard, beardColor: isColor(look.beardColor) ? look.beardColor : hairColor };
}
