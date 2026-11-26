// Ekran wczytywania: grafika, nazwa gry, opis miejsca, pasek postępu i podpowiedź.
// Pokazywany przy starcie gry, przejściu do innej komórki mapy i wejściu do budynku / wyjściu z niego.
import { assetUrl } from '../assets';
import './loading.css';

const TIPS = [
  'Prawy przycisk myszy to odskok – raz na 10 sekund chwilę nie otrzymujesz obrażeń.',
  'Usiądź (X), żeby szybciej odzyskać zdrowie – ale potwór cię poderwie.',
  'Strażnicy przy bramach miasta rozprawią się z każdym potworem, który podejdzie za blisko.',
  'Skrzynia przy fontannie jest wspólna dla wszystkich twoich postaci.',
  'Każde 10 punktów Zręczności powyżej 30 przyspiesza chód o 3%.',
  'Łowca strzela tym dalej, im więcej ma Zręczności.',
  'Kupiec Bronek kupi wszystko, co przyniesiesz z dziczy – za ćwierć ceny.',
  'Szczęście z Pierścienia Fortuny zwiększa ilość złota i szansę na przedmioty.',
];

const MIN_TIME = 700;   // ms – żeby ekran nie mignął
const FADE = 250;

export class LoadingScreen {
  private readonly root = document.createElement('div');
  private readonly bar: HTMLElement;
  private readonly place: HTMLElement;
  private readonly tip: HTMLElement;
  private shownAt = 0;
  private tipI = Math.floor(Math.random() * TIPS.length);
  private fake = 0;
  private raf = 0;
  visible = false;

  constructor() {
    this.root.className = 'loading-screen';
    this.root.innerHTML =
      `<div class="ls-art" style="background-image:url(${assetUrl('art/loading/loading_dragon_480x270.png')})"></div>` +
      `<div class="ls-panel"><h1 class="ls-logo">Glastemia</h1><div class="ls-place"></div>` +
      `<div class="ls-barbox"><i class="ls-bar"></i></div><div class="ls-tip"></div></div>`;
    this.bar = this.root.querySelector('.ls-bar')!;
    this.place = this.root.querySelector('.ls-place')!;
    this.tip = this.root.querySelector('.ls-tip')!;
    document.body.append(this.root);
  }

  /** pokaż ekran; text – dokąd się wczytujemy */
  show(text: string) {
    this.place.textContent = text;
    this.tip.textContent = TIPS[this.tipI++ % TIPS.length];
    this.fake = 0;
    this.setProgress(0);
    this.shownAt = performance.now();
    this.visible = true;
    this.root.classList.add('on');
    // pasek rośnie sam (logarytmicznie), dopóki nie przyjdzie koniec
    cancelAnimationFrame(this.raf);
    const tick = () => {
      this.fake += (0.92 - this.fake) * 0.04;
      this.setProgress(this.fake);
      if (this.visible) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setProgress(p: number) { this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`; }

  /** schowaj (najwcześniej po MIN_TIME od pokazania), z wygaszeniem */
  async hide(): Promise<void> {
    if (!this.visible) return;
    const wait = MIN_TIME - (performance.now() - this.shownAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.setProgress(1);
    await new Promise((r) => setTimeout(r, 120));
    this.visible = false;
    this.root.classList.remove('on');
    cancelAnimationFrame(this.raf);
    await new Promise((r) => setTimeout(r, FADE));
  }
}
