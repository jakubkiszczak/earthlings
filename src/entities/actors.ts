// Bohater (ruch po ścieżce, 8 kierunków z odbiciem lustrzanym) i pies idący jego śladem.
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Atlas } from '../render/atlas';
import type { WorldGrid } from '../world/grid';

const HERO_SPEED = 51;   // jednostek świata na sekundę
const DOG_SPEED = 60;
const TRAIL_MAX = 120;
const DOG_LAG = 18;      // ile próbek śladu pies zostaje w tyle

// oktant 0=E,1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE → klatki atlasu (W/SW/NW to odbicia)
const OCT_DIR = ['E', 'SE', 'S', 'SE', 'E', 'NE', 'N', 'NE'] as const;

interface Actor { c: Container; s: Sprite }

function makeActor(atlas: Atlas, layer: Container, shadowW: number): Actor {
  const c = new Container();
  const shadow = atlas.sprite('shadow');
  shadow.scale.set(shadowW, 1);
  const s = new Sprite();
  c.addChild(shadow, s);
  layer.addChild(c);
  return { c, s };
}

/** zIndex aktora w warstwie świata (nad terenem i obiektami o tym samym u+v) */
const actorZ = (u: number, v: number) => Math.round(u + v) * 10 + 6;

export class Hero {
  u: number;
  v: number;
  path: [number, number][] = [];
  dir: (typeof OCT_DIR)[number] = 'NE';
  flip = false;
  moving = false;
  /** pozycja na obrazie świata (piksele, zaokrąglone) */
  sx = 0;
  sy = 0;
  readonly trail: [number, number][] = [];
  private readonly a: Actor;
  private readonly headMark: Graphics;

  constructor(private readonly atlas: Atlas, layer: Container, start: [number, number]) {
    [this.u, this.v] = start;
    this.a = makeActor(atlas, layer, 1);
    this.headMark = new Graphics().poly([-3, 0, 3, 0, 0, 4]).fill(0xffd84a).stroke({ width: 1, color: 0x1a1210 });
    this.a.c.addChild(this.headMark);
  }

  /** bieżąca klatka (do konturu zasłoniętej postaci) */
  frameName = 'hero_NE_idle0';

  /** kontener postaci w warstwie świata (do przeniesienia między komórkami) */
  get view(): Container { return this.a.c; }
  get body(): Sprite { return this.a.s; }

  teleport(to: [number, number]) {
    [this.u, this.v] = to;
    this.path = [];
    this.trail.length = 0;
  }

  /** przesunięcie układu współrzędnych (wejście do sąsiedniej komórki) – ścieżka zostaje zachowana */
  shift(du: number, dv: number) {
    this.u += du;
    this.v += dv;
    this.path = this.path.map(([u, v]) => [u + du, v + dv]);
    for (const p of this.trail) { p[0] += du; p[1] += dv; }
  }

  update(grid: WorldGrid, t: number, at: number, dt: number, speed: number) {
    this.moving = false;
    if (this.path.length) {
      const [tu, tv] = this.path[0];
      const du = tu - this.u, dv = tv - this.v, dist = Math.hypot(du, dv);
      const sp = HERO_SPEED * speed * dt;
      if (dist <= sp) { this.u = tu; this.v = tv; this.path.shift(); }
      else { this.u += (du / dist) * sp; this.v += (dv / dist) * sp; }
      const sdx = du - dv, sdy = (du + dv) / 2;
      if (Math.hypot(sdx, sdy) > 0.2) {
        const oct = ((Math.round(Math.atan2(sdy, sdx) / (Math.PI / 4)) % 8) + 8) % 8;
        this.dir = OCT_DIR[oct];
        this.flip = oct >= 3 && oct <= 5;
      }
      this.moving = true;
      this.trail.push([this.u, this.v]);
      if (this.trail.length > TRAIL_MAX) this.trail.shift();
    }
    const fi = this.moving ? `walk${Math.floor(at * 11 * speed ** 0.5) % 4}` : `idle${Math.floor(at * 1.6) % 2}`;
    this.frameName = `hero_${this.dir}_${fi}`;
    this.atlas.setFrame(this.a.s, this.frameName);
    this.a.s.scale.x = this.flip ? -1 : 1;
    const [x, y] = grid.toScreen(this.u, this.v);
    this.sx = Math.round(x);
    this.sy = Math.round(y);
    this.a.c.position.set(this.sx, this.sy);
    this.a.c.zIndex = actorZ(this.u, this.v);
    this.headMark.position.set(0, -49 + Math.round(Math.sin(t * 4)));
  }
}

export class Dog {
  u: number;
  v: number;
  private readonly a: Actor;

  constructor(private readonly atlas: Atlas, layer: Container, start: [number, number]) {
    [this.u, this.v] = start;
    this.a = makeActor(atlas, layer, 0.7);
  }

  get view(): Container { return this.a.c; }

  teleport(to: [number, number]) { [this.u, this.v] = to; }

  shift(du: number, dv: number) { this.u += du; this.v += dv; }

  update(grid: WorldGrid, trail: [number, number][], at: number, dt: number, speed: number) {
    let frame = 'dog0';
    if (trail.length > DOG_LAG) {
      const [gu, gv] = trail[trail.length - DOG_LAG];
      const du = gu - this.u, dv = gv - this.v, d = Math.hypot(du, dv);
      if (d > 1) {
        const sp = Math.min(d, DOG_SPEED * speed * dt);
        this.u += (du / d) * sp;
        this.v += (dv / d) * sp;
        this.a.s.scale.x = du - dv > 0 ? -1 : 1;
        frame = `dog${Math.floor(at * 10) % 2}`;
      }
    }
    this.atlas.setFrame(this.a.s, frame);
    const [x, y] = grid.toScreen(this.u, this.v);
    this.a.c.position.set(Math.round(x), Math.round(y));
    this.a.c.zIndex = actorZ(this.u, this.v);
  }
}

/** NPC stojący w miejscu (np. kupiec za ladą): oddech 2 klatki, zwrócony w stronę SE. */
export class Npc {
  frameName = 'npc_SE_idle0';
  private readonly a: Actor;

  /** h – wysokość podłogi (NPC może stać poza siatką chodzenia, np. za ladą) */
  constructor(private readonly atlas: Atlas, layer: Container, public u: number, public v: number, private readonly h: number) {
    this.a = makeActor(atlas, layer, 1);
  }

  get view(): Container { return this.a.c; }
  get body(): Sprite { return this.a.s; }

  update(grid: WorldGrid, at: number) {
    this.frameName = `npc_SE_idle${Math.floor(at * 1.4) % 2}`;
    this.atlas.setFrame(this.a.s, this.frameName);
    const [x, y] = grid.toScreenAt(this.u, this.v, this.h);
    this.a.c.position.set(Math.round(x), Math.round(y));
    this.a.c.zIndex = actorZ(this.u, this.v);
  }

  destroy() { this.a.c.destroy({ children: true }); }
}
