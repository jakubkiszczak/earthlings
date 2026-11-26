import { describe, expect, it } from 'vitest';
import { startInventory } from '../src/logic/items';
import { STASH_SIZE, StashStore, deposit, parseStash, withdraw } from '../src/logic/stash';

describe('skrzynia', () => {
  it('przenosi przedmioty między plecakiem a skrzynią', () => {
    const s = parseStash(null), inv = startInventory('warrior');
    inv.bag[3] = 'helm2';
    expect(deposit(s, inv, 3)).toBeNull();
    expect(inv.bag[3]).toBeNull();
    expect(s.items[0]).toBe('helm2');
    expect(withdraw(s, inv, 0)).toBeNull();
    expect(inv.bag[0]).toBe('helm2');
    expect(deposit(s, inv, 5)).toMatch(/Puste/);
  });

  it('pełna skrzynia i pełny plecak', () => {
    const s = parseStash(JSON.stringify({ items: Array(STASH_SIZE).fill('ring1') })), inv = startInventory('hunter');
    inv.bag[0] = 'helm1';
    expect(deposit(s, inv, 0)).toMatch(/pełna/);
    inv.bag.fill('helm1');
    expect(withdraw(s, inv, 0)).toMatch(/pełny/);
  });

  it('wspólna dla wszystkich postaci: ten sam zapis w pamięci przeglądarki', () => {
    const mem = new Map<string, string>();
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const a = new StashStore(st), b = new StashStore(st);
    const s = a.load();
    s.items[2] = 'amulet1';
    a.save(s);
    expect(b.load().items[2]).toBe('amulet1');
    expect(parseStash('{zly').items.every((x) => x === null)).toBe(true);
    expect(parseStash(JSON.stringify({ items: ['nieznany'] })).items[0]).toBeNull();
  });
});
