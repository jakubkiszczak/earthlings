// HUD v2: obudowa ekranu (kamień, brąz, bluszcz, latarnie), kule HP/many, taca umiejętności, panel ekwipunku, czat.
// Grafiki w pikselach natywnych, skalowane całkowicie przez --s (2 lub 3), tekst pisany kodem (Jersey 15).
// Uwaga: dane postaci, umiejętności i przedmiotów to na razie atrapa – zastąpią je systemy z etapów 2–4.
import type { Assets } from '../assets';
import type { GameBridge, HudApi } from '../types';
import './hud.css';

type RGB = [number, number, number];

interface Skill {
  k: string; ic: string; n: string; cd: number; mp: number; d: string; fx: number;
  heal?: number; mana?: number; count?: number; buff?: 'shield'; mount?: boolean;
  el?: HTMLButtonElement; num?: HTMLElement; left: number;
}

/** [ikona, rzadkość, nazwa, opis, akcja (indeks umiejętności lub 'tp'), liczba] */
type Item = [string, string | null, string, string, (number | 'tp' | null)?, number?];

interface Orb {
  w: HTMLElement; c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; id: ImageData | null; pal: RGB[]; t: HTMLElement;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const img = (src: string, cls?: string) => {
  const i = new Image();
  i.src = src;
  i.className = 'px ' + (cls ?? '');
  i.draggable = false;
  return i;
};

const RED: RGB[] = [[24, 4, 6], [58, 10, 14], [100, 18, 26], [150, 30, 40], [204, 48, 56], [240, 96, 90]];
const BLUE: RGB[] = [[4, 8, 30], [10, 26, 80], [18, 50, 140], [36, 90, 200], [70, 136, 236], [130, 190, 255]];
const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const RAR: Record<string, string> = { epic: '#a86af0', rare: '#4a8af0', unc: '#4ac04a', leg: '#f09a2a', set: '#3ae05a', com: '#8a8a8a' };

export function createHud(assets: Assets, game: GameBridge): HudApi {
  const U = assets.ui2, J = assets.ui2meta, IC = assets.icons;
  const st = { hp: 1240, hpMax: 1510, mp: 412, mpMax: 640, xp: 8840, xpMax: 13000, gold: 12480, mounted: false };
  const hud = document.querySelector<HTMLElement>('#hud')!;
  let s = 3;

  // ---------------- podpowiedzi
  const tipEl = el('div', 'tip panel9');
  function tip(node: HTMLElement, fn: () => string) {
    node.addEventListener('mouseenter', () => { tipEl.innerHTML = fn(); tipEl.style.display = 'block'; });
    node.addEventListener('mousemove', (e) => {
      const r = tipEl.getBoundingClientRect();
      tipEl.style.left = Math.min(innerWidth - r.width - 8, e.clientX + 16) + 'px';
      tipEl.style.top = Math.max(8, e.clientY - r.height - 12) + 'px';
    });
    node.addEventListener('mouseleave', () => { tipEl.style.display = 'none'; });
  }

  // ---------------- obudowa
  const fr = el('div', 'frame');
  const eTop = el('div', 'edge top'), eL = el('div', 'edge left'), eR = el('div', 'edge right');
  eTop.style.backgroundImage = `url(${U.edge_top})`;
  eL.style.backgroundImage = `url(${U.edge_left})`;
  eR.style.backgroundImage = `url(${U.edge_right})`;
  const cTL = img(U.corner_tl, 'abs'), cTR = img(U.corner_tr, 'abs'), crest = img(U.crest, 'abs');
  const portrait = img(U.portrait, 'abs portrait');
  const pname = el('div', 'pname abs', 'Aldric <span>Paladyn · poz. 24</span>');
  const buffsEl = el('div', 'buffs abs');
  fr.append(eTop, eL, eR, cTL, portrait, cTR, crest, pname, buffsEl);
  // konsola
  const con = el('div', 'console');
  const fill = el('div', 'fill');
  fill.style.backgroundImage = `url(${U.console_fill})`;
  const capL = el('div', 'cap left'), capR = el('div', 'cap right');
  capL.append(img(U.cap_left));
  capR.append(img(U.cap_right));
  const tray = el('div', 'tray');
  tray.append(img(U.tray));
  con.append(fill, capL, capR, tray);
  fr.append(con);
  hud.append(fr);

  // kule
  const mkOrb = (cap: HTMLElement, pal: RGB[]): Orb => {
    const w = el('div', 'orb');
    const c = el('canvas', 'px');
    c.width = c.height = 42;
    const t = el('div', 'orbtxt');
    w.append(c, img(U.orb_glass), t);
    cap.append(w);
    return { w, c, ctx: c.getContext('2d')!, id: null, pal, t };
  };
  const orbHP = mkOrb(capL, RED), orbMP = mkOrb(capR, BLUE);
  function drawOrb(o: Orb, frac: number, t: number) {
    const im = o.id ?? (o.id = o.ctx.createImageData(42, 42));
    const d = im.data;
    const lvl = 42 - frac * 40 - 1;
    for (let y = 0; y < 42; y++) for (let x = 0; x < 42; x++) {
      const i = (y * 42 + x) * 4, dx = x - 20.5, dy = y - 20.5;
      if (dx * dx + dy * dy > 20.6 * 20.6) { d[i + 3] = 0; continue; }
      const wave = Math.sin(x * 0.4 + t * 3.2) * 0.9;
      const b = BAY[y & 3][x & 3] / 16 - 0.47;
      let c: RGB;
      if (y >= lvl + wave) {
        const v = Math.sin(x * 0.28 + t * 1.2) + Math.sin(y * 0.22 - t * 0.9) + Math.sin((x + y) * 0.17 + t * 0.6);
        let k = 2.3 + v * 0.45 - ((dx + dy) / 40) * 1.2 + b;
        if (y < lvl + wave + 1.5) k = 4.6;
        if ((x * 7 + y * 13 + Math.floor(t * 4)) % 97 === 0) k = 5; // pęcherzyki
        c = o.pal[Math.max(0, Math.min(5, Math.round(k)))];
      } else {
        const k = 0.6 + (dx + dy < -10 ? 0.6 : 0) + b;
        c = k > 0.8 ? [26, 22, 30] : [14, 12, 18];
      }
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    o.ctx.putImageData(im, 0, 0);
  }
  // płomienie latarni
  const flames = [img(U.flame0, 'abs'), img(U.flame0, 'abs')];
  capL.append(flames[0]);
  capR.append(flames[1]);

  // ---------------- tabliczka nad postacią, dymek, teksty
  const np = el('div', 'nameplate', `<div class="npn">Aldric <span>24</span></div><div class="mini hp"><i></i></div><div class="mini mp"><i></i></div>`);
  const npHp = np.querySelector<HTMLElement>('.mini.hp i')!, npMp = np.querySelector<HTMLElement>('.mini.mp i')!;
  const bubble = el('div', 'bubble'), floats = el('div', 'floats');
  hud.append(np, bubble, floats);
  let bubbleT = 0;
  const floatText = (txt: string, color: string) => {
    const f = el('div', 'float', txt);
    f.style.color = color;
    f.dataset.t = '0';
    floats.append(f);
  };

  // ---------------- czat
  const chat = el('div', 'chat panel9');
  chat.innerHTML = `<div class="tabs"><button class="tab on">Ogólny</button><button class="tab">Drużyna</button><button class="tab">Handel</button><button class="tab">Gildia</button></div>
    <div class="log"></div><input class="chatin" maxlength="120" placeholder="Napisz wiadomość… (Enter)">`;
  hud.append(chat);
  const log = chat.querySelector<HTMLElement>('.log')!, inp = chat.querySelector<HTMLInputElement>('.chatin')!;
  const line = (ch: string, who: string, col: string, msg: string) => {
    log.append(el('div', 'ln', `<span style="color:${col}">[${ch}] ${who}</span> ${msg}`));
    while (log.children.length > 40) log.firstChild!.remove();
    log.scrollTop = 1e9;
  };
  const sys = (msg: string) => { log.append(el('div', 'ln', `<span style="color:#8ae07a">[System]</span> ${msg}`)); log.scrollTop = 1e9; };
  const demoLines: [string, string, string, string][] = [
    ['Drużyna', 'Eryk:', '#8ecbff', 'czekam przy wieży'], ['Handel', 'Thrain:', '#f0b060', 'sprzedam rudę żelaza x40'],
    ['Ogólny', 'Lysa:', '#e8e2d4', 'ktoś widział krakena przy klifach?'],
  ];
  demoLines.forEach((a) => line(...a));
  sys('Witaj w Dolinie Wieży. Przytrzymaj mysz, aby iść.');
  const NPCS: [string, string, string, string][] = [
    ['Ogólny', 'Grom:', '#e8e2d4', 'gdzie jest kowal?'], ['Handel', 'Mira:', '#f0b060', 'kupię skóry wilka'],
    ['Drużyna', 'Eryk:', '#8ecbff', 'idę do ruin, dołączysz?'], ['Ogólny', 'Thrain:', '#e8e2d4', 'piękna pogoda nad wodą'],
  ];
  let npcT = 0, npcI = 0;
  const tabs = chat.querySelectorAll<HTMLElement>('.tab');
  tabs.forEach((t) => t.addEventListener('click', () => { tabs.forEach((x) => x.classList.remove('on')); t.classList.add('on'); }));
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const v = inp.value.trim();
      if (v) {
        const safe = v.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        line('Ogólny', 'Aldric:', '#f2d27a', safe);
        bubble.textContent = v;
        bubble.style.display = 'block';
        bubbleT = 4;
      }
      inp.value = '';
      inp.blur();
    } else if (e.key === 'Escape') inp.blur();
  });

  // ---------------- umiejętności
  const SK: Skill[] = [
    { k: '1', ic: 'bash', n: 'Uderzenie tarczą', cd: 4, mp: 10, d: 'Ogłusza cel na 2 s.', fx: 0xfff1c4, left: 0 },
    { k: '2', ic: 'light', n: 'Święte światło', cd: 8, mp: 25, heal: 120, d: 'Przywraca 120 HP.', fx: 0xffe27a, left: 0 },
    { k: '3', ic: 'heal', n: 'Leczenie', cd: 12, mp: 40, heal: 300, d: 'Przywraca 300 HP.', fx: 0x7ff0b0, left: 0 },
    { k: '4', ic: 'sword', n: 'Cios mieczem', cd: 1.5, mp: 0, d: 'Zadaje 86–112 obrażeń.', fx: 0xffffff, left: 0 },
    { k: '5', ic: 'shield', n: 'Osłona', cd: 20, mp: 30, d: '-30% obrażeń przez 10 s.', fx: 0x8ab0ff, buff: 'shield', left: 0 },
    { k: '6', ic: 'hp', n: 'Mikstura zdrowia', cd: 2, mp: 0, heal: 400, count: 12, d: 'Przywraca 400 HP.', fx: 0xff5a6a, left: 0 },
    { k: '7', ic: 'mp', n: 'Mikstura many', cd: 2, mp: 0, mana: 250, count: 8, d: 'Przywraca 250 many.', fx: 0x5a9aff, left: 0 },
    { k: '8', ic: 'horse', n: 'Wierzchowiec', cd: 1, mp: 0, d: 'Szybsze poruszanie (x1,6).', fx: 0xd8b070, mount: true, left: 0 },
  ];
  SK.forEach((sk, i) => {
    const b = el('button', 'skill', `<img class="px ic" src="${IC['icon_' + sk.ic]}" alt=""><span class="cd"></span><span class="cdn"></span>${sk.count != null ? `<span class="cnt">${sk.count}</span>` : ''}`);
    const num = el('span', 'num', sk.k);
    sk.el = b;
    sk.num = num;
    b.addEventListener('click', () => use(i));
    tip(b, () => `<b class="t-rare">${sk.n}</b><br>${sk.mp ? `Mana: ${sk.mp} · ` : ''}Odnowienie: ${sk.cd} s<br><span class="t-dim">${sk.d}</span>`);
    tray.append(b, num);
  });
  const xp = el('div', 'xp', '<i></i>');
  const xpBar = xp.firstChild as HTMLElement;
  tray.append(xp);
  tip(xp, () => `Doświadczenie: ${Math.floor(st.xp).toLocaleString('pl-PL')} / ${st.xpMax.toLocaleString('pl-PL')} PD`);

  // ---------------- ekwipunek
  const inv = el('div', 'inv');
  const invBg = img(U.inv_bg, 'bg');
  inv.append(invBg);
  const EQ: Record<string, Item> = {
    helm: ['helm', 'epic', 'Hełm Świtu', 'Pancerz 64 · +6 Wytrzymałość'], amulet: ['amulet', 'leg', 'Amulet Wieży', '+12 Inteligencja · +5% leczenia'],
    cape: ['cape', 'rare', 'Peleryna wędrowca', 'Pancerz 18 · +4 Zręczność'],
    chest: ['chest', 'set', 'Napierśnik Świtu', 'Pancerz 142 · +10 Wytrzymałość<br><span style="color:#3ae05a">Komplet Świtu (2/4)</span>'],
    belt: ['belt', 'unc', 'Pas podróżnika', 'Pancerz 12'],
    legs: ['legs', 'set', 'Nagolenniki Świtu', 'Pancerz 48 · +4 Siła<br><span style="color:#3ae05a">Komplet Świtu (2/4)</span>'],
    boots: ['boots', 'rare', 'Buty zwiadowcy', 'Pancerz 26 · +5% szybkości'], gloves: ['gloves', 'rare', 'Rękawice kowala', 'Pancerz 22 · +3 Siła'],
    shoulders: ['shield', 'unc', 'Naramienniki', 'Pancerz 30'], ring: ['ring', 'epic', 'Pierścień przypływu', '+15 many co 5 s'],
    ring2: ['ring2', 'rare', 'Srebrny pierścień', '+6 Siła'],
    sword: ['sword', 'leg', 'Ostrze Świtu', 'Obrażenia 38–52 · +12 Siła<br><span style="color:#f09a2a">Przy trafieniu: Święty płomień</span>'],
    shield: ['shield', 'epic', 'Tarcza Wieży', 'Pancerz 96 · Blok 18%'],
  };
  const BAG: Item[] = [
    ['hp', null, 'Mikstura zdrowia', 'Przywraca 400 HP', 5, 12], ['mp', null, 'Mikstura many', 'Przywraca 250 many', 6, 8],
    ['ring', 'unc', 'Miedziany pierścień', '+2 Zręczność'], ['helm', 'com', 'Stary hełm', 'Pancerz 20'],
    ['scroll', null, 'Zwój powrotu', 'Teleport do punktu startu', 'tp', 3], ['boots', 'com', 'Znoszone buty', 'Pancerz 8'],
    ['amulet', 'rare', 'Amulet mgły', '+6 Inteligencja'], ['gloves', 'unc', 'Rękawice skórzane', 'Pancerz 10'],
    ['light', 'leg', 'Kryształ Świtu', 'Materiał rzemieślniczy', null, 18],
  ];
  const invSlots: { d: HTMLElement; r: [number, number, number, number] }[] = [];
  const addSlot = (r: [number, number, number, number], it: Item | undefined) => {
    const d = el('div', 'islot');
    if (it) {
      const [ic, rar, name, desc, action, count] = it;
      d.innerHTML = `<img class="px ic" src="${IC['icon_' + ic]}">` + (count != null ? `<span class="cnt">${count}</span>` : '');
      if (rar) { d.style.setProperty('--rc', RAR[rar]); d.classList.add('rar'); }
      tip(d, () => `<b style="color:${rar ? RAR[rar] : '#e8e2d4'}">${name}</b><br>${desc}${action != null ? '<br><span class="t-dim">Kliknij, aby użyć</span>' : ''}`);
      if (action === 'tp') d.addEventListener('click', () => { game.teleport(); sys('Użyto: Zwój powrotu'); game.ring(0xc88aff); });
      else if (action != null) d.addEventListener('click', () => use(action));
    }
    inv.append(d);
    invSlots.push({ d, r });
  };
  for (const k in J.eq) addSlot(J.eq[k], EQ[k]);
  J.bag.forEach((r, i) => addSlot([r[0], r[1], r[2], r[2]], BAG[i]));
  const ttl = el('div', 'ititle', 'Ekwipunek'), close = el('button', 'iclose', '×');
  const stats = el('div', 'istats', `<span>Siła</span><b>48</b><span>Zręczność</span><b>22</b><span>Inteligencja</span><b>14</b><span>Wytrzymałość</span><b>61</b><span>Pancerz</span><b>412</b><span>Obrażenia</span><b>86–112</b>`);
  const gold = el('div', 'igold', `<span>Złoto</span><b>${st.gold.toLocaleString('pl-PL')}</b>`);
  inv.append(ttl, close, stats, gold);
  hud.append(inv);
  const toggleInv = () => inv.classList.toggle('open');
  close.addEventListener('click', toggleInv);

  // przyciski okrągłe
  const RB: [string, () => unknown, string][] = [
    ['chest', toggleInv, 'Ekwipunek (I)'], ['scroll', () => sys('Księga umiejętności — wkrótce.'), 'Umiejętności (K)'],
    ['amulet', () => sys('Mapa świata — wkrótce.'), 'Mapa (M)'], ['ring', () => chat.classList.toggle('hidden'), 'Czat (C)'],
  ];
  const rbs = RB.map(([ic, fn, n]) => {
    const b = el('button', 'rbtn', `<img class="px bg" src="${U.rbtn}"><img class="px ic" src="${IC['icon_' + ic]}">`);
    b.addEventListener('click', fn);
    tip(b, () => `<b>${n}</b>`);
    con.append(b);
    return b;
  });

  hud.append(tipEl);
  tip(orbHP.w, () => `<b style="color:#ff6a6a">Zdrowie</b><br>${Math.round(st.hp)} / ${st.hpMax}`);
  tip(orbMP.w, () => `<b style="color:#6aa8ff">Mana</b><br>${Math.round(st.mp)} / ${st.mpMax}`);

  // ---------------- użycie umiejętności
  const buffs = { shield: 0 };
  function renderBuffs() {
    buffsEl.innerHTML = '';
    if (st.mounted) buffsEl.append(el('span', 'buff', `<img class="px" src="${IC.icon_horse}">`));
    if (buffs.shield > 0) buffsEl.append(el('span', 'buff', `<img class="px" src="${IC.icon_shield}"><em>${Math.ceil(buffs.shield)}</em>`));
  }
  function use(i: number) {
    const sk = SK[i];
    if (!sk || sk.left > 0) return;
    if (sk.count === 0) { sys('Brak przedmiotu: ' + sk.n); return; }
    if (st.mp < sk.mp) { floatText('Za mało many', '#8ab0ff'); return; }
    st.mp -= sk.mp;
    sk.left = sk.cd;
    if (sk.count != null) { sk.count--; sk.el!.querySelector('.cnt')!.textContent = String(sk.count); }
    if (sk.heal) { st.hp = Math.min(st.hpMax, st.hp + sk.heal); floatText('+' + sk.heal, '#8ae07a'); }
    if (sk.mana) { st.mp = Math.min(st.mpMax, st.mp + sk.mana); floatText('+' + sk.mana + ' many', '#8ab0ff'); }
    if (sk.mount) {
      st.mounted = !st.mounted;
      game.speed = st.mounted ? 1.6 : 1;
      sys(st.mounted ? 'Dosiadasz wierzchowca.' : 'Zsiadasz z wierzchowca.');
      renderBuffs();
    }
    if (sk.buff) { buffs.shield = 10; renderBuffs(); }
    if (!sk.heal && !sk.mana && !sk.mount) floatText(sk.n + '!', '#fff1c4');
    game.ring(sk.fx);
    sk.el!.classList.add('press');
    setTimeout(() => sk.el!.classList.remove('press'), 120);
  }

  // ---------------- układ (skala całkowita)
  const P = (e: HTMLElement, x: number, y: number, w?: number, h?: number) => {
    e.style.left = x * s + 'px';
    e.style.top = y * s + 'px';
    if (w != null) e.style.width = w * s + 'px';
    if (h != null) e.style.height = h * s + 'px';
  };
  function layout() {
    s = innerHeight >= 860 && innerWidth >= 1250 ? 3 : 2;
    hud.style.setProperty('--s', String(s));
    const C = J.console, O = J.orb, T = J.tray;
    eTop.style.height = 8 * s + 'px';
    eTop.style.backgroundSize = `${16 * s}px ${8 * s}px`;
    for (const e of [eL, eR]) {
      e.style.width = 8 * s + 'px';
      e.style.bottom = C.h * s + 'px';
      e.style.backgroundSize = `${8 * s}px ${16 * s}px`;
    }
    for (const [e, w] of [[cTL, 48], [cTR, 24], [crest, 44]] as const) e.style.width = w * s + 'px';
    cTL.style.left = cTL.style.top = '0px';
    cTR.style.right = '0px';
    cTR.style.top = '0px';
    crest.style.left = `calc(50% - ${22 * s}px)`;
    crest.style.top = '0px';
    const pr = J.portrait;
    P(portrait, pr.cx - 17, pr.cy - 17, 34, 34);
    pname.style.left = 52 * s + 'px';
    pname.style.top = 9 * s + 'px';
    buffsEl.style.left = 52 * s + 'px';
    buffsEl.style.top = 22 * s + 'px';
    con.style.height = C.oh * s + 'px';
    fill.style.height = C.h * s + 'px';
    fill.style.backgroundSize = `${16 * s}px ${C.h * s}px`;
    for (const c of [capL, capR]) {
      c.style.width = C.ow * s + 'px';
      c.style.height = C.oh * s + 'px';
      (c.firstChild as HTMLElement).style.width = C.ow * s + 'px';
    }
    // kule (prawa: lustro)
    P(orbHP.w, O.ocx - 21, O.ocy - 21, 42, 42);
    P(orbMP.w, C.ow - O.ocx - 21, O.ocy - 21, 42, 42);
    P(flames[0], O.lx - 3, O.ly, 7, 9);
    P(flames[1], C.ow - O.lx - 4, O.ly, 7, 9);
    tray.style.width = T.w * s + 'px';
    tray.style.height = T.h * s + 'px';
    (tray.firstChild as HTMLElement).style.width = T.w * s + 'px';
    SK.forEach((sk, i) => { const [x, y, w] = T.slots[i]; P(sk.el!, x, y, w, w); P(sk.num!, x, T.numy, w, 7); });
    P(xp, 8, 7, T.w - 16, 3);
    // przyciski okrągłe: po dwa po bokach tacy
    const half = innerWidth / s / 2, tl = half - T.w / 2, trr = half + T.w / 2;
    rbs.forEach((b, i) => { const x = i < 2 ? tl - 26 * (i + 1) : trr + 4 + 26 * (i - 2); P(b, x, C.oh - C.h + 14, 22, 22); });
    // czat i ekwipunek
    chat.style.left = 10 * s + 'px';
    chat.style.bottom = (C.oh + 2) * s + 'px';
    chat.style.width = 150 * s + 'px';
    chat.style.height = 76 * s + 'px';
    const I = J.inv;
    inv.style.width = I.w * s + 'px';
    inv.style.height = I.h * s + 'px';
    inv.style.right = 12 * s + 'px';
    inv.style.top = 8 * s + 'px';
    invBg.style.width = I.w * s + 'px';
    invSlots.forEach(({ d, r }) => P(d, r[0], r[1], r[2], r[3]));
    P(ttl, ...I.title);
    P(close, ...I.close);
    P(stats, J.stats[0] + 3, J.stats[1] + 2, J.stats[2] - 6, J.stats[3] - 4);
    P(gold, J.gold[0] + 3, J.gold[1], J.gold[2] - 6, J.gold[3]);
  }
  layout();
  addEventListener('resize', layout);

  // ---------------- klawiatura
  addEventListener('keydown', (e) => {
    if (document.activeElement === inp) return;
    if (e.key === 'Enter') { chat.classList.remove('hidden'); inp.focus(); e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    if (k === 'i') { toggleInv(); return; }
    if (k === 'c') { chat.classList.toggle('hidden'); return; }
    if (e.key === 'Escape') { inv.classList.remove('open'); return; }
    const i = SK.findIndex((x) => x.k === e.key);
    if (i >= 0) use(i);
  });

  // ---------------- pętla HUD
  let T_ = 0, orbT = 0, flameF = 0;
  return {
    update(x, y, _zoom, dt) {
      T_ += dt;
      orbT += dt;
      st.mp = Math.min(st.mpMax, st.mp + 4 * dt);
      st.hp = Math.min(st.hpMax, st.hp + 1.5 * dt);
      st.xp = Math.min(st.xpMax, st.xp + 2 * dt);
      if (orbT > 0.08) { orbT = 0; drawOrb(orbHP, st.hp / st.hpMax, T_); drawOrb(orbMP, st.mp / st.mpMax, T_ + 7); }
      orbHP.t.textContent = String(Math.round(st.hp));
      orbMP.t.textContent = String(Math.round(st.mp));
      const f = Math.floor(T_ * 6) % 2;
      if (f !== flameF) {
        flameF = f;
        flames[0].src = f ? U.flame1 : U.flame0;
        flames[1].src = f ? U.flame0 : U.flame1;
      }
      if (buffs.shield > 0) {
        const b0 = Math.ceil(buffs.shield);
        buffs.shield -= dt;
        if (Math.ceil(buffs.shield) !== b0) renderBuffs();
      }
      xpBar.style.width = (st.xp / st.xpMax) * 100 + '%';
      npHp.style.width = (st.hp / st.hpMax) * 100 + '%';
      npMp.style.width = (st.mp / st.mpMax) * 100 + '%';
      np.style.transform = `translate(${Math.round(x)}px, ${Math.round(y - 10)}px) translate(-50%, -100%)`;
      if (bubbleT > 0) {
        bubbleT -= dt;
        bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y - 62)}px) translate(-50%, -100%)`;
        if (bubbleT <= 0) bubble.style.display = 'none';
      }
      for (const sk of SK) if (sk.left > 0) {
        sk.left = Math.max(0, sk.left - dt);
        (sk.el!.querySelector('.cd') as HTMLElement).style.background = sk.left > 0 ? `conic-gradient(rgba(0,0,0,.66) ${(sk.left / sk.cd) * 360}deg, transparent 0)` : 'none';
        sk.el!.querySelector('.cdn')!.textContent = sk.left > 0 ? String(Math.ceil(sk.left)) : '';
      }
      for (const fl of Array.from(floats.children) as HTMLElement[]) {
        const t = +fl.dataset.t! + dt;
        fl.dataset.t = String(t);
        if (t > 1.2) { fl.remove(); continue; }
        const k = 1 - Math.pow(1 - t / 1.2, 3);
        fl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y - 30 - k * 50)}px) translate(-50%, -100%)`;
        fl.style.opacity = String(t > 0.8 ? (1.2 - t) / 0.4 : 1);
      }
      npcT += dt;
      if (npcT > 14) { npcT = 0; line(...NPCS[npcI++ % NPCS.length]); }
    },
  };
}
