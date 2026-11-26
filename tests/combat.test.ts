import { describe, expect, it } from 'vitest';
import {
  MOBS, RESPAWN, afterArmor, bowRange, hpRegen, damageMob, damageRange, deathPenalty, gainExp, makeMob, pickKind, playerDamage,
  seeded, spawnPoints, stepToward, updateMob, type MobEvent, type Vec,
} from '../src/logic/combat';

const open = () => true;
const fixed = (x: number) => () => x;

describe('potwory – statystyki z planu', () => {
  it('HP, obrażenia i exp', () => {
    expect([MOBS.skeleton.hp, MOBS.skeleton.dmg, MOBS.skeleton.exp]).toEqual([100, 50, 100]);
    expect([MOBS.zombie.hp, MOBS.zombie.dmg, MOBS.zombie.exp]).toEqual([150, 70, 150]);
    expect([MOBS.wolf.hp, MOBS.wolf.dmg, MOBS.wolf.exp]).toEqual([80, 30, 50]);
  });
});

describe('AI potwora', () => {
  it('zauważa gracza, goni i atakuje w zasięgu z odstępem', () => {
    const m = makeMob(1, 'wolf', [0, 0], [0, 0]);
    const ev: MobEvent[] = [];
    const player = { pos: [100, 0] as Vec, alive: true };
    updateMob(m, 0.1, player, open, fixed(0.5), ev);
    expect(m.state).toBe('chase');
    for (let i = 0; i < 40; i++) updateMob(m, 0.1, player, open, fixed(0.5), ev);
    expect(m.pos[0]).toBeGreaterThan(70);
    const attacks = ev.filter((e) => e.type === 'attack');
    expect(attacks.length).toBeGreaterThanOrEqual(1);
    expect(attacks[0]).toMatchObject({ dmg: 30 });
    // odstęp między atakami
    const n0 = attacks.length;
    for (let i = 0; i < 5; i++) updateMob(m, 0.1, player, open, fixed(0.5), ev);
    expect(ev.filter((e) => e.type === 'attack').length - n0).toBeLessThanOrEqual(1);
  });

  it('goni gracza bez ograniczenia odległości, wraca i leczy się dopiero po jego śmierci', () => {
    const m = makeMob(1, 'skeleton', [0, 0], [0, 0]);
    m.state = 'chase';
    m.pos = [3000, 0];
    m.hp = 20;
    const ev: MobEvent[] = [];
    updateMob(m, 0.1, { pos: [3200, 0], alive: true }, open, fixed(0.5), ev);
    expect(m.state).toBe('chase');
    expect(m.pos[0]).toBeGreaterThan(3000);
    updateMob(m, 0.1, { pos: [3200, 0], alive: false }, open, fixed(0.5), ev);
    expect(m.state).toBe('return');
    for (let i = 0; i < 2000; i++) updateMob(m, 0.1, { pos: [3200, 0], alive: false }, open, fixed(0.5), ev);
    expect(m.state).toBe('idle');
    expect(m.hp).toBe(MOBS.skeleton.hp);
  });

  it('powalony nie rusza się i nie atakuje', () => {
    const m = makeMob(1, 'zombie', [0, 0], [0, 0]);
    m.state = 'chase'; m.stun = 3;
    const ev: MobEvent[] = [];
    for (let i = 0; i < 25; i++) updateMob(m, 0.1, { pos: [10, 0], alive: true }, open, fixed(0.5), ev);
    expect(ev).toHaveLength(0);
    expect(m.pos).toEqual([0, 0]);
  });

  it('odrzut zatrzymuje się na przeszkodzie', () => {
    const m = makeMob(1, 'wolf', [0, 0], [0, 0]);
    m.knock = { dir: [1, 0], left: 320 };
    const wall = (u: number) => u < 100;
    for (let i = 0; i < 20; i++) updateMob(m, 0.05, { pos: [-500, 0], alive: true }, wall, fixed(0.5), []);
    expect(m.pos[0]).toBeLessThan(100);
    expect(m.pos[0]).toBeGreaterThan(60);
    expect(m.knock).toBeNull();
  });

  it('martwy odradza się po 15 s z pełnym HP w punkcie startu', () => {
    const m = makeMob(1, 'wolf', [0, 0], [5, 5]);
    m.pos = [40, 40];
    expect(damageMob(m, 500)).toBe(true);
    const ev: MobEvent[] = [];
    for (let t = 0; t < RESPAWN - 0.2; t += 0.1) updateMob(m, 0.1, { pos: [0, 0], alive: true }, open, fixed(0.5), ev);
    expect(m.state).toBe('dead');
    updateMob(m, 0.3, { pos: [0, 0], alive: true }, open, fixed(0.5), ev);
    expect(m.state).toBe('idle');
    expect(m.hp).toBe(80);
    expect(m.pos).toEqual([5, 5]);
    expect(ev.some((e) => e.type === 'respawn')).toBe(true);
  });

  it('ślizga się wzdłuż ściany', () => {
    const p: Vec = [0, 0];
    const walk = (u: number, w: number) => !(u > 5 && w < 5);
    expect(stepToward(p, [20, 20], 10, walk)).toBe(true);
  });
});

describe('gracz', () => {
  it('obrażenia: broń + Siła/2 dla wojownika, Zręczność/2 dla łowcy', () => {
    const a = { str: 22, dex: 10, vit: 22, ene: 10 };
    expect(damageRange('warrior', a, { name: '', min: 8, max: 12 })).toEqual([19, 23]);
    expect(damageRange('hunter', a, { name: '', min: 8, max: 12 })).toEqual([13, 17]);
    expect(playerDamage('warrior', a, { name: '', min: 8, max: 12 }, fixed(0))).toBe(19);
    expect(playerDamage('warrior', a, { name: '', min: 8, max: 12 }, fixed(0.999))).toBe(23);
  });

  it('pancerz zmniejsza obrażenia', () => {
    expect(afterArmor(100, 0)).toBe(100);
    expect(afterArmor(100, 100)).toBe(50);
  });

  it('exp i awans wg tabeli, maks. poziom 5', () => {
    const p = { level: 1, exp: 0, points: 0 };
    expect(gainExp(p, 999)).toBe(0);
    expect(gainExp(p, 1)).toBe(1);
    expect(p).toEqual({ level: 2, exp: 0, points: 5 });
    expect(gainExp(p, 1300 + 1800 + 2500 + 5000)).toBe(3);
    expect(p.level).toBe(5);
    expect(p.exp).toBe(0);
    expect(gainExp(p, 100)).toBe(0);
  });

  it('zasięg łuku: 8 kafli, +1 kafel za każde 10 Zręczności powyżej 20', () => {
    expect(bowRange(20)).toBe(256);
    expect(bowRange(29)).toBe(256);
    expect(bowRange(30)).toBe(288);
    expect(bowRange(45)).toBe(320);
    expect(bowRange(10)).toBe(256);
  });

  it('odnawianie zdrowia: 30 HP/min za każde pełne 10 Witalności', () => {
    expect(hpRegen(9) * 60).toBe(0);
    expect(hpRegen(22) * 60).toBe(60);
    expect(hpRegen(30) * 60).toBe(90);
  });

  it('kara za śmierć: 10% złota', () => {
    expect(deathPenalty(155)).toBe(15);
  });
});

describe('rozmieszczenie', () => {
  it('30 punktów z odstępami, tylko w przechodnim terenie', () => {
    const walk = (u: number, _v: number) => !(u > 500 && u < 700);
    const pts = spawnPoints(1280, 30, walk, seeded(3));
    expect(pts).toHaveLength(30);
    for (const p of pts) expect(walk(p[0], p[1])).toBe(true);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThanOrEqual(56);
  });

  it('typy wg biomu, miasto bez potworów', () => {
    expect(pickKind('cemetery', 0.1)).toBe('zombie');
    expect(pickKind('meadow', 0.1)).toBe('wolf');
    expect(pickKind('town', 0.1)).toBeNull();
  });
});
