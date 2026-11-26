// Earthlings – punkt wejścia: wczytanie danych, świat 3×3 (bieżąca komórka), pętla gry.
import { Application, Container, TextureStyle } from 'pixi.js';
import { loadAssets } from './assets';
import { Camera } from './camera';
import { Dog, Hero, Npc } from './entities/actors';
import { PointerInput } from './input';
import { cellStep } from './logic/cells';
import { Atlas } from './render/atlas';
import { createClouds } from './render/clouds';
import { Effects } from './render/effects';
import { Portal } from './render/portal';
import { Xray } from './render/xray';
import type { GameBridge } from './types';
import { createHud } from './ui/hud';
import { createMinimap } from './ui/minimap';
import { World } from './world/world';
import './style.css';

declare global {
  interface Window {
    /** gotowość gry i stan do testów w przeglądarce */
    __ready?: boolean;
    __game?: { cell(): { cx: number; cy: number; name: string }; hero(): { u: number; v: number }; goTo(u: number, v: number): boolean; place(u: number, v: number): void; warp(cx: number, cy: number, u: number, v: number): Promise<void>; busy(): boolean; outlines(): number; shop(): { u: number; v: number } };
  }
}

const FADE = 0.25;   // s – wygaszenie przy przejściu między komórkami
const DOG_OFFSET: [number, number] = [-22, 6];

async function main() {
  TextureStyle.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({ resizeTo: window, background: '#0b1a12', roundPixels: true, antialias: false });
  document.body.appendChild(app.canvas);

  const assets = await loadAssets();
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
  await world.center(start.cx, start.cy);
  const hero = new Hero(atlas, world.layer, [start.u, start.v]);
  const dog = new Dog(atlas, world.layer, [start.u + DOG_OFFSET[0], start.v + DOG_OFFSET[1]]);
  const effects = new Effects(world.layer);

  // kontury zasłoniętych postaci (nad światem, pod chmurami nie – widoczne zawsze)
  const xray = new Xray(app.renderer, world, atlas, assets.sprites);
  stage.addChild(xray.overlay);
  xray.add({ view: hero.view, body: hero.body, frame: () => hero.frameName, kind: 'hero' });

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
  };
  const hud = createHud(assets, bridge);
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
      fitClouds();
      clouds.sprite.visible = !world.inInterior;
      // kupiec tylko we wnętrzu sklepu
      if (npc) { xray.remove(npcTarget!); npc.destroy(); npc = null; npcTarget = null; }
      if (world.inInterior && shopInfo) {
        const n = new Npc(atlas, world.layer, shopInfo.npc[0], shopInfo.npc[1]);
        npc = n;
        npcTarget = { view: n.view, body: n.body, frame: () => n.frameName, kind: 'npc' };
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
    if (busy) return;
    const wx = Math.floor((gx - stage.x) / camera.zoom), wy = Math.floor((gy - stage.y) / camera.zoom);
    const target = world.grid.pickAt(wx, wy);
    if (target) goToWorld(target[0], target[1], showMark);
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
  };

  let t = 0, at = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(tk.deltaMS / 1000, 0.1);
    t += dt;
    at += dt;
    world.update(t, dt);
    clouds.update(t, cloudOx, cloudOy);
    input.update(dt);
    if (!busy) {
      const grid = world.grid;
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
    xray.update();
    effects.update(dt, hero.sx, hero.sy);
    camera.update(stage, app.screen, hero.sx, hero.sy + 4, dt);
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
