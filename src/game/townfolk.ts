// Mieszkańcy miasta (NPC): stoją przy straganach / fontannie, odwracają się do gracza, po kliknięciu mówią.
import { Container, Sprite, Text } from 'pixi.js';
import { CharSheet } from '../chars/sheet';
import type { Vec } from '../logic/combat';
import type { Atlas } from '../render/atlas';
import type { World } from '../world/world';

const OCT_DIR = ['E', 'SE', 'S', 'SE', 'E', 'NE', 'N', 'NE'] as const;
const FLOOR = 48;

export interface FolkDef { cx: number; cy: number; u: number; v: number; name: string; kind: 'woman' | 'elder'; lines: string[]; face: [number, number] }
interface Folk { def: FolkDef; pos: Vec; face: Vec; c: Container; s: Sprite; sheet: CharSheet; frame: string; line: number }

export class Townfolk {
  readonly folk: Folk[] = [];
  private t = 0;

  constructor(private readonly world: World, atlas: Atlas, layer: Container, defs: FolkDef[]) {
    const C = world.size;
    for (const def of defs) {
      const sheet = new CharSheet({
        race: 'human', cls: 'warrior', hair: def.kind === 'elder' ? 'white' : 'brown', build: 'thin',
        beard: def.kind === 'elder' ? 'long' : 'none', kind: def.kind,
      });
      const c = new Container();
      const sh = atlas.sprite('shadow');
      const s = new Sprite();
      const label = new Text({ text: def.name, style: { fontFamily: 'Jersey', fontSize: 8, fill: 0x8af59a, stroke: { color: 0x0a0706, width: 2 } } });
      label.resolution = 4;
      label.anchor.set(0.5, 1);
      label.position.set(0, -70);
      c.addChild(sh, s, label);
      layer.addChild(c);
      this.folk.push({ def, pos: [def.cx * C + def.u, def.cy * C + def.v], face: [...def.face] as Vec, c, s, sheet, frame: '', line: 0 });
    }
  }

  /** p – pozycja gracza (globalnie): mieszkańcy w pobliżu patrzą na niego */
  update(dt: number, p: Vec) {
    this.t += dt;
    const C = this.world.size;
    for (const f of this.folk) {
      const on = !this.world.inInterior && this.world.isLoaded(Math.floor(f.pos[0] / C), Math.floor(f.pos[1] / C));
      f.c.visible = on;
      if (!on) continue;
      const dx = p[0] - f.pos[0], dy = p[1] - f.pos[1];
      f.face = Math.hypot(dx, dy) < 90 ? [dx, dy] : [...f.def.face] as Vec;
      const [x, y] = this.world.toScreenGlobalH(f.pos[0], f.pos[1], FLOOR);
      f.c.position.set(Math.round(x), Math.round(y));
      f.c.zIndex = Math.round(f.pos[0] - this.world.cx * C + f.pos[1] - this.world.cy * C) * 10 + 6;
      const sdx = f.face[0] - f.face[1], sdy = (f.face[0] + f.face[1]) / 2;
      const oct = ((Math.round(Math.atan2(sdy, sdx) / (Math.PI / 4)) % 8) + 8) % 8;
      const name = `hero_${OCT_DIR[oct]}_idle${Math.floor(this.t * 1.3 + f.pos[0] * 0.01) % 2}`;
      if (name !== f.frame) { f.sheet.setFrame(f.s, name); f.frame = name; }
      f.s.scale.x = oct >= 3 && oct <= 5 ? -1 : 1;
    }
  }

  /** mieszkaniec pod punktem widoku (do kliknięcia) */
  at(wx: number, wy: number): Folk | null {
    for (const f of this.folk) {
      if (!f.c.visible) continue;
      if (Math.abs(wx - f.c.x) <= 18 && wy <= f.c.y + 2 && wy >= f.c.y - 68) return f;
    }
    return null;
  }

  /** kolejna kwestia mieszkańca */
  speak(f: Folk): string { return f.def.lines[f.line++ % f.def.lines.length]; }
}
