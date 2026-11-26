// Earthlings – punkt wejścia: wczytanie danych, świat 3×3 (bieżąca komórka), pętla gry.
import { Application, Container, TextureStyle } from 'pixi.js';
import { loadAssets, type Assets } from './assets';
import { CharSheet } from './chars/sheet';
import { EXP_TO_NEXT, addAttrs, baseAttributes, derived } from './logic/character';
import { SaveStore, type SavedChar } from './logic/save';
import { createMenu, lookOf, portraitOf, titleOf, type MenuApi } from './ui/menu';
import { Camera } from './camera';
import { Dog, Hero, Npc } from './entities/actors';
import { PointerInput } from './input';
import { cellStep } from './logic/cells';
import { Atlas } from './render/atlas';
import { createClouds } from './render/clouds';
import { Effects } from './render/effects';
import { Portal } from './render/portal';
import { Sky } from './render/sky';
import { Xray } from './render/xray';
import type { GameBridge } from './types';
import { createHud } from './ui/hud';
import { createMinimap } from './ui/minimap';
import { Floaters } from './ui/floaters';
import { MobManager } from './game/mobs';
import { PlayerCombat } from './game/combat';
import { deathPenalty, dist, type MobEvent } from './logic/combat';
import { World } from './world/world';
import './style.css';

declare global {
  interface Window {
    /** gotowość gry i stan do testów w przeglądarce */
    __ready?: boolean;
    __menu?: MenuApi;
    __game?: {
      cell(): { cx: number; cy: number; name: string }; hero(): { u: number; v: number }; goTo(u: number, v: number): boolean;
      place(u: number, v: number): void; warp(cx: number, cy: number, u: number, v: number): Promise<void>; busy(): boolean;
      outlines(): number; shop(): { u: number; v: number };
      mobs(): { id: number; kind: string; hp: number; state: string; u: number; v: number }[]; attack(id: number): void; skill(i: number): void; hurt(n: number): void; peace(on: boolean): void;
      player(): { hp: number; hpMax: number; mana: number; level: number; exp: number; kills: number; dead: boolean; arrows: number; gold: number };
    };
  }
}

const FADE = 0.25;   // s – wygaszenie przy przejściu między komórkami
const DOG_OFFSET: [number, number] = [-22, 6];

const AUTOSAVE = 10;  // s

async function main() {
  TextureStyle.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({ resizeTo: window, background: '#06081a', roundPixels: true, antialias: false });
  document.body.appendChild(app.canvas);

  // menu na tle nieba; dane świata wczytują się w tle
  const sky = new Sky();
  app.stage.addChild(sky.view);
  let tm = 0;
  const menuTick = (tk: { deltaMS: number }) => {
    tm += tk.deltaMS / 1000;
    sky.resize(app.screen.width, app.screen.height);
    sky.update(tm, tm * 18, tm * 5, 3);
  };
  app.ticker.add(menuTick);
  const assetsP = loadAssets();
  assetsP.catch(() => undefined);
  const store = new SaveStore();
  document.body.classList.add('in-menu');
  const loading = document.createElement('div');
  loading.className = 'menu-loading';
  loading.textContent = 'Wczytywanie świata…';
  let started = false;
  const menu = createMenu(store, (c) => {
    if (started) return;
    started = true;
    menu.hide();
    document.body.append(loading);
    void (async () => {
      try {
        const assets = await assetsP;
        app.ticker.remove(menuTick);
        await runGame(app, assets, sky, c, store);
        document.body.classList.remove('in-menu');
      } catch (err) {
        console.error(err);
        document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">Błąd uruchomienia gry:\n${String(err)}</pre>`);
      } finally {
        loading.remove();
      }
    })();
  });
  window.__menu = menu;
  menu.show();
}

async function runGame(app: Application, assets: Assets, sky: Sky, char: SavedChar, store: SaveStore) {
  const info = assets.world;
  const atlas = new Atlas(assets.sprites, info.frames);
  const world = new World(info, atlas);

  const stage = new Container();     // świat w pikselach obrazu bieżącej komórki (skalowany kamerą)
  app.stage.addChild(stage);
  stage.addChild(world.view);
  const clouds = createClouds(16, 16, info.BAYER);
  stage.addChild(clouds.sprite);
  let cloudOx = 0, cloudOy = 0;

  const start = info.start;
  const pos = char.pos ?? start;
  await world.center(pos.cx, pos.cy);
  const sheet = new CharSheet(lookOf(char));
  const hero = new Hero(atlas, world.layer, [pos.u, pos.v], sheet);
  const dog = new Dog(atlas, world.layer, [pos.u + DOG_OFFSET[0], pos.v + DOG_OFFSET[1]]);
  const effects = new Effects(world.layer);

  // kontury zasłoniętych postaci (nad światem, pod chmurami nie – widoczne zawsze)
  const xray = new Xray(app.renderer, world);
  stage.addChild(xray.overlay);
  xray.add({ view: hero.view, body: hero.body, frame: () => hero.frameName, kind: 'hero', source: sheet });

  // portale: przed drzwiami sklepu (miasto) i wyjście ze sklepu (wnętrze)
  const shopInfo = info.interiors?.shop;
  const shopCell = world.interiorCell('shop');
  const townPortal = new Portal(info.shop.u, info.shop.v);
  const exitPortal = shopInfo ? new Portal(shopInfo.exit[0], shopInfo.exit[1]) : null;
  let npc: Npc | null = null;

  const bridge: GameBridge = {
    speed: 1,
    teleport() {
      // zwój powrotu: do punktu startu w mieście
      void jump(start.cx, start.cy, [start.u, start.v]);
    },
    ring(color) { effects.ring(color); },
    useSlot(i) { combat?.useSlot(i); },
  };
  const hud = createHud(assets, bridge);
  const portrait = portraitOf(char);
  const attrs = addAttrs(baseAttributes(char.race, char.cls), char.alloc);
  const dv = derived(attrs);
  const showChar = () => hud.setCharacter({
    name: char.name, title: titleOf(char), level: combat ? combat.progress.level : char.level, hpMax: dv.hp, mpMax: dv.mana,
    exp: combat ? combat.progress.exp : char.exp, expMax: combat ? combat.expMax() : EXP_TO_NEXT[char.level] || 1,
    gold: combat ? combat.gold : char.gold, portrait,
  });
  let combat: PlayerCombat | null = null;
  showChar();

  // walka: potwory, liczby obrażeń, gracz
  const mobs = new MobManager(world, atlas);
  const floaters = new Floaters(document.querySelector<HTMLElement>('#hud')!);
  combat = new PlayerCombat(char, {
    world, hero, mobs, hud, floaters, effects, layer: world.layer, icons: assets.icons,
    moveTo: (u, v) => goToWorld(u, v, false),
    onDeath: () => {
      const lost = deathPenalty(combat!.gold);
      combat!.gold -= lost;
      hud.setGold(combat!.gold);
      void jump(start.cx, start.cy, [start.u, start.v]).then(() => {
        combat!.revive();
        hud.say(lost ? `Odradzasz się w mieście. Tracisz ${lost} złota.` : 'Odradzasz się w mieście.');
      });
    },
    onLevelUp: () => { showChar(); savePos(); },
  });
  const mobEvents: MobEvent[] = [];
  let peaceful = false;   // tylko do testów: potwory nie widzą gracza
  const mobXray = new Map<number, Parameters<Xray['add']>[0]>();

  // autozapis postaci (we wnętrzu – miejsce przed sklepem)
  const savePos = () => {
    const p = world.inInterior ? { cx: info.shop.cx, cy: info.shop.cy, u: info.shop.u + 22, v: info.shop.v + 6 } : { cx: world.cx, cy: world.cy, u: hero.u, v: hero.v };
    const c = combat!;
    store.upsert({ ...char, pos: p, played: Date.now(), level: c.progress.level, exp: c.progress.exp, points: c.progress.points, gold: c.gold, arrows: c.arrows });
  };
  addEventListener('beforeunload', savePos);
  addEventListener('pagehide', savePos);
  let saveT = 0;
  const minimap = createMinimap(document.querySelector<HTMLElement>('#hud')!, info);

  const camera = new Camera();
  const fade = document.createElement('div');
  fade.className = 'fade';
  document.body.appendChild(fade);

  function fitClouds() {
    const M = world.meta;
    clouds.resize(M.W * 3, M.H * 3);
    clouds.sprite.position.set(-M.W, -M.H);
  }
  function snapCamera() {
    const [x, y] = world.grid.toScreen(hero.u, hero.v);
    camera.snap(x, y + 4);
  }
  fitClouds();
  snapCamera();
  hud.zone(world.name);

  let busy = false;
  let npcTarget: Parameters<Xray['add']>[0] | null = null;
  const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

  /** płynne przejście do sąsiedniej komórki: przestawienie środka i układu współrzędnych */
  async function cross(dx: number, dy: number) {
    const nx = world.cx + dx, ny = world.cy + dy;
    busy = true;
    const slow = !world.isLoaded(nx, ny);          // sąsiad jeszcze się wczytuje → krótkie wygaszenie
    if (slow) fade.style.opacity = '1';
    try {
      await world.center(nx, ny);
      const C = world.size;
      hero.shift(-dx * C, -dy * C);
      dog.shift(-dx * C, -dy * C);
      const [sx, sy] = World.screenShift(dx, dy, C);
      camera.shift(-sx, -sy);
      floaters.shift(-sx, -sy);
      cloudOx += sx; cloudOy += sy;
      effects.clearMark();
      hud.zone(world.name);
    } catch (err) {
      console.error(err);
    } finally {
      fade.style.opacity = '0';
      busy = false;
    }
  }

  /** skok (np. zwój powrotu): wygaszenie, wczytanie, ustawienie postaci */
  async function jump(cx: number, cy: number, pos: [number, number]) {
    if (busy) return;
    busy = true;
    fade.style.opacity = '1';
    await wait(FADE);
    try {
      const moved = cx !== world.cx || cy !== world.cy;
      await world.center(cx, cy);
      if (moved) hud.zone(world.name);
      hero.teleport(pos);
      dog.teleport([pos[0] + DOG_OFFSET[0], pos[1] + DOG_OFFSET[1]]);
      effects.clearMark();
      combat?.setTarget(null);
      combat?.clearShots();
      fitClouds();
      clouds.sprite.visible = !world.inInterior;
      // kupiec tylko we wnętrzu sklepu
      if (npc) { xray.remove(npcTarget!); npc.destroy(); npc = null; npcTarget = null; }
      if (world.inInterior && shopInfo) {
        const n = new Npc(atlas, world.layer, shopInfo.npc[0], shopInfo.npc[1], shopInfo.floor ?? 48);
        npc = n;
        npcTarget = { view: n.view, body: n.body, frame: () => n.frameName, kind: 'npc', source: atlas };
        xray.add(npcTarget);
      }
      townPortal.armed = exitPortal!.armed = false;
      snapCamera();
    } catch (err) {
      console.error(err);
    } finally {
      fade.style.opacity = '0';
      busy = false;
    }
  }

  function goToWorld(u: number, v: number, showMark: boolean): boolean {
    const path = world.grid.pathTo(hero.u, hero.v, u, v);
    if (!path) return false;
    hero.path = path;
    if (showMark && path.length) effects.mark(...world.grid.toScreen(...path[path.length - 1]));
    return true;
  }

  const input = new PointerInput(app, (gx, gy, showMark) => {
    if (busy || combat!.dead) return;
    const wx = Math.floor((gx - stage.x) / camera.zoom), wy = Math.floor((gy - stage.y) / camera.zoom);
    const m = mobs.at(wx, wy);
    if (m) { combat!.setTarget(m); return; }
    if (!showMark && combat!.target != null) return;      // przytrzymanie po kliknięciu w potwora – zostaje cel
    const target = world.grid.pickAt(wx, wy);
    if (target) { combat!.setTarget(null); goToWorld(target[0], target[1], showMark); }
  });
  // kursor nad potworem
  app.stage.on('globalpointermove', (e) => {
    const wx = Math.floor((e.global.x - stage.x) / camera.zoom), wy = Math.floor((e.global.y - stage.y) / camera.zoom);
    app.stage.cursor = mobs.at(wx, wy) ? 'crosshair' : 'pointer';
  });

  window.__game = {
    cell: () => ({ cx: world.cx, cy: world.cy, name: world.name }),
    hero: () => ({ u: hero.u, v: hero.v }),
    goTo: (u, v) => goToWorld(u, v, true),
    place: (u, v) => { hero.teleport([u, v]); dog.teleport([u + DOG_OFFSET[0], v + DOG_OFFSET[1]]); snapCamera(); },
    warp: (cx, cy, u, v) => jump(cx, cy, [u, v]),
    busy: () => busy,
    outlines: () => xray.visibleCount(),
    shop: () => ({ u: info.shop.u, v: info.shop.v }),
    mobs: () => mobs.alive().map((m) => ({ id: m.id, kind: m.kind, hp: m.hp, state: m.state, u: m.pos[0] - world.cx * world.size, v: m.pos[1] - world.cy * world.size })),
    attack: (id) => { const m = mobs.mobs.get(id); if (m) combat!.setTarget(m); },
    player: () => ({ hp: combat!.hp, hpMax: combat!.hpMax, mana: combat!.mana, level: combat!.progress.level, exp: combat!.progress.exp, kills: combat!.kills, dead: combat!.dead, arrows: combat!.arrows, gold: combat!.gold }),
    skill: (i) => combat!.useSlot(i),
    hurt: (n) => combat!.takeDamage(n),
    peace: (on) => { peaceful = on; },
  };

  let t = 0, at = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(tk.deltaMS / 1000, 0.1);
    t += dt;
    at += dt;
    world.update(t, dt);
    saveT += dt;
    if (saveT > AUTOSAVE && !busy) { saveT = 0; savePos(); }
    clouds.update(t, cloudOx, cloudOy);
    input.update(dt);
    if (!busy) {
      const grid = world.grid;
      const C = world.size;
      const ppos: [number, number] = [world.cx * C + hero.u, world.cy * C + hero.v];
      mobEvents.length = 0;
      mobs.update(dt, { pos: ppos, alive: !combat.dead && !world.inInterior && !peaceful }, mobEvents);
      for (const e of mobEvents) combat.onMobEvent(e);
      combat.update(dt);
      hero.update(grid, t, at, dt, bridge.speed);
      dog.update(grid, hero.trail, at, dt, bridge.speed);
      const step = world.inInterior ? null : cellStep(world.cx, world.cy, hero.u, hero.v, world.size, world.gridSize);
      if (step) void cross(step.dx, step.dy);
    }
    // portale
    const inTown = world.cx === info.shop.cx && world.cy === info.shop.cy;
    townPortal.view.visible = inTown;
    if (inTown) {
      if (townPortal.view.parent !== world.layer) world.layer.addChild(townPortal.view);
      townPortal.update(t, ...world.grid.toScreen(townPortal.u, townPortal.v), townPortal.u + townPortal.v);
      if (!busy && shopCell && shopInfo && townPortal.check(hero.u, hero.v)) void jump(shopCell.cx, shopCell.cy, shopInfo.spawn);
    }
    if (exitPortal) {
      exitPortal.view.visible = world.inInterior;
      if (world.inInterior) {
        if (exitPortal.view.parent !== world.layer) world.layer.addChild(exitPortal.view);
        exitPortal.update(t, ...world.grid.toScreen(exitPortal.u, exitPortal.v), exitPortal.u + exitPortal.v);
        if (!busy && exitPortal.check(hero.u, hero.v)) void jump(info.shop.cx, info.shop.cy, [info.shop.u + 22, info.shop.v + 6]);
      }
    }
    if (npc && world.inInterior) npc.update(world.grid, at);
    mobs.render(world.layer);
    // kontury potworów w pobliżu (czerwone)
    {
      const C = world.size, hp: [number, number] = [world.cx * C + hero.u, world.cy * C + hero.v];
      const near = new Set(mobs.alive().filter((m) => dist(m.pos, hp) < 360).map((m) => m.id));
      for (const [id, tg] of mobXray) if (!near.has(id) || !mobs.view(id)) { xray.remove(tg); mobXray.delete(id); }
      for (const id of near) {
        if (mobXray.has(id)) continue;
        const v = mobs.view(id), m = mobs.mobs.get(id);
        if (!v || !m) continue;
        const tg = { view: v.c, body: v.s, frame: () => v.frame, kind: 'mob' as const, source: mobs.sheet(m.kind) };
        mobXray.set(id, tg);
        xray.add(tg);
      }
    }
    xray.update();
    combat.syncHud();
    floaters.update(stage.x, stage.y, camera.zoom, dt);
    effects.update(dt, hero.sx, hero.sy);
    camera.update(stage, app.screen, hero.sx, hero.sy + 4, dt);
    sky.resize(app.screen.width, app.screen.height);
    sky.update(t, stage.x, stage.y, camera.zoom);
    minimap.set(world.cx, world.cy, hero.u / world.size, hero.v / world.size, world.name);
    minimap.update(dt);
    hud.update(stage.x + hero.sx * camera.zoom, stage.y + (hero.sy - 52) * camera.zoom, camera.zoom, dt);
  });
  window.__ready = true;
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">Błąd uruchomienia gry:\n${String(err)}</pre>`);
});
