// Ekwipunek gracza w grze: przedmioty, mikstury, złoto, punkty atrybutów → statystyki i widok panelu.
import { ATTRS, addAttrs, baseAttributes, type AttrId, type Attributes, type ClassId, type Race } from '../logic/character';
import {
  ITEMS, POTION_PCT, RARITY_COLOR, SLOTS, SLOT_NAMES, addToBag, computeStats, describe, equipFromBag, equipError, sanitizeInventory, unequip,
  type Inventory, type Slot, type Stats,
} from '../logic/items';
import { damageRange } from '../logic/combat';
import type { InvCell, InvView } from '../types';
import { itemIcon } from '../ui/icons';

/** miejsca panelu HUD ↔ miejsca ekwipunku */
export const PANEL: Record<Slot, string> = { weapon: 'sword', shield: 'shield', helm: 'helm', armor: 'chest', gloves: 'gloves', boots: 'boots', ring: 'ring', amulet: 'amulet' };

export interface InvOwner { race: Race; cls: ClassId; alloc: Attributes; level: number; points: number; gold: number; inv?: unknown }

export class InventoryController {
  inv: Inventory;
  alloc: Attributes;
  points: number;
  gold: number;
  stats!: Stats;
  /** wywoływane po każdej zmianie statystyk lub wyglądu */
  onChange: (gearChanged: boolean) => void = () => undefined;
  onMessage: (msg: string) => void = () => undefined;

  constructor(private readonly o: InvOwner, private readonly icons: Record<string, string>, public level: () => number) {
    this.inv = sanitizeInventory(o.inv, o.cls);
    this.alloc = { ...o.alloc };
    this.points = o.points;
    this.gold = o.gold;
    this.recompute();
  }

  get cls() { return this.o.cls; }
  get baseAttrs(): Attributes { return addAttrs(baseAttributes(this.o.race, this.o.cls), this.alloc); }

  recompute() { this.stats = computeStats(this.baseAttrs, this.inv); }

  /** poziomy widocznych elementów ekwipunku (do wyglądu postaci) */
  gear() {
    const t = (s: Slot) => (this.inv.eq[s] ? ITEMS[this.inv.eq[s]!].tier : 0);
    return { weapon: t('weapon'), shield: t('shield'), armor: t('armor'), helm: t('helm'), boots: t('boots'), gloves: this.inv.eq.gloves ? 1 : 0 };
  }

  addItem(id: string): boolean {
    if (!addToBag(this.inv, id)) { this.onMessage('Plecak jest pełny.'); return false; }
    this.onChange(false);
    return true;
  }

  addPotion(kind: 'hp' | 'mp') { if (kind === 'hp') this.inv.hpPot++; else this.inv.mpPot++; this.onChange(false); }

  /** wypicie mikstury: zwraca ile przywraca (15% maksimum) albo 0 */
  drink(kind: 'hp' | 'mp'): number {
    if (kind === 'hp' ? this.inv.hpPot <= 0 : this.inv.mpPot <= 0) return 0;
    if (kind === 'hp') this.inv.hpPot--; else this.inv.mpPot--;
    this.onChange(false);
    return Math.round((kind === 'hp' ? this.stats.hpMax : this.stats.manaMax) * POTION_PCT);
  }

  click(kind: 'eq' | 'bag', key: string | number) {
    let err: string | null = null;
    if (kind === 'bag') {
      const i = key as number;
      if (!this.inv.bag[i]) return;
      err = equipFromBag(this.inv, i, this.level(), this.cls);
    } else {
      const slot = (Object.keys(PANEL) as Slot[]).find((s) => PANEL[s] === key);
      if (!slot || !this.inv.eq[slot]) return;
      err = unequip(this.inv, slot);
    }
    if (err) { this.onMessage(err); return; }
    this.recompute();
    this.onChange(true);
  }

  addPoint(attr: string) {
    if (this.points <= 0 || !['str', 'dex', 'vit', 'ene'].includes(attr)) return;
    this.points--;
    this.alloc = { ...this.alloc, [attr]: this.alloc[attr as AttrId] + 1 };
    this.recompute();
    this.onChange(false);
  }

  private cell(id: string | null): InvCell | null {
    if (!id) return null;
    const d = ITEMS[id];
    const usable = !equipError(d, this.level(), this.cls);
    return { icon: itemIcon(id, this.icons), color: RARITY_COLOR(d), tip: describe(d, this.level(), this.cls) + '<br><span class="t-dim">Kliknij, aby założyć</span>', dim: !usable };
  }

  view(): InvView {
    const eq: Record<string, InvCell | null> = {}, eqNames: Record<string, string> = {};
    for (const s of SLOTS) {
      const c = this.cell(this.inv.eq[s]);
      if (c) c.tip = c.tip.replace('Kliknij, aby założyć', 'Kliknij, aby zdjąć');
      eq[PANEL[s]] = c;
      eqNames[PANEL[s]] = SLOT_NAMES[s];
    }
    const bag = this.inv.bag.map((id) => {
      const c = this.cell(id);
      if (c) c.tip = c.tip.replace('Kliknij, aby zdjąć', 'Kliknij, aby założyć');
      return c;
    });
    const s = this.stats, a = s.attrs;
    const [dmin, dmax] = damageRange(this.cls, a, s.weapon);
    const plus = (id: AttrId) => (this.points > 0 ? `<button class="ip" data-a="${id}" aria-label="${ATTRS.find((x) => x.id === id)!.name} plus">+</button>` : '');
    const statsHtml =
      `<span>Siła</span><b>${a.str}${plus('str')}</b><span>Zręczność</span><b>${a.dex}${plus('dex')}</b>` +
      `<span>Witalność</span><b>${a.vit}${plus('vit')}</b><span>Energia</span><b>${a.ene}${plus('ene')}</b>` +
      `<span>Pancerz</span><b>${s.armor}</b><span>Obrażenia</span><b>${dmin}–${dmax}</b>` +
      `<span>Szczęście</span><b>${s.luck}</b><span>Mikstury</span><b>${this.inv.hpPot} / ${this.inv.mpPot}</b>`;
    return { eq, eqNames, bag, statsHtml, gold: this.gold, points: this.points };
  }
}
