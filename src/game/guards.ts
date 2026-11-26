// Strażnicy miasta (poz. 20): stoją przed bramami, a gdy potwór podejdzie za blisko – ruszają i go zabijają.
// Nieśmiertelni dla prototypu; potwory ich nie atakują. Zabici przez nich nie dają graczowi doświadczenia.
import { Container, Sprite, Text } from 'pixi.js';
import { CharSheet } from '../chars/sheet';
import { damageMob, dist, type Vec } from '../logic/combat';
import type { Atlas } from '../render/atlas';
import type { Floaters } from '../ui/floaters';
import type { World } from '../world/world';
import type { MobManager } from './mobs';

export const GUARD_LEVEL = 20;
const GUARD_RANGE = 230;      // potwór bliżej niż tyle od posterunku → atak
const GUARD_SPEED = 70;
const GUARD_HIT = 160;
const GUARD_EVERY = 0.8;
const OCT_DIR = ['E', 'SE', 'S', 'SE', 'E', 'NE', 'N', 'NE'] as const;

interface Guard { post: Vec; pos: Vec; face: Vec; target: number | null; cd: number; atkT: number; moving: boolean; c: Container; s: Sprite; frame: string }

export class GuardManager {
  readonly guards: Guard[] = [];
  readonly sheet: CharSheet;
  private t = 0;

  constructor(private readonly world: World, atlas: Atlas, layer: Container, private readonly mobs: MobManager, private readonly floaters: Floaters,
    posts: { cx: number; cy: number; u: number; v: number; fu: number; fv: number }[]) {
    this.sheet = new CharSheet({
      race: 'human', cls: 'warrior', hair: 'black', build: 'stocky', beard: 'short',
      gear: { weapon: 3, shield: 3, armor: 3, helm: 3, boots: 2, gloves: 1 },
    });
    const C = world.size;
    for (const p of posts) {
      const c = new Container();
      const sh = atlas.sprite('shadow');
      const s = new Sprite();
      const label = new Text({ text: `Strażnik · poz. ${GUARD_LEVEL}`, style: { fontFamily: 'Jersey', fontSize: 8, fill: 0x8af59a, stroke: { color: 0x0a0706, width: 2 } } });
      label.resolution = 4;
      label.anchor.set(0.5, 1);
      label.position.set(0, -74);
      c.addChild(sh, s, label);
      layer.addChild(c);
      const post: Vec = [p.cx * C + p.u, p.cy * C + p.v];
      this.guards.push({ post, pos: [post[0], post[1]], face: [p.fu, p.fv], target: null, cd: 0, atkT: -1, moving: false, c, s, frame: '' });
    }
  }

  private active(g: Guard) {
    const C = this.world.size;
    return !this.world.inInterior && this.world.isLoaded(Math.floor(g.pos[0] / C), Math.floor(g.pos[1] / C));
  }

  update(dt: number) {
    this.t += dt;
    for (const g of this.guards) {
      const on = this.active(g);
      g.c.visible = on;
      if (!on) continue;
      g.cd = Math.max(0, g.cd - dt);
      if (g.atkT >= 0) { g.atkT += dt; if (g.atkT > 0.35) g.atkT = -1; }
      g.moving = false;
      // cel: najbliższy żywy potwór w promieniu posterunku
      let m = g.target != null ? this.mobs.mobs.get(g.target) : undefined;
      if (!m || m.state === 'dead' || dist(m.pos, g.post) > GUARD_RANGE * 1.3) {
        m = undefined;
        g.target = null;
        let best = GUARD_RANGE;
        for (const x of this.mobs.alive()) { const d = dist(x.pos, g.post); if (d < best) { best = d; m = x; } }
        if (m) g.target = m.id;
      }
      const goal: Vec = m ? m.pos : g.post;
      const d = dist(g.pos, goal);
      const reach = m ? 30 : 2;
      if (d > reach) {
        const step = Math.min(d - reach + 0.01, GUARD_SPEED * dt);
        g.pos[0] += ((goal[0] - g.pos[0]) / d) * step;
        g.pos[1] += ((goal[1] - g.pos[1]) / d) * step;
        g.moving = true;
        g.face = [goal[0] - g.pos[0], goal[1] - g.pos[1]];
      } else if (m) {
        g.face = [m.pos[0] - g.pos[0], m.pos[1] - g.pos[1]];
        if (g.cd <= 0) {
          g.cd = GUARD_EVERY;
          g.atkT = 0;
          const [x, y] = this.world.toScreenGlobal(m.pos[0], m.pos[1]);
          this.floaters.add(x, y - (m.kind === 'wolf' ? 22 : 44), String(GUARD_HIT), '#b8f0a0', true);
          if (damageMob(m, GUARD_HIT)) g.target = null;
        }
      }
      this.render(g);
    }
  }

  private render(g: Guard) {
    const [x, y] = this.world.toScreenGlobal(g.pos[0], g.pos[1]);
    g.c.position.set(Math.round(x), Math.round(y));
    const C = this.world.size;
    g.c.zIndex = Math.round(g.pos[0] - this.world.cx * C + g.pos[1] - this.world.cy * C) * 10 + 6;
    const sdx = g.face[0] - g.face[1], sdy = (g.face[0] + g.face[1]) / 2;
    const oct = ((Math.round(Math.atan2(sdy, sdx) / (Math.PI / 4)) % 8) + 8) % 8;
    const act = g.atkT >= 0 ? (g.atkT < 0.14 ? 'atk0' : 'atk1') : g.moving ? `walk${Math.floor(this.t * 10) % 4}` : `idle${Math.floor(this.t * 1.5) % 2}`;
    const name = `hero_${OCT_DIR[oct]}_${act}`;
    if (name !== g.frame) { this.sheet.setFrame(g.s, name); g.frame = name; }
    g.s.scale.x = oct >= 3 && oct <= 5 ? -1 : 1;
  }
}
