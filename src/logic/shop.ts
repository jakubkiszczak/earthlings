// Sklep w mieście: kupno strzał i butów, skup przedmiotów i mikstur za 25% wartości. Czysta logika.
import type { ClassId } from './character';
import { ITEMS, addToBag, type Inventory } from './items';

export const SELL_RATE = 0.25;
export const POTION_VALUE = 20;
export const ARROW_PACK = 100;

export interface Offer { id: string; name: string; price: number; desc: string; item?: string; arrows?: number; cls?: ClassId }

export const OFFERS: Offer[] = [
  { id: 'arrows', name: `Strzały ×${ARROW_PACK}`, price: 10, desc: 'Łowca zużywa 1 strzałę na strzał.', arrows: ARROW_PACK, cls: 'hunter' },
  { id: 'boots1', name: ITEMS.boots1.name, price: 50, desc: 'Pancerz 5, +5% szybkości ruchu.', item: 'boots1' },
  { id: 'boots2', name: ITEMS.boots2.name, price: 250, desc: 'Pancerz 10, +10% szybkości ruchu. Wymagany poziom 3.', item: 'boots2' },
];

export interface Wallet { gold: number; arrows: number; inv: Inventory; cls: ClassId }

/** kupno; zwraca błąd albo null (portfel zmieniony) */
export function buy(w: Wallet, offerId: string): string | null {
  const o = OFFERS.find((x) => x.id === offerId);
  if (!o) return 'Nie ma takiego towaru.';
  if (o.cls && o.cls !== w.cls) return 'Tego towaru nie potrzebujesz (tylko dla łowcy).';
  if (w.gold < o.price) return `Brakuje ${o.price - w.gold} zł.`;
  if (o.item && !addToBag(w.inv, o.item)) return 'Plecak jest pełny.';
  if (o.arrows) w.arrows += o.arrows;
  w.gold -= o.price;
  return null;
}

export const sellPrice = (itemId: string) => Math.max(1, Math.floor(ITEMS[itemId].value * SELL_RATE));
export const potionSellPrice = () => Math.floor(POTION_VALUE * SELL_RATE);

/** sprzedaż przedmiotu z plecaka; zwraca uzyskane złoto albo 0 */
export function sellBag(w: Wallet, bagIndex: number): number {
  const id = w.inv.bag[bagIndex];
  if (!id) return 0;
  const p = sellPrice(id);
  w.inv.bag[bagIndex] = null;
  w.gold += p;
  return p;
}

/** sprzedaż jednej mikstury */
export function sellPotion(w: Wallet, kind: 'hp' | 'mp'): number {
  if (kind === 'hp' ? w.inv.hpPot <= 0 : w.inv.mpPot <= 0) return 0;
  if (kind === 'hp') w.inv.hpPot--; else w.inv.mpPot--;
  const p = potionSellPrice();
  w.gold += p;
  return p;
}
