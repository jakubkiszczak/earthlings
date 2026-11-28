import { existsSync, readdirSync, readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { dirFromVector, drawOrder, equipmentFromGear, NO_EQUIPMENT, type AnchorFile, type Registry } from '../src/chars/paperdoll';

const S = 'assets/art/sprites/';
const reg = JSON.parse(readFileSync(S + 'items.json', 'utf8')) as Registry;
const FULL = { weapon: 'sword_short', shield: 'shield_round', helmet: 'helmet_spangen', boots: 'boots_leather' };

describe('postać paper doll – dane', () => {
  it('każdy plik *_anchors.json ma 15 klatek, a punkty mieszczą się w 42×63', () => {
    const files = readdirSync(S).filter((f) => f.endsWith('_anchors.json'));
    expect(files.length).toBe(16);
    for (const f of files) {
      const a = JSON.parse(readFileSync(S + f, 'utf8')) as AnchorFile;
      expect(a.frames, f).toHaveLength(15);
      for (const fr of a.frames) for (const p of [fr.hand_r, fr.hand_l, fr.head]) {
        expect(p.x >= 0 && p.x < 42 && p.y >= 0 && p.y < 63, `${f} klatka ${fr.index}: (${p.x}, ${p.y})`).toBe(true);
      }
    }
  });
  it('każdy plik wskazany w items.json istnieje', () => {
    const files = new Set<string>();
    for (const it of reg.items) for (const f of Object.values(it.files)) files.add(f);
    for (const B of [reg.body, reg.body_female]) {
      for (const f of Object.values(B.nohair)) files.add(f);
      for (const f of Object.values(B.anchors)) files.add(f);
      if (B.hair) for (const f of Object.values(B.hair)) files.add(f);
    }
    for (const f of files) expect(existsSync(S + f), f).toBe(true);
  });
});

describe('postać paper doll – warstwy', () => {
  const fr = (weapon: 'front' | 'behind', shield: 'front' | 'behind', index = 0) => ({ index, z: { weapon, shield } });
  it('brak przedmiotu (null) usuwa jego warstwę', () => {
    expect(drawOrder(fr('front', 'front'), NO_EQUIPMENT, true)).toEqual(['body', 'hair']);
    const o = drawOrder(fr('front', 'front'), { ...FULL, weapon: null, helmet: null }, true);
    expect(o).not.toContain('weapon');
    expect(o).not.toContain('helmet');
    expect(o).toContain('shield');
  });
  it('miecz za ciałem rysuje się przed ciałem w kolejności (pod nim)', () => {
    const o = drawOrder(fr('behind', 'behind'), FULL, true);
    expect(o.indexOf('weapon')).toBeLessThan(o.indexOf('body'));
    expect(o).toEqual(['shield', 'weapon', 'body', 'boots', 'hair', 'helmet']);
  });
  it('miecz za ciałem i tarcza przed nim → kopia miecza przycięta do tarczy, po tarczy', () => {
    const o = drawOrder(fr('behind', 'front'), FULL, true);
    expect(o).toEqual(['weapon', 'body', 'boots', 'hair', 'helmet', 'shield', 'weapon_clip']);
    expect(drawOrder(fr('front', 'front'), FULL, true)).not.toContain('weapon_clip');
  });
  it('hełm ukryty w klatce śmierci (14); kobieta bez warstwy włosów', () => {
    expect(drawOrder(fr('front', 'front', 14), FULL, false)).not.toContain('helmet');
    expect(drawOrder(fr('front', 'front'), FULL, false)).not.toContain('hair');
  });
  it('dirFromVector: 8 kierunków (S = w dół ekranu)', () => {
    const cases: [number, number, string][] = [[0, 1, 'S'], [1, 1, 'SE'], [1, 0, 'E'], [1, -1, 'NE'], [0, -1, 'N'], [-1, -1, 'NW'], [-1, 0, 'W'], [-1, 1, 'SW']];
    for (const [dx, dy, d] of cases) expect(dirFromVector(dx, dy)).toBe(d);
  });
  it('ekwipunek gry → 4 sloty (łowca bez broni, bo łuku nie ma w paczce)', () => {
    expect(equipmentFromGear('warrior', { weapon: 1, shield: 2, helm: 0, boots: 1 })).toEqual({ weapon: 'sword_short', shield: 'shield_round', helmet: null, boots: 'boots_leather' });
    expect(equipmentFromGear('hunter', { weapon: 1, shield: 0, helm: 1, boots: 0 }).weapon).toBeNull();
  });
});
