// Bohater (ruch po ścieżce, 8 kierunków z odbiciem lustrzanym) i pies idący jego śladem.
import { Container, Graphics, Sprite, type Text } from 'pixi.js';
import type { Atlas } from '../render/atlas';
import { CharSheet, type FrameSource } from '../chars/sheet';
import { nameLabel } from '../ui/worldlabel';
import { depthOf, screenDir } from '../world/view';
import type { WorldGrid } from '../world/grid';

const HERO_SPEED = 96;   // jednostek świata na sekundę (+15%, +25%, potem ×1,3)
const DOG_SPEED = 112;
/** droga (jednostki świata) na jedną klatkę chodu – kroki zsynchronizowane z ruchem, bez ślizgania stóp */
const WALK_STRIDE = 9;
const TRAIL_MAX = 120;
const DOG_LAG = 18;      // ile próbek śladu pies zostaje w tyle

// oktant 0=E,1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE → klatki atlasu (W/SW/NW to odbicia)
const OCT_DIR = ['E', 'SE', 'S', 'SE', 'E', 'NE', 'N', 'NE'] as const;
/** oktant → kierunek w arkuszu 8-kierunkowym (paper doll) */
const DIR8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;

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
const actorZ = (u: number, v: number) => Math.round(depthOf(u, v)) * 10 + 6;

export class Hero {
  u: number;
  v: number;
  path: [number, number][] = [];
  dir: string = 'NE';
  flip = false;
  moving = false;
  /** pozycja na obrazie świata (piksele, zaokrąglone) */
  sx = 0;
  sy = 0;
  readonly trail: [number, number][] = [];
  private readonly a: Actor;
  private readonly headMark: Graphics;

  /** atlas – cień (wspólny atlas świata), sheet – klatki tej postaci */
  constructor(atlas: Atlas, layer: Container, start: [number, number], public sheet: FrameSource) {
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

  /** czas od początku animacji ataku (s), <0 = brak */
  attackT = -1;
  dead = false;
  /** siedzi (odpoczynek) – nie chodzi */
  sitting = false;

  /** obrót w stronę punktu (u, v) */
  faceTo(u: number, v: number) {
    const du = u - this.u, dv = v - this.v, [sdx, sdy] = screenDir(du, dv);
    if (Math.hypot(sdx, sdy) < 0.2) return;
    this.faceScreen(sdx, sdy);
  }

  /** arkusz z 8 kierunkami (postać paper doll) – bez odbić lustrzanych, tarcza zawsze w lewej ręce */
  private get eightDir() { return 'eightDir' in this.sheet; }

  private faceScreen(sdx: number, sdy: number) {
    const oct = ((Math.round(Math.atan2(sdy, sdx) / (Math.PI / 4)) % 8) + 8) % 8;
    if (this.eightDir) { this.dir = DIR8[oct]; this.flip = false; return; }
    this.dir = OCT_DIR[oct];
    this.flip = oct >= 3 && oct <= 5;
  }

  /** przebyta droga (do klatek chodu) */
  private walkDist = 0;

  attack() { this.attackT = 0; this.path = []; }

  /** czas żółtej poświaty broni (umiejętność) */
  glowT = 0;
  glow() { this.glowT = 0.45; }

  update(grid: WorldGrid, t: number, at: number, dt: number, speed: number) {
    this.moving = false;
    if (this.attackT >= 0) { this.attackT += dt; if (this.attackT > 0.35) this.attackT = -1; }
    this.glowT = Math.max(0, this.glowT - dt);
    if (this.dead || this.sitting) this.path = [];
    if (this.path.length && this.attackT < 0) {
      const [tu, tv] = this.path[0];
      const du = tu - this.u, dv = tv - this.v, dist = Math.hypot(du, dv);
      const sp = HERO_SPEED * speed * dt;
      this.walkDist += Math.min(sp, dist);
      if (dist <= sp) { this.u = tu; this.v = tv; this.path.shift(); }
      else { this.u += (du / dist) * sp; this.v += (dv / dist) * sp; }
      const [sdx, sdy] = screenDir(du, dv);
      if (Math.hypot(sdx, sdy) > 0.2) this.faceScreen(sdx, sdy);
      this.moving = true;
      this.trail.push([this.u, this.v]);
      if (this.trail.length > TRAIL_MAX) this.trail.shift();
    }
    const e8 = this.eightDir;
    const g = this.glowT > 0 ? 'atkg' : 'atk';
    // atak: 2 klatki; umiejętność (poświata) w postaci paper doll – mocne uderzenie, 4 klatki
    const k4 = Math.min(3, Math.floor((this.attackT / 0.35) * 4));
    // z łukiem (arkusz ma klatki strzału) atak i umiejętności to strzał: 4 klatki
    const atkF = e8 && 'has' in this.sheet && (this.sheet as { has(n: string): boolean }).has(`hero_${this.dir}_shoot0`) ? `shoot${k4}` : e8 && this.glowT > 0 ? `pow${k4}` : this.attackT < 0.14 ? `${e8 ? 'atk' : g}0` : `${e8 ? 'atk' : g}1`;
    const fi = this.attackT >= 0 ? atkF
      : this.moving ? `walk${Math.floor(this.walkDist / WALK_STRIDE) % 4}` : `idle${Math.floor(at * 1.6) % 2}`;
    this.frameName = this.dead ? (e8 ? `hero_${this.dir}_dead` : 'hero_dead') : this.sitting ? `hero_${this.dir}_sit${Math.floor(at * 1.2) % 2}` : `hero_${this.dir}_${fi}`;
    this.sheet.setFrame(this.a.s, this.frameName);
    this.a.s.scale.x = this.flip && !this.dead ? -1 : 1;
    this.headMark.visible = !this.dead;
    // pozycja bez zaokrąglania do pikseli świata: przy zoomie ×3 krok co 1 piksel świata to skok o 3 px ekranu
    // (postać „przeskakuje”); roundPixels i tak przyciąga do pikseli ekranu
    const [x, y] = grid.toScreen(this.u, this.v, true);
    this.sx = x;
    this.sy = y;
    this.a.c.position.set(this.sx, this.sy);
    this.a.c.zIndex = actorZ(this.u, this.v);
    this.headMark.position.set(0, -74 + Math.round(Math.sin(t * 4)));
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
    const [x, y] = grid.toScreen(this.u, this.v, true);
    this.a.c.position.set(x, y);
    this.a.c.zIndex = actorZ(this.u, this.v);
  }
}

/** NPC stojący w miejscu (np. kupiec za ladą): oddech 2 klatki, zwrócony w stronę SE; wygląd z generatora postaci. */
export class Npc {
  frameName = '';
  private readonly a: Actor;
  readonly sheet: CharSheet;
  readonly label: Text;

  /** h – wysokość podłogi (NPC może stać poza siatką chodzenia, np. za ladą); role – kupiec albo karczmarz */
  constructor(atlas: Atlas, layer: Container, public u: number, public v: number, private readonly h: number,
    readonly role: 'shop' | 'inn' = 'shop', readonly name = 'Kupiec Bronek') {
    const none = { weapon: 0, shield: 0, armor: 0, helm: 0, boots: 0, gloves: 0 };
    this.sheet = new CharSheet(role === 'inn'
      ? { race: 'human', cls: 'warrior', hair: 'bald', build: 'stocky', beard: 'long', gear: none }
      : { race: 'human', cls: 'warrior', hair: 'brown', build: 'stocky', beard: 'mustache', gear: none });
    this.a = makeActor(atlas, layer, 1);
    this.label = nameLabel(name);
    this.a.c.addChild(this.label);
  }

  get view(): Container { return this.a.c; }
  get body(): Sprite { return this.a.s; }

  update(grid: WorldGrid, at: number) {
    const name = `hero_SE_idle${Math.floor(at * 1.4) % 2}`;
    if (name !== this.frameName) { this.frameName = name; this.sheet.setFrame(this.a.s, name); }
    const [x, y] = grid.toScreenAt(this.u, this.v, this.h);
    this.a.c.position.set(Math.round(x), Math.round(y));
    this.a.c.zIndex = actorZ(this.u, this.v);
  }

  destroy() { this.a.c.destroy({ children: true }); }
}
