// Okno skrzyni przy fontannie: kliknięcie przedmiotu przenosi go między plecakiem a skrzynią.
import './shop.css';

export interface StashRow { key: string; icon: string; name: string; color: string }
export interface StashState { bag: StashRow[]; stash: StashRow[]; free: number; message?: string }

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export class StashWindow {
  private readonly root = document.createElement('div');
  open = false;

  constructor(host: HTMLElement, private readonly onMove: (key: string) => void, private readonly onClose: () => void) {
    this.root.className = 'shop stash panel9';
    this.root.style.display = 'none';
    host.append(this.root);
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (!b) return;
      if (b.dataset.move) this.onMove(b.dataset.move);
      else if (b.classList.contains('sclose')) this.onClose();
    });
    addEventListener('keydown', (e) => { if (this.open && e.key === 'Escape') this.onClose(); });
  }

  show(s: StashState) { this.open = true; this.root.style.display = ''; this.render(s); }
  hide() { this.open = false; this.root.style.display = 'none'; }

  render(s: StashState) {
    if (!this.open) return;
    const row = (r: StashRow) => `<button class="srow" data-move="${esc(r.key)}"><img class="px" src="${r.icon}" alt=""><span class="sname" style="color:${r.color}">${esc(r.name)}</span><b class="sprice">${r.key.startsWith('bag') ? '→' : '←'}</b></button>`;
    this.root.innerHTML =
      `<div class="shead"><span>Twoja skrzynia</span><button class="sclose" aria-label="Zamknij">×</button></div>` +
      `<div class="sgreet">Wspólna dla wszystkich twoich postaci. Kliknij przedmiot, aby go przenieść.</div>` +
      `<div class="scols"><div class="scol"><h4>Plecak</h4>${s.bag.length ? s.bag.map(row).join('') : '<div class="sempty">Plecak jest pusty.</div>'}</div>` +
      `<div class="scol"><h4>Skrzynia <small>(wolne: ${s.free})</small></h4>${s.stash.length ? s.stash.map(row).join('') : '<div class="sempty">Skrzynia jest pusta.</div>'}</div></div>` +
      `<div class="sfoot"><span class="smsg">${esc(s.message ?? '')}</span><span></span></div>`;
  }
}
