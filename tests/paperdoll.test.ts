import { existsSync, readdirSync, readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  allLookFiles, dirFromVector, drawOrder, effectiveEquipment, equipmentFromGear, normalizeAppearance, recolor, reskin, NO_EQUIPMENT,
  SKIN_TONES, type AnchorFile, type Img, type Palettes, type Registry,
} from '../src/chars/paperdoll';

const S = 'assets/art/sprites/';
const reg = JSON.parse(readFileSync(S + 'items.json', 'utf8')) as Registry;
const pal = JSON.parse(readFileSync(S + reg.appearance.palettes, 'utf8')) as Palettes;
const FULL = { weapon: 'sword_short', shield: 'shield_round', helmet: 'helmet_spangen', boots: 'boots_leather' };
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

describe('postać paper doll – dane', () => {
  it('każdy plik *_anchors.json ma 15 klatek (strzał: 4), a punkty mieszczą się w 42×63', () => {
    const files = readdirSync(S).filter((f) => f.endsWith('_anchors.json'));
    expect(files.length).toBe(32);
    for (const f of files) {
      const a = JSON.parse(readFileSync(S + f, 'utf8')) as AnchorFile;
      expect(a.frames, f).toHaveLength(f.includes('_shoot_') ? 4 : 15);
      for (const fr of a.frames) for (const p of [fr.hand_r, fr.hand_l, fr.head]) {
        expect(p.x >= 0 && p.x < 42 && p.y >= 0 && p.y < 63, `${f} klatka ${fr.index}: (${p.x}, ${p.y})`).toBe(true);
      }
    }
  });
  it('każdy plik wskazany w items.json istnieje', () => {
    const files = new Set<string>();
    for (const it of reg.items) { for (const f of Object.values(it.files)) files.add(f); if (it.ammo) files.add(it.ammo); }
    for (const B of [reg.body, reg.body_female]) {
      for (const m of [B.base, B.anchors, B.shoot.base, B.shoot.anchors]) for (const f of Object.values(m)) files.add(f);
    }
    for (const f of files) expect(existsSync(S + f), f).toBe(true);
  });
  it('każda kombinacja wyglądu (płeć × rasa × fryzura × broda) ma pliki dla 8 kierunków i obu arkuszy', () => {
    const files = allLookFiles(reg);
    expect(files.length).toBeGreaterThan(300);
    for (const f of files) expect(existsSync(S + f), f).toBe(true);
  });
});

describe('postać paper doll – wygląd', () => {
  it('zamiana palety: base[k] → palettes[c][k], alfa bez zmian, inne kolory zostają', () => {
    const px = new Uint8ClampedArray(4 * 3);
    px.set([...hexRgb(pal.base[2]), 255], 0);
    px.set([...hexRgb(pal.base[5]), 128], 4);
    px.set([1, 2, 3, 255], 8);
    const out = recolor({ w: 3, h: 1, px } as Img, pal, 'platinum').px;
    expect([...out.slice(0, 4)]).toEqual([...hexRgb(pal.palettes.platinum[2]), 255]);
    expect([...out.slice(4, 8)]).toEqual([...hexRgb(pal.palettes.platinum[5]), 128]);
    expect([...out.slice(8, 12)]).toEqual([1, 2, 3, 255]);
  });
  it('kolor skóry: tony skóry zmieniane tylko tam, gdzie ciało elfa ma skórę', () => {
    const W = SKIN_TONES.warm.map(hexRgb), F = SKIN_TONES.fair.map(hexRgb);
    const human = { w: 2, h: 1, px: new Uint8ClampedArray([...W[0], 255, ...W[0], 255]) };
    const elf = { w: 2, h: 1, px: new Uint8ClampedArray([...F[0], 255, 100, 180, 110, 255]) };   // drugi piksel: koszula elfa
    const out = reskin(human, elf, 'human', 'fair').px;
    expect([...out.slice(0, 3)]).toEqual(F[0]);
    expect([...out.slice(4, 7)]).toEqual(W[0]);
    expect(reskin(human, elf, 'human', 'warm')).toBe(human);
  });
  it('broda tylko dla człowieka-mężczyzny; nieznane wartości → domyślne', () => {
    const AP = reg.appearance;
    expect(normalizeAppearance(AP, { gender: 'male', race: 'human', beard: 'medium' }).beard).toBe('medium');
    expect(normalizeAppearance(AP, { gender: 'male', race: 'elf', beard: 'medium' }).beard).toBe('none');
    expect(normalizeAppearance(AP, { gender: 'female', race: 'human', beard: 'long' }).beard).toBe('none');
    expect(normalizeAppearance(AP, { gender: 'female', hair: 'buzz' }).hair).toBe('long');
    expect(normalizeAppearance(AP, { race: 'elf' }).skin).toBe('fair');
  });
});

describe('postać paper doll – warstwy', () => {
  const fr = (weapon: 'front' | 'behind', shield: 'front' | 'behind', index = 0) => ({ index, z: { weapon, shield } });
  it('brak przedmiotu (null) usuwa jego warstwę', () => {
    expect(drawOrder(fr('front', 'front'), NO_EQUIPMENT)).toEqual(['hair_back', 'body', 'hair_front']);
    const o = drawOrder(fr('front', 'front'), { ...FULL, weapon: null, helmet: null });
    expect(o).not.toContain('weapon');
    expect(o).not.toContain('helmet');
    expect(o).toContain('shield');
  });
  it('miecz za ciałem rysuje się przed ciałem w kolejności (pod nim)', () => {
    const o = drawOrder(fr('behind', 'behind'), FULL, { beard: true, ears: true });
    expect(o.indexOf('weapon')).toBeLessThan(o.indexOf('body'));
    expect(o).toEqual(['hair_back', 'shield', 'weapon', 'body', 'boots', 'beard', 'hair_front', 'ears', 'helmet']);
  });
  it('miecz za ciałem i tarcza przed nim → kopia miecza przycięta do tarczy, po tarczy', () => {
    const o = drawOrder(fr('behind', 'front'), FULL);
    expect(o).toEqual(['hair_back', 'weapon', 'body', 'boots', 'hair_front', 'helmet', 'shield', 'weapon_clip']);
    expect(drawOrder(fr('front', 'front'), FULL)).not.toContain('weapon_clip');
  });
  it('hełm ukryty w klatce śmierci (14)', () => {
    expect(drawOrder(fr('front', 'front', 14), FULL)).not.toContain('helmet');
  });
  it('łuk: dwuręczny (bez tarczy), w strzale wg z.bow', () => {
    const eq = effectiveEquipment(reg, { ...FULL, weapon: 'bow_short' });
    expect(eq.shield).toBeNull();
    expect(drawOrder({ index: 0, z: { bow: 'behind' } }, eq, { bow: true, shoot: true })[1]).toBe('bow');
    expect(drawOrder({ index: 0, z: { bow: 'front' } }, eq, { bow: true, shoot: true }).at(-1)).toBe('bow');
  });
  it('dirFromVector: 8 kierunków (S = w dół ekranu)', () => {
    const cases: [number, number, string][] = [[0, 1, 'S'], [1, 1, 'SE'], [1, 0, 'E'], [1, -1, 'NE'], [0, -1, 'N'], [-1, -1, 'NW'], [-1, 0, 'W'], [-1, 1, 'SW']];
    for (const [dx, dy, d] of cases) expect(dirFromVector(dx, dy)).toBe(d);
  });
  it('ekwipunek gry → sloty postaci (wojownik: miecz, łowca: łuk bez tarczy)', () => {
    expect(equipmentFromGear('warrior', { weapon: 1, shield: 2, helm: 0, boots: 1 })).toEqual({ weapon: 'sword_short', shield: 'shield_round', helmet: null, boots: 'boots_leather' });
    expect(equipmentFromGear('hunter', { weapon: 1, shield: 1, helm: 1, boots: 0 })).toEqual({ weapon: 'bow_short', shield: null, helmet: 'helmet_spangen', boots: null });
    expect(equipmentFromGear('hunter', { weapon: 0, shield: 0, helm: 0, boots: 0 }).weapon).toBeNull();
  });
});
