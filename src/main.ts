// Glastemia – punkt wejścia: wczytanie danych, świat 3×3 (bieżąca komórka), pętla gry.
import { Application, Container, TextureStyle } from 'pixi.js';
import { loadAssets, type Assets } from './assets';
import { CharSheet, type FrameSource } from './chars/sheet';
import { ITEMS, sanitizeInventory } from './logic/items';
import { EXP_TO_NEXT } from './logic/character';
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
import { InventoryController } from './game/inventory';
import { LootManager } from './game/loot';
import { rollLoot } from './logic/items';
import { CURSOR_GRAB, ICONS, ICONS2 } from './ui/icons';
import { ShopWindow, type ShopRow, type ShopState } from './ui/shop';
import { StashWindow, type StashState } from './ui/stash';
import { StashStore, deposit, withdraw } from './logic/stash';
import { GuardManager } from './game/guards';
import { Fountain } from './render/fountain';
import { Townfolk } from './game/townfolk';
import { LoadingScreen } from './ui/loading';
import { OFFERS, buy as shopBuy, potionSellPrice, sellBag, sellPotion, sellPrice } from './logic/shop';
import { RARITY_COLOR } from './logic/items';
import { itemIcon } from './ui/icons';
import { deathPenalty, dist, seeded, type MobEvent } from './logic/combat';
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
      mobs(): { id: number; kind: string; hp: number; state: string; u: number; v: number }[]; attack(id: number): void; skill(i: number): void; hurt(n: number): void; peace(on: boolean): void; dashReady(): boolean; talkToMerchant(): void; shopOpen(): boolean; openStash(): void; stashOpen(): boolean; moveMob(id: number, u: number, v: number): void; mobState(id: number): string; guards(): { u: number; v: number; target: number | null }[]; folk(): { name: string; u: number; v: number }[]; sitting(): boolean;
      drops(): { id: number; kind: string; item: string | null; u: number; v: number }[]; give(id: string): boolean; exp(n: number): void;
      inv(): { eq: Record<string, string | null>; bag: (string | null)[]; hpPot: number; mpPot: number; points: number; armor: number; str: number };
      player(): { hp: number; hpMax: number; mana: number; level: number; exp: number; kills: number; dead: boolean; arrows: number; gold: number };
    };
  }
}

const FADE = 0.25;   // s – wygaszenie przy przejściu między komórkami
const DOG_OFFSET: [number, number] = [-22, 6];

const AUTOSAVE = 10;  // s
let loadingScreen: LoadingScreen;

const itemName = (id: string) => ITEMS[id]?.name ?? id;
/** poziomy widocznego ekwipunku z zapisu (przed utworzeniem kontrolera) */
function invGear(c: SavedChar) {
  const inv = sanitizeInventory(c.inv, c.cls);
  const t = (s: keyof typeof inv.eq) => (inv.eq[s] ? ITEMS[inv.eq[s]!].tier : 0);
  return { weapon: t('weapon'), shield: t('shield'), armor: t('armor'), helm: t('helm'), boots: t('boots'), gloves: inv.eq.gloves ? 1 : 0 };
}

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
  loadingScreen = new LoadingScreen();
  let started = false;
  const menu = createMenu(store, (c) => {
    if (started) return;
    started = true;
    menu.hide();
    loadingScreen.show('Wczytywanie świata');
    void (async () => {
      try {
        const assets = await assetsP;
        app.ticker.remove(menuTick);
        await runGame(app, assets, sky, c, store);
        document.body.classList.remove('in-menu');
        await loadingScreen.hide();
        window.__ready = true;          // gra gotowa dopiero po zniknięciu ekranu wczytywania
      } catch (err) {
        console.error(err);
        document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">Błąd uruchomienia gry:\n${String(err)}</pre>`);
      } finally {
        await loadingScreen.hide();
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
  const sheet = new CharSheet({ ...lookOf(char), gear: invGear(char) });
  const hero = new Hero(atlas, world.layer, [pos.u, pos.v], sheet);
  const dog = new Dog(atlas, world.layer, [pos.u + DOG_OFFSET[0], pos.v + DOG_OFFSET[1]]);
  const effects = new Effects(world.layer);

  // kontury zasłoniętych postaci (nad światem, pod chmurami nie – widoczne zawsze)
  const xray = new Xray(app.renderer, world);
  stage.addChild(xray.overlay);
  const heroXray = { view: hero.view, body: hero.body, frame: () => hero.frameName, kind: 'hero' as const, source: sheet as FrameSource };
  xray.add(heroXray);

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
    invClick(kind, key) { invc.click(kind, key); },
    addPoint(a) { invc.addPoint(a); },
  };
  const hud = createHud(assets, bridge);
  const portrait = portraitOf(char);
  let combat: PlayerCombat | null = null;
  const invc = new InventoryController(
    { race: char.race, cls: char.cls, alloc: char.alloc, level: char.level, points: char.points ?? 0, gold: char.gold, inv: char.inv },
    assets.icons, () => (combat ? combat.progress.level : char.level),
  );
  const showChar = () => hud.setCharacter({
    name: char.name, title: titleOf(char), level: combat ? combat.progress.level : char.level, hpMax: invc.stats.hpMax, mpMax: invc.stats.manaMax,
    exp: combat ? combat.progress.exp : char.exp, expMax: combat ? combat.expMax() : EXP_TO_NEXT[char.level] || 1,
    gold: invc.gold, portrait,
  });
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
    onLevelUp: () => { showChar(); hud.setInventory(invc.view()); savePos(); },
    onKill: (m) => loot.spawn(m.pos, rollLoot(m.kind, invc.stats.luck, lootRng)),
  }, invc);
  const lootRng = seeded(Date.now() & 0xfffff);
  const loot = new LootManager(world, world.layer, (kind, item) =>
    kind === 'gold' ? ICONS2.gold : kind === 'hp' ? assets.icons.icon_hp : kind === 'mp' ? assets.icons.icon_mp : itemIcon(item!, assets.icons));
  // zmiany ekwipunku i punktów: statystyki, panel, wygląd postaci
  const gearKey = () => JSON.stringify(invc.gear());
  let lastGear = gearKey();
  invc.onChange = () => {
    combat!.clampVitals();
    bridge.speed = invc.stats.speed;
    hud.setInventory(invc.view());
    showChar();
    const g = gearKey();
    if (g !== lastGear) {
      lastGear = g;
      const old = hero.sheet as CharSheet;
      const ns = new CharSheet({ ...lookOf(char), gear: invc.gear() });
      hero.sheet = ns;
      heroXray.source = ns;
      old.destroy();
    }
  };
  invc.onMessage = (msg) => hud.float(msg, '#ffb08a');

  // sklep: okno handlu u kupca
  let shopMsg = '';
  const shopState = (): ShopState => {
    const c = combat!;
    const buy = OFFERS.map((o) => {
      const wrongCls = !!o.cls && o.cls !== char.cls;
      return {
        key: o.id, name: o.name, price: o.price, note: wrongCls ? 'Tylko dla łowcy' : o.desc,
        icon: o.arrows ? ICONS.arrows : itemIcon(o.item!, assets.icons), color: o.item ? RARITY_COLOR(ITEMS[o.item]) : undefined,
        disabled: wrongCls || invc.gold < o.price, count: o.arrows && char.cls === 'hunter' ? c.arrows : undefined,
      };
    });
    const sell: ShopRow[] = invc.inv.bag.flatMap((id, i) => (id ? [{ key: `bag:${i}`, name: ITEMS[id].name, price: sellPrice(id), icon: itemIcon(id, assets.icons), color: RARITY_COLOR(ITEMS[id]) }] : []));
    if (invc.inv.hpPot) sell.push({ key: 'pot:hp', name: 'Mikstura zdrowia', price: potionSellPrice(), icon: assets.icons.icon_hp, color: '#ff8a8a', count: invc.inv.hpPot });
    if (invc.inv.mpPot) sell.push({ key: 'pot:mp', name: 'Mikstura many', price: potionSellPrice(), icon: assets.icons.icon_mp, color: '#8ab0ff', count: invc.inv.mpPot });
    return { gold: invc.gold, buy, sell, message: shopMsg };
  };
  const trade = (fn: (w: { gold: number; arrows: number; inv: typeof invc.inv; cls: typeof char.cls }) => string | null) => {
    const w = { gold: invc.gold, arrows: combat!.arrows, inv: invc.inv, cls: char.cls };
    const err = fn(w);
    shopMsg = err ?? '';
    invc.gold = w.gold;
    combat!.arrows = w.arrows;
    invc.onChange(false);
    shop.render(shopState());
    if (!err) savePos();
  };
  const shop = new ShopWindow(document.querySelector<HTMLElement>('#hud')!,
    (key) => trade((w) => shopBuy(w, key)),
    (key) => trade((w) => {
      const [k, v] = key.split(':');
      const got = k === 'bag' ? sellBag(w, Number(v)) : sellPotion(w, v as 'hp' | 'mp');
      return got ? null : 'Nie ma czego sprzedać.';
    }),
    () => shop.hide());
  let wantShop = false;

  // skrzynia przy fontannie (wspólna dla postaci z tej przeglądarki)
  const stashStore = new StashStore();
  let stashMsg = '';
  const stashState = (): StashState => {
    const s = stashStore.load();
    const rowOf = (id: string, key: string) => ({ key, name: ITEMS[id].name, icon: itemIcon(id, assets.icons), color: RARITY_COLOR(ITEMS[id]) });
    return {
      bag: invc.inv.bag.flatMap((id, i) => (id ? [rowOf(id, `bag:${i}`)] : [])),
      stash: s.items.flatMap((id, i) => (id ? [rowOf(id, `stash:${i}`)] : [])),
      free: s.items.filter((x) => !x).length, message: stashMsg,
    };
  };
  const stashWin = new StashWindow(document.querySelector<HTMLElement>('#hud')!, (key) => {
    const s = stashStore.load();
    const [k, v] = key.split(':');
    const err = k === 'bag' ? deposit(s, invc.inv, Number(v)) : withdraw(s, invc.inv, Number(v));
    stashMsg = err ?? '';
    if (!err) { stashStore.save(s); invc.onChange(false); savePos(); }
    stashWin.render(stashState());
  }, () => stashWin.hide());
  let wantStash = false;
  const stashPos = info.stash ? [info.stash.cx * world.size + info.stash.u, info.stash.cy * world.size + info.stash.v] as [number, number] : null;
  const TOWN_FLOOR = 48;
  const prevChange = invc.onChange;
  invc.onChange = (g) => { prevChange(g); if (shop.open) shop.render(shopState()); };
  bridge.speed = invc.stats.speed;
  hud.setInventory(invc.view());
  const mobEvents: MobEvent[] = [];
  const guards = new GuardManager(world, atlas, world.layer, mobs, floaters, info.guards ?? []);
  for (const g of guards.guards) xray.add({ view: g.c, body: g.s, frame: () => g.frame || 'hero_S_idle0', kind: 'npc', source: guards.sheet });
  const fountain = new Fountain(world, 1.5 * world.size, 1.5 * world.size);
  const folk = new Townfolk(world, atlas, world.layer, info.folk ?? []);
  for (const f of folk.folk) xray.add({ view: f.c, body: f.s, frame: () => f.frame || 'hero_S_idle0', kind: 'npc', source: f.sheet });
  world.layer.addChild(fountain.g);
  let peaceful = false;   // tylko do testów: potwory nie widzą gracza
  const mobXray = new Map<number, Parameters<Xray['add']>[0]>();

  // autozapis postaci (we wnętrzu – miejsce przed sklepem)
  const savePos = () => {
    const p = world.inInterior ? { cx: info.shop.cx, cy: info.shop.cy, u: info.shop.u + 22, v: info.shop.v + 6 } : { cx: world.cx, cy: world.cy, u: hero.u, v: hero.v };
    const c = combat!;
    store.upsert({ ...char, pos: p, played: Date.now(), level: c.progress.level, exp: c.progress.exp, points: invc.points, alloc: invc.alloc, gold: invc.gold, arrows: c.arrows, inv: invc.inv });
  };
  addEventListener('beforeunload', savePos);
  addEventListener('pagehide', savePos);
  let saveT = 0;
  const minimap = createMinimap(document.querySelector<HTMLElement>('#hud')!, info);

  const camera = new Camera();

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
    loadingScreen.show(world.cellAt(nx, ny)?.name ?? '');
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
      await loadingScreen.hide();
      busy = false;
    }
  }

  /** skok (np. zwój powrotu): wygaszenie, wczytanie, ustawienie postaci */
  async function jump(cx: number, cy: number, pos: [number, number]) {
    if (busy) return;
    busy = true;
    loadingScreen.show(world.cellAt(cx, cy)?.name ?? '');
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
      await loadingScreen.hide();
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
    // kupiec we wnętrzu sklepu: podejdź do lady i otwórz handel
    if (npc && world.inInterior && Math.abs(wx - npc.view.x) <= 14 && wy <= npc.view.y + 2 && wy >= npc.view.y - 44 && showMark) {
      combat!.stand();
      wantShop = true;
      goToWorld(npc.u + 64, npc.v, true);
      return;
    }
    wantShop = false;
    // skrzynia przy fontannie
    if (stashPos && !world.inInterior && showMark) {
      const [sx, sy] = world.toScreenGlobalH(stashPos[0], stashPos[1], TOWN_FLOOR);
      if (Math.abs(wx - sx) <= 20 && wy <= sy + 4 && wy >= sy - 30) {
        combat!.stand();
        combat!.setTarget(null);
        wantStash = true;
        goToWorld(stashPos[0] - world.cx * world.size - 30, stashPos[1] - world.cy * world.size, true);
        return;
      }
    }
    wantStash = false;
    // mieszkańcy: kliknięcie – rozmowa (postać podchodzi, kwestia na czacie i nad głową)
    const person = showMark ? folk.at(wx, wy) : null;
    if (person) {
      combat!.setTarget(null);
      const line = folk.speak(person);
      hud.say(`<span style="color:#8af59a">${person.def.name}:</span> ${line}`);
      floaters.add(person.c.x, person.c.y - 50, line.length > 34 ? line.slice(0, 32) + '…' : line, '#f4ecd8');
      return;
    }
    const m = mobs.at(wx, wy);
    if (m) { combat!.setTarget(m); loot.wanted = null; return; }
    const drop = loot.at(wx, wy);
    if (drop && showMark) {
      combat!.setTarget(null);
      loot.wanted = drop.id;
      const C = world.size;
      goToWorld(drop.pos[0] - world.cx * C, drop.pos[1] - world.cy * C, true);
      return;
    }
    if (!showMark && combat!.target != null) return;      // przytrzymanie po kliknięciu w potwora – zostaje cel
    const target = world.grid.pickAt(wx, wy);
    if (target) { combat!.stand(); combat!.setTarget(null); goToWorld(target[0], target[1], showMark); }
  }, (gx, gy) => {
    // odskok w stronę kursora: wektor ekranowy → kierunek w układzie świata (u, v)
    if (busy) return;
    const hx = stage.x + hero.sx * camera.zoom, hy = stage.y + (hero.sy - 16) * camera.zoom;
    const dx = gx - hx, dy = gy - hy;
    const g = world.grid, h0 = g.heightAt(hero.u, hero.v);
    combat!.dodge(dy + dx / 2, dy - dx / 2, (u, v) => { const c = g.cellH(...g.cellOf(u, v)); return c > 0 && Math.abs(c - 1 - h0) <= 8; });
  });
  // kursor nad potworem
  app.stage.on('globalpointermove', (e) => {
    const wx = Math.floor((e.global.x - stage.x) / camera.zoom), wy = Math.floor((e.global.y - stage.y) / camera.zoom);
    app.stage.cursor = mobs.at(wx, wy) ? 'crosshair' : loot.at(wx, wy) ? CURSOR_GRAB : 'pointer';
  });

  window.__game = {
    cell: () => ({ cx: world.cx, cy: world.cy, name: world.name }),
    hero: () => ({ u: hero.u, v: hero.v }),
    goTo: (u, v) => { combat?.setTarget(null); return goToWorld(u, v, true); },
    place: (u, v) => { hero.teleport([u, v]); dog.teleport([u + DOG_OFFSET[0], v + DOG_OFFSET[1]]); snapCamera(); },
    warp: (cx, cy, u, v) => jump(cx, cy, [u, v]),
    busy: () => busy,
    outlines: () => (xray.isVisible(heroXray) ? 1 : 0),
    shop: () => ({ u: info.shop.u, v: info.shop.v }),
    mobs: () => mobs.alive().map((m) => ({ id: m.id, kind: m.kind, hp: m.hp, state: m.state, u: m.pos[0] - world.cx * world.size, v: m.pos[1] - world.cy * world.size })),
    attack: (id) => { const m = mobs.mobs.get(id); if (m) combat!.setTarget(m); },
    player: () => ({ hp: combat!.hp, hpMax: combat!.hpMax, mana: combat!.mana, level: combat!.progress.level, exp: combat!.progress.exp, kills: combat!.kills, dead: combat!.dead, arrows: combat!.arrows, gold: combat!.gold }),
    skill: (i) => combat!.useSlot(i),
    hurt: (n) => combat!.takeDamage(n),
    peace: (on) => { peaceful = on; },
    dashReady: () => combat!.dashReady,
    talkToMerchant: () => { if (npc) { wantShop = true; goToWorld(npc.u + 64, npc.v, true); } },
    shopOpen: () => shop.open,
    openStash: () => { if (stashPos) { wantStash = true; goToWorld(stashPos[0] - world.cx * world.size - 30, stashPos[1] - world.cy * world.size, true); } },
    stashOpen: () => stashWin.open,
    moveMob: (id, u, v) => { const m = mobs.mobs.get(id); if (m) { m.pos = [world.cx * world.size + u, world.cy * world.size + v]; m.state = 'idle'; } },
    mobState: (id) => { const m = mobs.mobs.get(id); return m ? m.state : 'none'; },
    folk: () => folk.folk.map((f) => ({ name: f.def.name, u: f.pos[0] - world.cx * world.size, v: f.pos[1] - world.cy * world.size })),
    guards: () => guards.guards.map((g) => ({ u: g.pos[0] - world.cx * world.size, v: g.pos[1] - world.cy * world.size, target: g.target })),
    sitting: () => combat!.sitting,
    drops: () => loot.drops.map((d) => ({ id: d.id, kind: d.kind, item: d.item, u: d.pos[0] - world.cx * world.size, v: d.pos[1] - world.cy * world.size })),
    give: (id) => invc.addItem(id),
    exp: (n) => combat!.addExp(n),
    inv: () => ({ ...invc.inv, points: invc.points, armor: invc.stats.armor, str: invc.stats.attrs.str }),
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
      // podnoszenie łupu
      if (!combat.dead) for (const d of loot.inReach([world.cx * C + hero.u, world.cy * C + hero.v])) {
        if (d.kind === 'gold') { invc.gold += d.amount; floaters.add(hero.sx, hero.sy - 44, `+${d.amount} zł`, '#ffd84a'); invc.onChange(false); }
        else if (d.kind === 'hp' || d.kind === 'mp') { invc.addPotion(d.kind); floaters.add(hero.sx, hero.sy - 44, d.kind === 'hp' ? '+ mikstura zdrowia' : '+ mikstura many', d.kind === 'hp' ? '#ff8a8a' : '#8ab0ff'); }
        else if (d.item) { if (!invc.addItem(d.item)) { loot.wanted = null; continue; } hud.say(`Zdobyto: <span style="color:#a8e0ff">${d.item ? itemName(d.item) : ''}</span>`); }
        loot.take(d);
      }
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
    if (npc && world.inInterior) {
      npc.update(world.grid, at);
      const dn = Math.hypot(hero.u - npc.u, hero.v - npc.v);
      if (wantShop && dn < 96) {
        wantShop = false;
        hero.path = [];
        hero.faceTo(npc.u, npc.v);
        shopMsg = '';
        shop.show(shopState());
        hud.say('<span style="color:#8ae07a">Kupiec Bronek:</span> Witaj, wędrowcze! Czego ci trzeba?');
      }
      if (shop.open && dn > 140) shop.hide();
    } else if (shop.open) shop.hide();
    // skrzynia: otwórz po podejściu, zamknij po odejściu
    if (stashPos && !world.inInterior) {
      const C = world.size, ds = Math.hypot(world.cx * C + hero.u - stashPos[0], world.cy * C + hero.v - stashPos[1]);
      if (wantStash && ds < 56) { wantStash = false; hero.path = []; stashMsg = ''; stashWin.show(stashState()); }
      if (stashWin.open && ds > 110) stashWin.hide();
    } else if (stashWin.open) stashWin.hide();
    guards.update(dt);
    folk.update(dt, [world.cx * world.size + hero.u, world.cy * world.size + hero.v]);
    fountain.update(t);
    mobs.render(world.layer);
    loot.update(dt);
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
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">Błąd uruchomienia gry:\n${String(err)}</pre>`);
});
