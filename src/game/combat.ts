// Walka gracza: cel i auto-atak (wręcz / łuk), umiejętności, pociski, obrażenia od potworów, exp, śmierć.
import { Container, Graphics } from 'pixi.js';
import type { Hero } from '../entities/actors';
import { EXP_TO_NEXT, MAX_LEVEL, type ClassId } from '../logic/character';
import {
  BOW_RANGE, HP_REGEN, KNOCKBACK, MELEE_RANGE, MOBS, OUT_OF_COMBAT, PLAYER_ATTACK_EVERY, SKILLS, STUN_TIME,
  afterArmor, damageMob, dist, gainExp, playerDamage, seeded, type Mob, type MobEvent, type Progress, type SkillId, type Vec,
} from '../logic/combat';
import type { SavedChar } from '../logic/save';
import type { Effects } from '../render/effects';
import type { HudApi, SlotDef } from '../types';
import type { Floaters } from '../ui/floaters';
import { ICONS } from '../ui/icons';
import type { World } from '../world/world';
import type { MobManager } from './mobs';
import type { InventoryController } from './inventory';

export const START_ARROWS = 200;
const ARROW_SPEED = 420;
const DEATH_DELAY = 2.5;

interface Projectile { pos: Vec; target: number; dmg: number; push: boolean; delay: number; g: Graphics }

export interface CombatDeps {
  world: World; hero: Hero; mobs: MobManager; hud: HudApi; floaters: Floaters; effects: Effects; layer: Container;
  icons: Record<string, string>;
  /** idź do punktu (lokalne współrzędne bieżącej komórki) */
  moveTo(u: number, v: number): boolean;
  /** po śmierci: przeniesienie do miasta */
  onDeath(): void;
  onLevelUp(): void;
  /** zabity potwór (łup) */
  onKill(m: Mob): void;
}

export class PlayerCombat {
  readonly cls: ClassId;
  hp: number;
  mana: number;
  arrows: number;
  readonly progress: Progress;
  private potCd = 0;
  target: number | null = null;
  dead = false;
  private deadT = 0;
  private atkCd = 0;
  private readonly cds: [number, number] = [0, 0];
  private queued: SkillId | null = null;
  private sinceHit = 99;
  private repath = 0;
  private readonly shots: Projectile[] = [];
  private readonly rng = seeded(Date.now() & 0xffffff);
  kills = 0;

  constructor(char: SavedChar, private readonly d: CombatDeps, readonly inv: InventoryController) {
    this.cls = char.cls;
    this.hp = inv.stats.hpMax;
    this.mana = inv.stats.manaMax;
    this.arrows = char.arrows ?? START_ARROWS;
    this.progress = { level: char.level, exp: char.exp, points: 0 };
    d.hud.setSlots(this.slots());
    d.hud.setExp(this.progress.exp, this.expMax());
  }

  get hpMax() { return this.inv.stats.hpMax; }
  get manaMax() { return this.inv.stats.manaMax; }
  get gold() { return this.inv.gold; }
  set gold(g: number) { this.inv.gold = g; }

  /** po zmianie statystyk (ekwipunek, punkty): przytnij zdrowie i manę do nowych maksimów */
  clampVitals() { this.hp = Math.min(this.hp, this.hpMax); this.mana = Math.min(this.mana, this.manaMax); }

  expMax() { return this.progress.level >= MAX_LEVEL ? 1 : EXP_TO_NEXT[this.progress.level]; }

  private slots(): (SlotDef | null)[] {
    const [a, b] = SKILLS[this.cls];
    const ic = this.d.icons;
    const icon = (id: SkillId) => (id === 'power' ? ic.icon_sword : id === 'knockdown' ? ic.icon_bash : id === 'double' ? ICONS.double : ICONS.push);
    const sk = (s: typeof a, key: string): SlotDef => ({ key, icon: icon(s.id), name: s.name, desc: s.desc, mana: s.mana, cd: s.cd });
    return [
      sk(a, '1'), sk(b, '2'), null, null, null,
      { key: 'Q', icon: ic.icon_hp, name: 'Mikstura zdrowia', desc: 'Przywraca 15% zdrowia. Wypada z potworów.', count: 0 },
      { key: 'E', icon: ic.icon_mp, name: 'Mikstura many', desc: 'Przywraca 15% many. Wypada z potworów.', count: 0 },
      this.cls === 'hunter' ? { key: '·', icon: ICONS.arrows, name: 'Strzały', desc: 'Łowca zużywa 1 strzałę na strzał. Kupisz je w sklepie.', count: this.arrows } : null,
    ];
  }

  private heroPos(): Vec {
    const C = this.d.world.size;
    return [this.d.world.cx * C + this.d.hero.u, this.d.world.cy * C + this.d.hero.v];
  }

  private mob(): Mob | null {
    const m = this.target != null ? this.d.mobs.mobs.get(this.target) : undefined;
    return m && m.state !== 'dead' ? m : null;
  }

  private get range() { return this.cls === 'warrior' ? MELEE_RANGE : BOW_RANGE; }

  setTarget(m: Mob | null) {
    if (this.dead) return;
    this.target = m ? m.id : null;
    this.d.mobs.target = this.target;
    if (!m) this.queued = null;
    this.repath = 0;
  }

  /** użycie miejsca tacy: 0–1 umiejętności, 5–6 mikstury */
  useSlot(i: number) {
    if (this.dead) return;
    if (i === 5 || i === 6) {
      if (this.potCd > 0) return;
      const kind = i === 5 ? 'hp' : 'mp';
      const n = this.inv.drink(kind);
      if (!n) { this.d.hud.float('Brak mikstur', '#c8bca4'); return; }
      this.potCd = 1;
      if (kind === 'hp') { this.hp = Math.min(this.hpMax, this.hp + n); this.d.floaters.add(this.d.hero.sx, this.d.hero.sy - 40, `+${n}`, '#8ae07a'); }
      else { this.mana = Math.min(this.manaMax, this.mana + n); this.d.floaters.add(this.d.hero.sx, this.d.hero.sy - 40, `+${n}`, '#8ab0ff'); }
      return;
    }
    if (i === 7) { this.d.hud.say(`Strzały: ${this.arrows}.`); return; }
    if (i > 1) return;
    const s = SKILLS[this.cls][i];
    if (this.cds[i] > 0) return;
    if (this.mana < s.mana) { this.d.hud.float('Za mało many', '#8ab0ff'); return; }
    if (this.cls === 'hunter' && this.arrows < (s.id === 'double' ? 2 : 1)) { this.d.hud.float('Brak strzał', '#ffb08a'); return; }
    if (!this.mob()) {
      // bez celu: najbliższy żywy potwór w zasięgu
      const p = this.heroPos();
      const near = this.d.mobs.alive().filter((m) => dist(m.pos, p) < this.range + 64).sort((x, y) => dist(x.pos, p) - dist(y.pos, p))[0];
      if (!near) { this.d.hud.float('Brak celu', '#c8bca4'); return; }
      this.setTarget(near);
    }
    this.queued = s.id;
  }

  onMobEvent(e: MobEvent) {
    if (e.type !== 'attack' || this.dead) return;
    if (this.rng() * 100 < this.inv.stats.dodge) {
      this.d.floaters.add(this.d.hero.sx, this.d.hero.sy - 40, 'unik', '#c8f0ff');
      return;
    }
    this.takeDamage(afterArmor(e.dmg, this.inv.stats.armor));
    if (this.target == null) this.setTarget(e.mob);
  }

  /** obrażenia dla gracza (po pancerzu i uniku) */
  takeDamage(dmg: number) {
    if (this.dead) return;
    this.hp -= dmg;
    this.sinceHit = 0;
    this.d.floaters.add(this.d.hero.sx, this.d.hero.sy - 40, `-${dmg}`, '#ff5a4a', true);
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.hp = 0;
    this.dead = true;
    this.deadT = 0;
    this.d.hero.dead = true;
    this.setTarget(null);
    this.d.mobs.calmDown();
    this.d.hud.say('<span style="color:#ff8a7a">Zginąłeś.</span> Odrodzisz się w mieście.');
  }

  /** po przeniesieniu do miasta */
  revive() {
    this.dead = false;
    this.d.hero.dead = false;
    this.hp = this.hpMax;
    this.mana = this.manaMax;
    this.sinceHit = 99;
  }

  /** doświadczenie spoza walki (np. testy, nagrody) */
  addExp(n: number) {
    const ups = gainExp(this.progress, n);
    this.inv.points += this.progress.points;
    this.progress.points = 0;
    this.d.hud.setExp(this.progress.exp, this.expMax());
    if (ups) { this.hp = this.hpMax; this.mana = this.manaMax; this.d.onLevelUp(); }
  }

  private kill(m: Mob) {
    this.kills++;
    const def = MOBS[m.kind];
    const [x, y] = this.d.world.toScreenGlobal(m.pos[0], m.pos[1]);
    const before = this.progress.level;
    const ups = gainExp(this.progress, before >= MAX_LEVEL ? 0 : def.exp);
    this.inv.points += this.progress.points;
    this.progress.points = 0;
    this.d.onKill(m);
    if (before < MAX_LEVEL) this.d.floaters.add(x, y - 30, `+${def.exp} PD`, '#ffe48a');
    this.d.hud.setExp(this.progress.exp, this.expMax());
    if (this.target === m.id) this.setTarget(null);
    if (ups) {
      this.hp = this.hpMax; this.mana = this.manaMax;
      this.d.effects.ring(0xffe27a);
      this.d.floaters.add(this.d.hero.sx, this.d.hero.sy - 54, `Poziom ${this.progress.level}!`, '#ffe27a', true);
      this.d.hud.say(`Awans na poziom <span style="color:#ffe27a">${this.progress.level}</span>. Punkty atrybutów do rozdzielenia: ${this.inv.points} (ekwipunek, klawisz I).`);
      this.d.onLevelUp();
    }
  }

  private hit(m: Mob, dmg: number, opts: { stun?: boolean; push?: boolean } = {}) {
    if (m.state === 'dead') return;
    const [x, y] = this.d.world.toScreenGlobal(m.pos[0], m.pos[1]);
    this.d.floaters.add(x, y - (m.kind === 'wolf' ? 22 : 44), String(dmg), opts.stun || opts.push ? '#ffd84a' : '#fff6e0', dmg >= 30);
    if (damageMob(m, dmg)) { this.kill(m); return; }
    if (opts.stun) { m.stun = STUN_TIME; this.d.floaters.add(x, y - 56, 'powalony!', '#b0b0ff'); }
    if (opts.push) {
      const p = this.heroPos(), dx = m.pos[0] - p[0], dy = m.pos[1] - p[1], l = Math.hypot(dx, dy) || 1;
      m.knock = { dir: [dx / l, dy / l], left: KNOCKBACK };
    }
  }

  private shoot(m: Mob, dmg: number, push: boolean, delay = 0) {
    const g = new Graphics();
    g.zIndex = 1e9 - 2;
    this.d.layer.addChild(g);
    this.shots.push({ pos: this.heroPos(), target: m.id, dmg, push, delay, g });
    this.arrows = Math.max(0, this.arrows - 1);
  }

  /** wykonanie ataku (zwykłego albo z umiejętności) na cel w zasięgu */
  private strike(m: Mob) {
    const hero = this.d.hero;
    const [mu, mv] = [m.pos[0] - this.d.world.cx * this.d.world.size, m.pos[1] - this.d.world.cy * this.d.world.size];
    hero.faceTo(mu, mv);
    const st = this.inv.stats;
    const roll = () => playerDamage(this.cls, st.attrs, st.weapon, this.rng);
    const q = this.queued;
    const idx = q ? SKILLS[this.cls].findIndex((s) => s.id === q) : -1;
    if (q && idx >= 0) {
      const s = SKILLS[this.cls][idx];
      if (this.mana < s.mana) { this.queued = null; this.d.hud.float('Za mało many', '#8ab0ff'); return; }
      this.mana -= s.mana;
      this.cds[idx] = s.cd;
      this.queued = null;
      hero.attack();
      this.atkCd = PLAYER_ATTACK_EVERY;
      this.d.floaters.add(hero.sx, hero.sy - 52, s.name + '!', '#fff1c4');
      if (q === 'power') this.hit(m, roll() * 2);
      else if (q === 'knockdown') this.hit(m, roll(), { stun: true });
      else if (q === 'double') { this.shoot(m, roll(), false); this.shoot(m, roll(), false, 0.12); }
      else if (q === 'push') this.shoot(m, roll(), true);
      return;
    }
    if (this.atkCd > 0) return;
    if (this.cls === 'hunter' && !st.bow) { this.d.hud.float('Załóż łuk', '#ffb08a'); this.setTarget(null); return; }
    if (this.cls === 'hunter' && this.arrows <= 0) { this.d.hud.float('Brak strzał', '#ffb08a'); this.setTarget(null); return; }
    hero.attack();
    this.atkCd = PLAYER_ATTACK_EVERY;
    if (this.cls === 'warrior') this.hit(m, roll());
    else this.shoot(m, roll(), false);
  }

  update(dt: number) {
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.potCd = Math.max(0, this.potCd - dt);
    this.cds[0] = Math.max(0, this.cds[0] - dt);
    this.cds[1] = Math.max(0, this.cds[1] - dt);
    this.updateShots(dt);
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > DEATH_DELAY) { this.deadT = -1e9; this.d.onDeath(); }
      return;
    }
    this.sinceHit += dt;
    this.mana = Math.min(this.manaMax, this.mana + this.inv.stats.manaRegen * dt);
    if (this.sinceHit > OUT_OF_COMBAT) this.hp = Math.min(this.hpMax, this.hp + this.hpMax * HP_REGEN * dt);

    const m = this.mob();
    if (!m) { if (this.target != null) this.setTarget(null); return; }
    const p = this.heroPos(), dd = dist(p, m.pos);
    if (dd > this.range) {
      // podejdź do celu (ścieżka odświeżana co 0,25 s)
      this.repath -= dt;
      if (this.repath <= 0 || !this.d.hero.path.length) {
        this.repath = 0.25;
        const C = this.d.world.size;
        if (!this.d.moveTo(m.pos[0] - this.d.world.cx * C, m.pos[1] - this.d.world.cy * C)) { this.setTarget(null); this.d.hud.float('Nie dojdę tam', '#c8bca4'); }
      }
      return;
    }
    this.d.hero.path = [];
    this.strike(m);
  }

  private updateShots(dt: number) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const m = this.d.mobs.mobs.get(s.target);
      if (!m || m.state === 'dead') { s.g.destroy(); this.shots.splice(i, 1); continue; }
      if (s.delay > 0) { s.delay -= dt; s.g.visible = false; continue; }
      s.g.visible = true;
      const dx = m.pos[0] - s.pos[0], dy = m.pos[1] - s.pos[1], dl = Math.hypot(dx, dy), step = ARROW_SPEED * dt;
      if (dl <= step + 4) {
        this.hit(m, s.dmg, { push: s.push });
        s.g.destroy(); this.shots.splice(i, 1);
        continue;
      }
      s.pos[0] += (dx / dl) * step; s.pos[1] += (dy / dl) * step;
      const [x, y] = this.d.world.toScreenGlobal(s.pos[0], s.pos[1]);
      const sx = dx - dy, sy = (dx + dy) / 2, sl = Math.hypot(sx, sy) || 1;
      const ux = (sx / sl) * 7, uy = (sy / sl) * 7;
      s.g.clear()
        .moveTo(Math.round(x - ux), Math.round(y - 18 - uy)).lineTo(Math.round(x), Math.round(y - 18)).stroke({ width: 1, color: s.push ? 0xffd84a : 0xe8e0d0 })
        .rect(Math.round(x - ux), Math.round(y - 18 - uy), 1, 1).fill(0xe04a3a);
    }
  }

  clearShots() { for (const s of this.shots) s.g.destroy(); this.shots.length = 0; }

  /** stan tacy i kul do HUD (co klatkę) */
  syncHud() {
    const h = this.d.hud;
    h.setVitals(this.hp, this.hpMax, this.mana, this.manaMax);
    const sk = SKILLS[this.cls];
    for (let i = 0; i < 2; i++) h.setSlotState(i, this.cds[i], sk[i].cd, undefined, this.mana < sk[i].mana || this.dead);
    h.setSlotState(5, this.potCd, 1, this.inv.inv.hpPot, this.inv.inv.hpPot <= 0 || this.dead);
    h.setSlotState(6, this.potCd, 1, this.inv.inv.mpPot, this.inv.inv.mpPot <= 0 || this.dead);
    if (this.cls === 'hunter') h.setSlotState(7, 0, 0, this.arrows, this.arrows <= 0);
  }
}
