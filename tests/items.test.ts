import { describe, expect, it } from 'vitest';
import { seeded } from '../src/logic/combat';
import {
  BAG_SIZE, ITEMS, addToBag, computeStats, equipError, equipFromBag, rollLoot, sanitizeInventory, startInventory, unequip,
} from '../src/logic/items';

const base = { str: 22, dex: 10, vit: 22, ene: 10 };

describe('przedmioty', () => {
  it('jest 20 przedmiotów, każdy z wartością', () => {
    expect(Object.keys(ITEMS)).toHaveLength(20);
    for (const d of Object.values(ITEMS)) expect(d.value).toBeGreaterThan(0);
  });

  it('wymagania klasy i poziomu', () => {
    expect(equipError(ITEMS.bow1, 1, 'warrior')).toMatch(/łowca/);
    expect(equipError(ITEMS.sword3, 3, 'warrior')).toMatch(/poziom 5/);
    expect(equipError(ITEMS.helm1, 1, 'hunter')).toBeNull();
  });
});

describe('ekwipunek', () => {
  it('start: wojownik z krótkim mieczem, łowca z krótkim łukiem', () => {
    expect(startInventory('warrior').eq.weapon).toBe('sword1');
    expect(startInventory('hunter').eq.weapon).toBe('bow1');
    expect(startInventory('hunter').bag).toHaveLength(BAG_SIZE);
  });

  it('zakładanie z plecaka zamienia z założonym, zdejmowanie wraca do plecaka', () => {
    const inv = startInventory('warrior');
    addToBag(inv, 'sword2');
    expect(equipFromBag(inv, 0, 3, 'warrior')).toBeNull();
    expect(inv.eq.weapon).toBe('sword2');
    expect(inv.bag[0]).toBe('sword1');
    expect(unequip(inv, 'weapon')).toBeNull();
    expect(inv.eq.weapon).toBeNull();
    expect(inv.bag.filter(Boolean).sort()).toEqual(['sword1', 'sword2']);
  });

  it('pełny plecak', () => {
    const inv = startInventory('warrior');
    for (let i = 0; i < BAG_SIZE; i++) expect(addToBag(inv, 'helm1')).toBe(true);
    expect(addToBag(inv, 'helm1')).toBe(false);
    expect(unequip(inv, 'weapon')).toMatch(/pełny/);
  });

  it('statystyki: pancerz, Zręczność z rękawic, Szczęście, +10% HP, szybkość z butów, broń', () => {
    const inv = startInventory('warrior');
    Object.assign(inv.eq, { armor: 'armor2', helm: 'helm1', shield: 'shield1', boots: 'boots2', gloves: 'gloves1', ring: 'ring1', amulet: 'amulet1' });
    const s = computeStats(base, inv);
    expect(s.armor).toBe(35 + 5 + 5 + 10);
    expect(s.attrs.dex).toBe(15);
    expect(s.luck).toBe(5);
    expect(s.hpMax).toBe(Math.round((100 + 220) * 1.1));
    expect(s.speed).toBeCloseTo(1.1);
    expect(s.weapon).toMatchObject({ min: 8, max: 12 });
    inv.eq.weapon = null;
    expect(computeStats(base, inv).weapon).toMatchObject({ min: 1, max: 3 });
  });

  it('Zręczność: do 30 bez zmian szybkości, potem +3% za każde 10', () => {
    const inv = startInventory('hunter');
    expect(computeStats({ ...base, dex: 30 }, inv).speed).toBeCloseTo(1);
    expect(computeStats({ ...base, dex: 39 }, inv).speed).toBeCloseTo(1);
    expect(computeStats({ ...base, dex: 40 }, inv).speed).toBeCloseTo(1.03);
    expect(computeStats({ ...base, dex: 60 }, inv).speed).toBeCloseTo(1.09);
    inv.eq.boots = 'boots1';
    expect(computeStats({ ...base, dex: 40 }, inv).speed).toBeCloseTo(1.08);
  });

  it('zapis: nieznane i błędne przedmioty są pomijane', () => {
    const inv = sanitizeInventory({ eq: { weapon: 'sword2', helm: 'sword1', ring: 'xyz' }, bag: ['armor1', 'zlo', null], hpPot: 3, mpPot: -1 }, 'warrior');
    expect(inv.eq.weapon).toBe('sword2');
    expect(inv.eq.helm).toBeNull();
    expect(inv.eq.ring).toBeNull();
    expect(inv.bag.slice(0, 3)).toEqual(['armor1', null, null]);
    expect([inv.hpPot, inv.mpPot]).toEqual([3, 0]);
    expect(sanitizeInventory(null, 'hunter').eq.weapon).toBe('bow1');
  });
});

describe('łup', () => {
  it('złoto 1–20, mikstury ok. 20% i 15%, przedmioty rzadko', () => {
    const rng = seeded(42);
    let gold = 0, hp = 0, mp = 0, items = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const l = rollLoot('skeleton', 0, rng);
      expect(l.gold).toBeGreaterThanOrEqual(1);
      expect(l.gold).toBeLessThanOrEqual(20);
      gold += l.gold; hp += +l.hpPot; mp += +l.mpPot; items += +!!l.item;
    }
    expect(gold / N).toBeGreaterThan(9.5);
    expect(gold / N).toBeLessThan(11.5);
    expect(hp / N).toBeCloseTo(0.2, 1);
    expect(mp / N).toBeCloseTo(0.15, 1);
    expect(items / N).toBeCloseTo(0.04, 1);
  });

  it('Szczęście zwiększa złoto', () => {
    const a = rollLoot('wolf', 0, () => 0.999), b = rollLoot('wolf', 10, () => 0.999);
    expect(b.gold).toBeGreaterThan(a.gold);
  });
});
