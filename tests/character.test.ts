import { describe, expect, it } from 'vitest';
import { addAttrs, baseAttributes, derived, nameError, normalizeLook, validAllocation } from '../src/logic/character';
import { MAX_CHARS, SaveStore, parseSave, serializeSave, type SavedChar } from '../src/logic/save';

describe('atrybuty', () => {
  it('baza = klasa + bonus rasy', () => {
    expect(baseAttributes('human', 'warrior')).toEqual({ str: 22, dex: 10, vit: 22, ene: 10 });
    expect(baseAttributes('elf', 'hunter')).toEqual({ str: 10, dex: 22, vit: 15, ene: 17 });
  });

  it('przykład z planu: wojownik-człowiek z 5 pkt w Witalności → 370 HP, 70 many', () => {
    const a = addAttrs(baseAttributes('human', 'warrior'), { str: 0, dex: 0, vit: 5, ene: 0 });
    expect(derived(a).hp).toBe(370);
    expect(derived(a).mana).toBe(70);
  });

  it('unik ograniczony do 25%', () => {
    expect(derived({ str: 0, dex: 100, vit: 0, ene: 0 }).dodge).toBe(25);
  });

  it('rozdział punktów', () => {
    expect(validAllocation({ str: 4, dex: 3, vit: 3, ene: 0 }, 10)).toBe(true);
    expect(validAllocation({ str: 11, dex: 0, vit: 0, ene: 0 }, 10)).toBe(false);
    expect(validAllocation({ str: -1, dex: 0, vit: 0, ene: 0 }, 10)).toBe(false);
    expect(validAllocation({ str: 1.5, dex: 0, vit: 0, ene: 0 }, 10)).toBe(false);
  });
});

describe('nazwa i wygląd', () => {
  it('waliduje nazwę', () => {
    expect(nameError('Bo')).toMatch(/3 znaki/);
    expect(nameError('Łucja z Lasu')).toBeNull();
    expect(nameError('a'.repeat(17))).toMatch(/16/);
    expect(nameError('zły<script>')).toMatch(/Dozwolone/);
    expect(nameError('dwie  spacje')).toMatch(/Dozwolone/);
    expect(nameError('Aren', ['aren'])).toMatch(/już/);
  });

  it('elfy i kobiety nie mają brody; fryzura z listy danej płci', () => {
    const m = { gender: 'male', skin: 'warm', hair: 'long', hairColor: 'red', beard: 'medium', beardColor: 'gray' } as const;
    expect(normalizeLook('human', m)).toEqual(m);
    expect(normalizeLook('elf', m).beard).toBe('none');
    expect(normalizeLook('human', { ...m, gender: 'female' }).beard).toBe('none');
    expect(normalizeLook('human', { ...m, gender: 'female', hair: 'buzz' }).hair).toBe('long');
    expect(normalizeLook('elf', { gender: 'female' }).skin).toBe('fair');
  });

  it('stary zapis wyglądu (kolor w polu hair, budowa ciała) zamieniany na nowy', () => {
    expect(normalizeLook('human', { hair: 'white', build: 'thin', beard: 'short' } as never))
      .toEqual({ gender: 'male', skin: 'warm', hair: 'short', hairColor: 'platinum', beard: 'medium', beardColor: 'platinum' });
  });
});

const char = (id: string, name = 'Aren'): SavedChar => ({
  id, name, race: 'human', cls: 'warrior', look: { gender: 'male', skin: 'warm', hair: 'short', hairColor: 'brown', beard: 'none', beardColor: 'brown' },
  alloc: { str: 5, dex: 0, vit: 5, ene: 0 }, level: 1, exp: 0, gold: 0, pos: null, created: 1, played: 1,
});

describe('zapis', () => {
  it('odczyt pustego i uszkodzonego zapisu daje pustą listę', () => {
    expect(parseSave(null).chars).toEqual([]);
    expect(parseSave('{nie json').chars).toEqual([]);
    expect(parseSave(JSON.stringify({ version: 99, chars: [char('a')] })).chars).toEqual([]);
  });

  it('pomija niepoprawne postacie', () => {
    const bad = { ...char('b'), race: 'ork' };
    const s = parseSave(JSON.stringify({ version: 1, chars: [char('a'), bad] }));
    expect(s.chars.map((c) => c.id)).toEqual(['a']);
  });

  it('zapisuje, aktualizuje, ogranicza do 3 postaci i usuwa', () => {
    const mem = new Map<string, string>();
    const st = new SaveStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
    for (let i = 0; i < MAX_CHARS; i++) expect(st.upsert(char(`c${i}`, `Postac${i}`))).toBe(true);
    expect(st.upsert(char('c9'))).toBe(false);
    expect(st.upsert({ ...char('c1', 'Postac1'), gold: 50 })).toBe(true);
    expect(st.list().find((c) => c.id === 'c1')!.gold).toBe(50);
    st.remove('c0');
    expect(st.list().map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(parseSave(serializeSave(st.load())).chars).toHaveLength(2);
  });

  it('bez dostępu do pamięci przeglądarki nie wybucha', () => {
    const st = new SaveStore({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(st.list()).toEqual([]);
    expect(st.upsert(char('x'))).toBe(false);
  });
});
