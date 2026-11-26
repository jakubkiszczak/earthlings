// Okno handlu u kupca: kupno (strzały, buty) i sprzedaż przedmiotów z plecaka oraz mikstur.
import './shop.css';

export interface ShopRow { key: string; icon: string; name: string; price: number; color?: string; note?: string; disabled?: boolean; count?: number }
export interface ShopState { gold: number; buy: ShopRow[]; sell: ShopRow[]; message?: string }

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export class ShopWindow {
  private readonly root = document.createElement('div');
  open = false;

  constructor(host: HTMLElement, private readonly onBuy: (key: string) => void, private readonly onSell: (key: string) => void, private readonly onClose: () => void) {
    this.root.className = 'shop panel9';
    this.root.style.display = 'none';
    host.append(this.root);
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!b || b.disabled) return;
      if (b.dataset.buy) this.onBuy(b.dataset.buy);
      else if (b.dataset.sell) this.onSell(b.dataset.sell);
      else if (b.classList.contains('sclose')) this.onClose();
    });
    addEventListener('keydown', (e) => { if (this.open && e.key === 'Escape') this.onClose(); });
  }

  show(s: ShopState) { this.open = true; this.root.style.display = ''; this.render(s); }
  hide() { this.open = false; this.root.style.display = 'none'; }

  render(s: ShopState) {
    if (!this.open) return;
    const row = (r: ShopRow, attr: 'buy' | 'sell') =>
      `<button class="srow" data-${attr}="${esc(r.key)}"${r.disabled ? ' disabled' : ''} title="${esc(r.note ?? '')}">` +
      `<img class="px" src="${r.icon}" alt=""><span class="sname" style="color:${r.color ?? '#e8e2d4'}">${esc(r.name)}${r.count != null ? ` <small>×${r.count}</small>` : ''}</span>` +
      `<b class="sprice">${attr === 'buy' ? '' : '+'}${r.price} zł</b></button>`;
    this.root.innerHTML =
      `<div class="shead"><span>Kupiec Bronek</span><button class="sclose" aria-label="Zamknij">×</button></div>` +
      `<div class="sgreet">„Strzały, buty na drogę… a i chętnie kupię to, co przyniesiesz z dziczy.”</div>` +
      `<div class="scols"><div class="scol"><h4>Kupno</h4>${s.buy.map((r) => row(r, 'buy')).join('')}</div>` +
      `<div class="scol"><h4>Sprzedaż <small>(25% wartości)</small></h4>${s.sell.length ? s.sell.map((r) => row(r, 'sell')).join('') : '<div class="sempty">Nie masz nic na sprzedaż.</div>'}</div></div>` +
      `<div class="sfoot"><span class="smsg">${esc(s.message ?? '')}</span><span>Złoto: <b>${s.gold.toLocaleString('pl-PL')}</b></span></div>`;
  }
}
