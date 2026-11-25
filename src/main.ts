// Earthlings – punkt wejścia: wczytanie danych, złożenie świata, pętla gry.
import { Application, Container, TextureStyle } from 'pixi.js';
import { loadAssets } from './assets';
import { Camera } from './camera';
import { Dog, Hero } from './entities/actors';
import { PointerInput } from './input';
import { Atlas } from './render/atlas';
import { createClouds } from './render/clouds';
import { Effects } from './render/effects';
import { createWater } from './render/water';
import type { GameBridge } from './types';
import { createHud } from './ui/hud';
import { WorldGrid } from './world/grid';
import { createTerrain } from './world/terrain';
import './style.css';

declare global {
  interface Window {
    /** gotowość gry – używane przez testy w przeglądarce */
    __ready?: boolean;
  }
}

async function main() {
  TextureStyle.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({ resizeTo: window, background: '#0b1a12', roundPixels: true, antialias: false });
  document.body.appendChild(app.canvas);

  const assets = await loadAssets();
  const M = assets.meta;
  const atlas = new Atlas(assets.img.sprites, M.frames);
  const grid = new WorldGrid(M, assets.img.walk, assets.img.pick);

  const world = new Container();
  app.stage.addChild(world);
  const water = createWater(M, assets.img.water_a, assets.img.water_b);
  world.addChild(water.sprite);
  const terrain = createTerrain(M, assets.img.bands, atlas);
  world.addChild(terrain.layer);
  const hero = new Hero(atlas, terrain.layer, M.hero);
  const dog = new Dog(atlas, terrain.layer, M.dog);
  const effects = new Effects(terrain.layer);
  const clouds = createClouds(M.W, M.H, M.BAYER);
  world.addChild(clouds.sprite);

  const bridge: GameBridge = {
    speed: 1,
    teleport() { hero.teleport(M.hero); dog.teleport(M.dog); },
    ring(color) { effects.ring(color); },
  };
  const hud = createHud(assets, bridge);

  const camera = new Camera(M.W, M.H);
  {
    const [x, y] = grid.toScreen(hero.u, hero.v);
    camera.snap(x, y - 16);
  }

  const input = new PointerInput(app, (gx, gy, showMark) => {
    const wx = Math.floor((gx - world.x) / camera.zoom), wy = Math.floor((gy - world.y) / camera.zoom);
    const target = grid.pickAt(wx, wy);
    if (!target) return;
    const path = grid.pathTo(hero.u, hero.v, target[0], target[1]);
    if (!path) return;
    hero.path = path;
    if (showMark && path.length) effects.mark(...grid.toScreen(...path[path.length - 1]));
  });

  let t = 0, at = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(tk.deltaMS / 1000, 0.1);
    t += dt;
    at += dt;
    water.update(t, dt);
    clouds.update(t);
    terrain.update(t);
    input.update(dt);
    hero.update(grid, t, at, dt, bridge.speed);
    dog.update(grid, hero.trail, at, dt, bridge.speed);
    effects.update(dt, hero.sx, hero.sy);
    camera.update(world, app.screen, hero.sx, hero.sy + 4, dt);
    hud.update(world.x + hero.sx * camera.zoom, world.y + (hero.sy - 52) * camera.zoom, camera.zoom, dt);
  });
  window.__ready = true;
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">Błąd uruchomienia gry:\n${String(err)}</pre>`);
});
