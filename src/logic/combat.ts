// Walka: potwory (statystyki, AI), obrażenia, umiejętności, doświadczenie. Czysta logika bez grafiki –
// współrzędne globalne w tekselach świata (gu, gv), czas w sekundach. Do przeniesienia na serwer.
import { EXP_TO_NEXT, MAX_LEVEL, POINTS_PER_LEVEL, type Attributes, type ClassId } from './character';

export type MobKind = 'wolf' | 'skeleton' | 'zombie';
export type Vec = [number, number];

export interface MobDef {
  name: string; hp: number; dmg: number; exp: number;
  /** tekseli na sekundę */
  speed: number;
  /** promień zauważenia gracza */
  aggro: number;
  /** odstęp między atakami (s) */
  atkEvery: number;
  /** zasięg ataku */
  range: number;
}

export const MOBS: Record<MobKind, MobDef> = {
  wolf: { name: 'Wilk', hp: 80, dmg: 30, exp: 50, speed: 66, aggro: 192, atkEvery: 1.2, range: 26 },
  skeleton: { name: 'Szkielet', hp: 100, dmg: 50, exp: 100, speed: 44, aggro: 160, atkEvery: 1.8, range: 28 },
  zombie: { name: 'Zombie', hp: 150, dmg: 70, exp: 150, speed: 30, aggro: 128, atkEvery: 2.2, range: 28 },
};

export const RESPAWN = 30;          // s od zabicia (w losowym miejscu komórki)
export const CORPSE_TIME = 3;       // s widoczności ciała
export const ATTACK_ANIM = 0.35;    // s animacji ataku
export const MELEE_RANGE = 34;
export const BOW_RANGE = 256;       // 8 kafli na start
export const TILE = 32;
export const PLAYER_ATTACK_EVERY = 1.0;
export const KNOCKBACK = 320;       // 10 kafli
export const STUN_TIME = 3;
/** odskok (prawy przycisk myszy) */
export const DASH_DIST = 64;        // 2 kafle
export const DASH_TIME = 0.18;
export const DASH_CD = 10;
export const DASH_IFRAMES = 0.35;   // s bez obrażeń

/** zasięg łuku: 8 kafli + 1 kafel za każde 10 Zręczności powyżej 20 */
export const bowRange = (dex: number) => BOW_RANGE + Math.floor(Math.max(0, dex - 20) / 10) * TILE;

/** siedzenie: dodatkowe +100 HP na minutę (na sekundę) */
export const SIT_REGEN = 100 / 60;

/** odnawianie zdrowia: +30 HP na minutę za każde pełne 10 Witalności (na sekundę) */
export const hpRegen = (vit: number) => (Math.floor(vit / 10) * 30) / 60;

export type Rng = () => number;

export interface Mob {
  id: number;
  kind: MobKind;
  cell: [number, number];
  home: Vec;
  pos: Vec;
  hp: number;
  state: 'idle' | 'chase' | 'return' | 'dead';
  stun: number;
  atkCd: number;
  /** czas od rozpoczęcia ataku (animacja), <0 = brak */
  atkT: number;
  deadT: number;
  wander: Vec | null;
  wanderT: number;
  knock: { dir: Vec; left: number } | null;
  /** kierunek patrzenia (ekranowo: dx = du - dv) */
  face: Vec;
  moving: boolean;
}

export const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function makeMob(id: number, kind: MobKind, cell: [number, number], home: Vec): Mob {
  return {
    id, kind, cell, home: [home[0], home[1]], pos: [home[0], home[1]], hp: MOBS[kind].hp, state: 'idle',
    stun: 0, atkCd: 0, atkT: -1, deadT: 0, wander: null, wanderT: 2, knock: null, face: [1, 0], moving: false,
  };
}

/** krok ruchu z omijaniem przeszkód (ślizg wzdłuż osi); zwraca czy się ruszył */
export function stepToward(pos: Vec, target: Vec, maxStep: number, walk: (gu: number, gv: number) => boolean): boolean {
  const dx = target[0] - pos[0], dy = target[1] - pos[1], d = Math.hypot(dx, dy);
  if (d < 0.01) return false;
  const s = Math.min(maxStep, d);
  const nx = pos[0] + (dx / d) * s, ny = pos[1] + (dy / d) * s;
  if (walk(nx, ny)) { pos[0] = nx; pos[1] = ny; return true; }
  if (Math.abs(dx) > 0.01 && walk(pos[0] + Math.sign(dx) * s, pos[1])) { pos[0] += Math.sign(dx) * s; return true; }
  if (Math.abs(dy) > 0.01 && walk(pos[0], pos[1] + Math.sign(dy) * s)) { pos[1] += Math.sign(dy) * s; return true; }
  return false;
}

export type MobEvent =
  | { type: 'attack'; mob: Mob; dmg: number }
  | { type: 'respawn'; mob: Mob };

export interface PlayerSense { pos: Vec; alive: boolean }

/** jeden krok AI potwora */
export function updateMob(m: Mob, dt: number, player: PlayerSense, walk: (gu: number, gv: number) => boolean, rng: Rng, out: MobEvent[]) {
  const def = MOBS[m.kind];
  m.moving = false;
  if (m.atkT >= 0) { m.atkT += dt; if (m.atkT > ATTACK_ANIM) m.atkT = -1; }
  if (m.state === 'dead') {
    m.deadT += dt;
    if (m.deadT >= RESPAWN) {
      Object.assign(m, makeMob(m.id, m.kind, m.cell, m.home));
      out.push({ type: 'respawn', mob: m });
    }
    return;
  }
  // odrzut
  if (m.knock) {
    const step = Math.min(m.knock.left, 900 * dt);
    const target: Vec = [m.pos[0] + m.knock.dir[0] * step, m.pos[1] + m.knock.dir[1] * step];
    if (!walk(target[0], target[1]) || step <= 0) m.knock = null;
    else { m.pos[0] = target[0]; m.pos[1] = target[1]; m.knock.left -= step; if (m.knock.left <= 0) m.knock = null; }
    return;
  }
  if (m.stun > 0) { m.stun = Math.max(0, m.stun - dt); return; }
  m.atkCd = Math.max(0, m.atkCd - dt);
  const dp = dist(m.pos, player.pos), dh = dist(m.pos, m.home);

  if (m.state === 'return') {
    m.hp = Math.min(def.hp, m.hp + def.hp * 0.5 * dt);
    if (dh < 8) { m.state = 'idle'; m.hp = def.hp; return; }
    m.moving = stepToward(m.pos, m.home, def.speed * 1.3 * dt, walk);
    faceTo(m, m.home);
    if (!m.moving) { m.pos[0] = m.home[0]; m.pos[1] = m.home[1]; }
    return;
  }
  if (m.state === 'chase') {
    if (!player.alive) { m.state = 'return'; return; }      // bez smyczy: goni po całej mapie
    faceTo(m, player.pos);
    if (dp > def.range) {
      m.moving = stepToward(m.pos, player.pos, def.speed * dt, walk);
    } else if (m.atkCd <= 0) {
      m.atkCd = def.atkEvery;
      m.atkT = 0;
      out.push({ type: 'attack', mob: m, dmg: def.dmg });
    }
    return;
  }
  // idle: zauważa gracza albo krąży przy domu
  if (player.alive && dp < def.aggro) { m.state = 'chase'; return; }
  m.wanderT -= dt;
  if (m.wander) {
    m.moving = stepToward(m.pos, m.wander, def.speed * 0.4 * dt, walk);
    faceTo(m, m.wander);
    if (!m.moving || dist(m.pos, m.wander) < 2) m.wander = null;
  } else if (m.wanderT <= 0) {
    m.wanderT = 3 + rng() * 5;
    const a = rng() * Math.PI * 2, r = 16 + rng() * 48;
    m.wander = [m.home[0] + Math.cos(a) * r, m.home[1] + Math.sin(a) * r];
  }
}

function faceTo(m: Mob, t: Vec) {
  const du = t[0] - m.pos[0], dv = t[1] - m.pos[1];
  if (Math.hypot(du, dv) > 0.5) m.face = [du, dv];
}

/** zaczepienie potwora (np. trafiony z dystansu) */
export function provoke(m: Mob) { if (m.state === 'idle') m.state = 'chase'; }

/** zadanie obrażeń potworowi; zwraca czy zginął */
export function damageMob(m: Mob, dmg: number): boolean {
  if (m.state === 'dead') return false;
  m.hp -= dmg;
  provoke(m);
  if (m.hp <= 0) {
    m.hp = 0; m.state = 'dead'; m.deadT = 0; m.knock = null; m.stun = 0; m.atkT = -1;
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ gracz: obrażenia, umiejętności, exp
export interface Weapon { name: string; min: number; max: number }
export const START_WEAPON: Record<ClassId, Weapon> = {
  warrior: { name: 'Krótki miecz', min: 8, max: 12 },
  hunter: { name: 'Krótki łuk', min: 8, max: 12 },
};

/** obrażenia jednego ciosu/strzału: broń + Siła/2 (wręcz) albo Zręczność/2 (łuk) */
export function playerDamage(cls: ClassId, a: Attributes, w: Weapon, rng: Rng): number {
  const base = w.min + Math.floor(rng() * (w.max - w.min + 1));
  return base + Math.floor((cls === 'warrior' ? a.str : a.dex) / 2);
}

export const damageRange = (cls: ClassId, a: Attributes, w: Weapon): [number, number] => {
  const b = Math.floor((cls === 'warrior' ? a.str : a.dex) / 2);
  return [w.min + b, w.max + b];
};

/** obrażenia po pancerzu: dmg × 100 / (100 + pancerz) */
export const afterArmor = (dmg: number, armor: number) => Math.max(1, Math.round((dmg * 100) / (100 + armor)));

export type SkillId = 'power' | 'knockdown' | 'double' | 'push';
export interface SkillDef { id: SkillId; name: string; mana: number; cd: number; desc: string }

export const SKILLS: Record<ClassId, [SkillDef, SkillDef]> = {
  warrior: [
    { id: 'power', name: 'Super uderzenie', mana: 10, cd: 5, desc: 'Cios za podwójne obrażenia.' },
    { id: 'knockdown', name: 'Powalenie', mana: 15, cd: 10, desc: 'Powala cel na 3 s.' },
  ],
  hunter: [
    { id: 'double', name: 'Podwójny strzał', mana: 10, cd: 5, desc: 'Dwie strzały naraz (zużywa 2 strzały).' },
    { id: 'push', name: 'Odpychająca strzała', mana: 15, cd: 10, desc: 'Odrzuca cel o 10 kafli.' },
  ],
};

export interface Progress { level: number; exp: number; points: number }

/** dodanie doświadczenia; zwraca liczbę awansów (na maks. poziomie exp się nie nalicza) */
export function gainExp(p: Progress, amount: number): number {
  if (p.level >= MAX_LEVEL) { p.exp = 0; return 0; }
  p.exp += amount;
  let ups = 0;
  while (p.level < MAX_LEVEL && p.exp >= EXP_TO_NEXT[p.level]) {
    p.exp -= EXP_TO_NEXT[p.level];
    p.level++;
    p.points += POINTS_PER_LEVEL;
    ups++;
  }
  if (p.level >= MAX_LEVEL) p.exp = 0;
  return ups;
}

/** kara za śmierć: 10% złota */
export const deathPenalty = (gold: number) => Math.floor(gold * 0.1);

// ------------------------------------------------------------------ rozmieszczenie potworów
/** udział typów potworów wg biomu komórki */
export const BIOME_MOBS: Record<string, Partial<Record<MobKind, number>>> = {
  meadow: { wolf: 0.85, skeleton: 0.15 },
  forest: { wolf: 0.75, skeleton: 0.25 },
  hills: { wolf: 0.6, skeleton: 0.4 },
  river: { wolf: 0.7, skeleton: 0.2, zombie: 0.1 },
  ruins: { skeleton: 0.7, zombie: 0.3 },
  darkforest: { zombie: 0.5, skeleton: 0.3, wolf: 0.2 },
  cemetery: { zombie: 0.8, skeleton: 0.2 },
  crags: { skeleton: 0.5, zombie: 0.5 },
};

export function pickKind(biome: string, r: number): MobKind | null {
  const w = BIOME_MOBS[biome];
  if (!w) return null;
  let acc = 0;
  for (const [k, p] of Object.entries(w) as [MobKind, number][]) { acc += p; if (r < acc) return k; }
  return (Object.keys(w)[0] as MobKind) ?? null;
}

/** punkty startu: losowe przechodnie miejsca w komórce, z odstępami, z dala od krawędzi */
export function spawnPoints(size: number, count: number, walk: (u: number, v: number) => boolean, rng: Rng, minDist = 56, inset = 48): Vec[] {
  const pts: Vec[] = [];
  for (let tries = 0; tries < count * 60 && pts.length < count; tries++) {
    const p: Vec = [inset + rng() * (size - 2 * inset), inset + rng() * (size - 2 * inset)];
    if (!walk(p[0], p[1]) || !walk(p[0] + 12, p[1]) || !walk(p[0] - 12, p[1]) || !walk(p[0], p[1] + 12) || !walk(p[0], p[1] - 12)) continue;
    if (pts.some((q) => dist(p, q) < minDist)) continue;
    pts.push(p);
  }
  return pts;
}

/** deterministyczny generator liczb losowych (mulberry32) */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
