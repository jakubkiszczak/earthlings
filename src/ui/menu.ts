// Menu: ekran startowy → wybór postaci (do 3) → kreator (nazwa, rasa, klasa, wygląd, atrybuty).
// DOM nad płótnem z niebem; grafiki ramek z HUD, tekst fontem Jersey 15, skala całkowita (--s).
import { CharSheet } from '../chars/sheet';
import { drawPortrait } from '../chars/portrait';
import type { Gear } from '../chars/chargen';
import {
  ATTRS, BEARDS, BUILDS, CLASSES, HAIRS, RACES, START_POINTS, addAttrs, baseAttributes, derived, nameError, normalizeLook,
  type AttrId, type Attributes, type ClassId, type Look, type Race,
} from '../logic/character';
import { MAX_CHARS, newId, type SaveStore, type SavedChar } from '../logic/save';
import './menu.css';

const DIR_ORDER: [string, boolean][] = [['S', false], ['SE', false], ['E', false], ['NE', false], ['N', false], ['NE', true], ['E', true], ['SE', true]];
const HAIR_SWATCH: Record<string, string> = { black: '#30282e', white: '#f4f4ee', blond: '#e8c060', brown: '#7a4a28', bald: '#e8b890' };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export const lookOf = (c: Pick<SavedChar, 'race' | 'cls' | 'look'>) => ({ race: c.race, cls: c.cls, ...c.look });
export const titleOf = (c: Pick<SavedChar, 'race' | 'cls'>) => `${RACES[c.race].name} · ${CLASSES[c.cls].name}`;

/** animowany podgląd postaci na płótnie (obrót strzałkami / automatycznie) */
class Preview {
  readonly canvas = el('canvas', 'pv');
  private sheet: CharSheet | null = null;
  private dir = 0;
  private t = 0;
  constructor(private readonly scale: number, private readonly walk = false) {
    this.canvas.width = 28 * scale;
    this.canvas.height = 42 * scale;
  }
  set(look: ConstructorParameters<typeof CharSheet>[0]) {
    this.sheet?.destroy();
    this.sheet = new CharSheet(look);
    this.draw();
  }
  turn(d: number) { this.dir = (this.dir + d + DIR_ORDER.length) % DIR_ORDER.length; this.draw(); }
  tick(dt: number) { this.t += dt; this.draw(); }
  private draw() {
    if (!this.sheet) return;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const [d, flip] = DIR_ORDER[this.dir];
    const f = this.walk ? `walk${Math.floor(this.t * 8) % 4}` : `idle${Math.floor(this.t * 1.6) % 2}`;
    ctx.save();
    if (flip) { ctx.translate(this.canvas.width, 0); ctx.scale(-1, 1); }
    this.sheet.drawTo(ctx, `hero_${d}_${f}`, 0, 0, this.scale);
    ctx.restore();
  }
  destroy() { this.sheet?.destroy(); }
}

/** portret do HUD: głowa z klatki S w powiększeniu, jako obraz (data URL) */
export function portraitOf(c: Pick<SavedChar, 'race' | 'cls' | 'look'>, gear?: Gear): string {
  return drawPortrait({ ...lookOf(c), gear }).toDataURL();
}

export interface MenuApi {
  show(): void;
  hide(): void;
  /** do testów: utwórz postać z domyślnymi wartościami i wejdź do gry */
  quickPlay(name?: string, race?: Race, cls?: ClassId): void;
}

export function createMenu(store: SaveStore, onPlay: (c: SavedChar) => void): MenuApi {
  const root = el('div', 'menu');
  document.body.append(root);
  const previews: Preview[] = [];
  let raf = 0, last = 0;
  const loop = (ts: number) => {
    const dt = last ? (ts - last) / 1000 : 0;
    last = ts;
    for (const p of previews) p.tick(dt);
    raf = requestAnimationFrame(loop);
  };
  const clearPreviews = () => { for (const p of previews.splice(0)) p.destroy(); };

  function layout() { root.style.setProperty('--s', String(Math.max(2, Math.min(4, Math.floor(Math.min(innerWidth / 380, innerHeight / 250)))))); }
  layout();
  addEventListener('resize', layout);

  // ---------------------------------------------------------------- ekran startowy
  function startScreen() {
    clearPreviews();
    root.innerHTML = '';
    const box = el('div', 'mstart');
    box.append(
      el('h1', 'logo', 'Glastemia'),
      el('div', 'sub', 'prototyp · wersja testowa'),
    );
    const play = el('button', 'mbtn big', 'Graj');
    play.addEventListener('click', selectScreen);
    box.append(play, el('div', 'note', 'Bez logowania. Postacie zapisują się w tej przeglądarce.'));
    root.append(box);
    play.focus();
  }

  // ---------------------------------------------------------------- wybór postaci
  function selectScreen() {
    clearPreviews();
    root.innerHTML = '';
    const chars = store.list();
    let sel = chars[0]?.id ?? null;
    const box = el('div', 'mpanel panel9 mselect');
    box.append(el('h2', '', 'Wybierz postać'));
    const slots = el('div', 'slots');
    const enter = el('button', 'mbtn', 'Wejdź do gry');
    const del = el('button', 'mbtn ghost', 'Usuń');
    const confirm = el('div', 'confirm');
    const render = () => {
      slots.querySelectorAll('.slot').forEach((s) => s.classList.toggle('on', (s as HTMLElement).dataset.id === sel));
      enter.disabled = del.disabled = !sel;
      confirm.innerHTML = '';
    };
    for (let i = 0; i < MAX_CHARS; i++) {
      const c = chars[i];
      const slot = el('button', 'slot' + (c ? '' : ' empty'));
      if (c) {
        slot.dataset.id = c.id;
        const pv = new Preview(3);
        pv.set(lookOf(c));
        previews.push(pv);
        slot.append(pv.canvas, el('div', 'sname', esc(c.name)), el('div', 'sinfo', `${titleOf(c)}<br>poziom ${c.level}`));
        slot.addEventListener('click', () => { sel = c.id; render(); });
        slot.addEventListener('dblclick', () => onPlay(c));
      } else {
        slot.append(el('div', 'splus', '+'), el('div', 'sinfo', 'Wolne miejsce'));
        slot.addEventListener('click', () => createScreen());
      }
      slots.append(slot);
    }
    const create = el('button', 'mbtn', 'Nowa postać');
    create.disabled = chars.length >= MAX_CHARS;
    create.addEventListener('click', () => createScreen());
    enter.addEventListener('click', () => { const c = chars.find((x) => x.id === sel); if (c) onPlay(c); });
    del.addEventListener('click', () => {
      const c = chars.find((x) => x.id === sel);
      if (!c) return;
      confirm.innerHTML = `Usunąć postać <b>${esc(c.name)}</b>? Tego nie da się cofnąć. `;
      const yes = el('button', 'mbtn small danger', 'Usuń na zawsze'), no = el('button', 'mbtn small ghost', 'Anuluj');
      yes.addEventListener('click', () => { store.remove(c.id); selectScreen(); });
      no.addEventListener('click', render);
      confirm.append(yes, no);
    });
    const back = el('button', 'mbtn ghost', 'Wróć');
    back.addEventListener('click', startScreen);
    const row = el('div', 'mrow');
    row.append(back, del, create, enter);
    box.append(slots, confirm, row);
    if (!chars.length) box.append(el('div', 'note', 'Nie masz jeszcze postaci – utwórz pierwszą.'));
    root.append(box);
    render();
  }

  // ---------------------------------------------------------------- kreator
  function createScreen() {
    clearPreviews();
    root.innerHTML = '';
    const taken = store.list().map((c) => c.name);
    let race: Race = 'human', cls: ClassId = 'warrior';
    let look: Look = { hair: 'brown', build: 'normal', beard: 'short' };
    let alloc: Attributes = { str: 0, dex: 0, vit: 0, ene: 0 };
    const box = el('div', 'mpanel panel9 mcreate');
    box.append(el('h2', '', 'Nowa postać'));
    const cols = el('div', 'ccols');
    // podgląd
    const left = el('div', 'cleft');
    const pv = new Preview(5);
    previews.push(pv);
    const turnL = el('button', 'mbtn small ghost', '◀'), turnR = el('button', 'mbtn small ghost', '▶');
    turnL.title = 'Obróć'; turnR.title = 'Obróć';
    turnL.addEventListener('click', () => pv.turn(1));
    turnR.addEventListener('click', () => pv.turn(-1));
    const turn = el('div', 'turn'); turn.append(turnL, turnR);
    const summary = el('div', 'csum');
    left.append(pv.canvas, turn, summary);
    // formularz
    const right = el('div', 'cright');
    const nameIn = el('input', 'cname') as HTMLInputElement;
    nameIn.maxLength = 16;
    nameIn.placeholder = 'Nazwa postaci';
    nameIn.setAttribute('aria-label', 'Nazwa postaci');
    const group = (label: string, body: HTMLElement) => { const g = el('div', 'cgrp'); g.append(el('div', 'clabel', label), body); return g; };
    const choice = <T extends string>(opts: { id: T; name: string }[], get: () => T, set: (v: T) => void, swatch?: Record<string, string>) => {
      const w = el('div', 'choice');
      const btns = opts.map((o) => {
        const b = el('button', 'opt', (swatch ? `<i style="background:${swatch[o.id]}"></i>` : '') + o.name);
        b.dataset.v = o.id;
        b.addEventListener('click', () => { set(o.id); update(); });
        w.append(b);
        return b;
      });
      return { w, sync: (disabled = false) => btns.forEach((b) => { b.classList.toggle('on', b.dataset.v === get()); b.disabled = disabled; }) };
    };
    const cRace = choice((Object.keys(RACES) as Race[]).map((id) => ({ id, name: RACES[id].name })), () => race, (v) => { race = v; });
    const cCls = choice((Object.keys(CLASSES) as ClassId[]).map((id) => ({ id, name: CLASSES[id].name })), () => cls, (v) => { cls = v; });
    const cHair = choice(HAIRS, () => look.hair, (v) => { look = { ...look, hair: v }; }, HAIR_SWATCH);
    const cBuild = choice(BUILDS, () => look.build, (v) => { look = { ...look, build: v }; });
    const cBeard = choice(BEARDS, () => look.beard as never, (v) => { look = { ...look, beard: v }; });
    const beardNote = el('div', 'hint', '');
    // atrybuty
    const attrBox = el('div', 'attrs');
    const pointsEl = el('div', 'points');
    const attrRows = ATTRS.map((a) => {
      const row = el('div', 'arow');
      const minus = el('button', 'mbtn small ghost', '−'), plus = el('button', 'mbtn small ghost', '+');
      minus.setAttribute('aria-label', `${a.name} minus`); plus.setAttribute('aria-label', `${a.name} plus`);
      const val = el('b', 'aval');
      minus.addEventListener('click', () => { if (alloc[a.id] > 0) { alloc = { ...alloc, [a.id]: alloc[a.id] - 1 }; update(); } });
      plus.addEventListener('click', () => { if (left_() > 0) { alloc = { ...alloc, [a.id]: alloc[a.id] + 1 }; update(); } });
      row.append(el('span', 'aname', `${a.name}<small>${a.hint}</small>`), minus, val, plus);
      attrBox.append(row);
      return { id: a.id as AttrId, val, minus, plus };
    });
    const left_ = () => START_POINTS - (alloc.str + alloc.dex + alloc.vit + alloc.ene);
    const err = el('div', 'err');
    const createBtn = el('button', 'mbtn', 'Utwórz postać');
    const back = el('button', 'mbtn ghost', 'Wróć');
    back.addEventListener('click', selectScreen);
    right.append(
      group('Nazwa', nameIn),
      group('Rasa', cRace.w),
      group('Klasa', cCls.w),
      group('Włosy', cHair.w),
      group('Budowa ciała', cBuild.w),
      group('Broda', (() => { const d = el('div'); d.append(cBeard.w, beardNote); return d; })()),
      group('Atrybuty', (() => { const d = el('div'); d.append(pointsEl, attrBox); return d; })()),
    );
    cols.append(left, right);
    const row = el('div', 'mrow');
    row.append(back, createBtn);
    box.append(cols, err, row);
    root.append(box);

    function update() {
      look = normalizeLook(race, look);
      cRace.sync(); cCls.sync(); cHair.sync(); cBuild.sync(); cBeard.sync(race === 'elf');
      beardNote.textContent = race === 'elf' ? 'Elfy nie noszą brody.' : '';
      const base = baseAttributes(race, cls), total = addAttrs(base, alloc), dv = derived(total);
      for (const r of attrRows) {
        r.val.textContent = String(total[r.id]);
        r.val.classList.toggle('up', alloc[r.id] > 0);
        r.minus.disabled = alloc[r.id] <= 0;
        r.plus.disabled = left_() <= 0;
      }
      pointsEl.innerHTML = `Do rozdzielenia: <b>${left_()}</b> z ${START_POINTS}`;
      summary.innerHTML = `<b>${RACES[race].name} · ${CLASSES[cls].name}</b><br>Zdrowie <b>${dv.hp}</b> · Mana <b>${dv.mana}</b>`;
      pv.set({ race, cls, ...look });
      err.textContent = '';
    }
    createBtn.addEventListener('click', () => {
      const name = nameIn.value.trim();
      const e = nameError(name, taken);
      if (e) { err.textContent = e; nameIn.focus(); return; }
      if (left_() > 0) { err.textContent = `Rozdziel wszystkie punkty atrybutów (zostało ${left_()}).`; return; }
      const now = Date.now();
      const c: SavedChar = { id: newId(), name, race, cls, look, alloc, level: 1, exp: 0, gold: 0, pos: null, created: now, played: now };
      if (!store.upsert(c)) { err.textContent = 'Nie udało się zapisać postaci (pamięć przeglądarki jest niedostępna lub pełna).'; return; }
      onPlay(c);
    });
    nameIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') createBtn.click(); });
    update();
    nameIn.focus();
  }

  return {
    show() { root.style.display = ''; startScreen(); if (!raf) raf = requestAnimationFrame(loop); },
    hide() { root.style.display = 'none'; clearPreviews(); cancelAnimationFrame(raf); raf = 0; root.innerHTML = ''; },
    quickPlay(name = 'Tester', race: Race = 'human', cls: ClassId = 'warrior') {
      const existing = store.list().find((c) => c.name === name);
      const now = Date.now();
      const c: SavedChar = existing ?? {
        id: newId(), name, race, cls, look: normalizeLook(race, { hair: 'brown', build: 'normal', beard: 'short' }),
        alloc: { str: 4, dex: 2, vit: 4, ene: 0 }, level: 1, exp: 0, gold: 0, pos: null, created: now, played: now,
      };
      if (!existing) store.upsert(c);
      onPlay(c);
    },
  };
}
