import { describe, expect, it } from 'vitest';
import { BAG_SIZE, ITEMS, startInventory } from '../src/logic/items';
import { buy, potionSellPrice, sellBag, sellPotion, sellPrice, type Wallet } from '../src/logic/shop';

const wallet = (gold: number, cls: 'warrior' | 'hunter' = 'hunter'): Wallet => ({ gold, arrows: 0, inv: startInventory(cls), cls });

describe('sklep', () => {
  it('kupno strzał: 100 za 10 zł, tylko łowca', () => {
    const w = wallet(25);
    expect(buy(w, 'arrows')).toBeNull();
    expect([w.gold, w.arrows]).toEqual([15, 100]);
    expect(buy(wallet(100, 'warrior'), 'arrows')).toMatch(/łowcy/);
  });

  it('kupno butów do plecaka, brak złota, pełny plecak', () => {
    const w = wallet(60, 'warrior');
    expect(buy(w, 'boots1')).toBeNull();
    expect(w.gold).toBe(10);
    expect(w.inv.bag).toContain('boots1');
    expect(buy(w, 'boots2')).toMatch(/Brakuje 240/);
    const full = wallet(500);
    full.inv.bag = Array(BAG_SIZE).fill('helm1');
    expect(buy(full, 'boots1')).toMatch(/pełny/);
    expect(full.gold).toBe(500);
  });

  it('skup za 25% wartości', () => {
    expect(sellPrice('armor3')).toBe(Math.floor(ITEMS.armor3.value / 4));
    const w = wallet(0);
    w.inv.bag[2] = 'sword2';
    expect(sellBag(w, 2)).toBe(40);
    expect(w.inv.bag[2]).toBeNull();
    expect(w.gold).toBe(40);
    expect(sellBag(w, 2)).toBe(0);
  });

  it('skup mikstur', () => {
    const w = wallet(0);
    w.inv.hpPot = 1;
    expect(sellPotion(w, 'hp')).toBe(potionSellPrice());
    expect(sellPotion(w, 'hp')).toBe(0);
    expect(w.inv.hpPot).toBe(0);
  });
});
