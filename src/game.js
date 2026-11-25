// Bujna izometria w ruchu — PixiJS v8. Dane z export_live.py (META, IMG wstrzykiwane przez build).
(async () => {
  const { Application, Texture, ImageSource, CanvasSource, Rectangle, Sprite, Container, TilingSprite, TextureStyle, Graphics } = PIXI;
  TextureStyle.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({ resizeTo: window, background: '#0b1a12', roundPixels: true, antialias: false });
  document.body.appendChild(app.canvas);
  window.app = app;

  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const imgs = {};
  for (const k in IMG) imgs[k] = await load(IMG[k]);
  const readPx = (img) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, img.width, img.height).data;
  };
  const M = META, W = M.W, H = M.H;
  const bandsSrc = new ImageSource({ resource: imgs.bands, scaleMode: 'nearest' });
  const sprSrc = new ImageSource({ resource: imgs.sprites, scaleMode: 'nearest' });
  const sub = (src, x, y, w, h) => new Texture({ source: src, frame: new Rectangle(x, y, w, h) });
  const F = M.frames;
  const ftex = {};
  const ft = (n) => (ftex[n] ||= sub(sprSrc, F[n][0], F[n][1], F[n][2], F[n][3]));
  const mk = (n) => { const s = new Sprite(ft(n)); s.pivot.set(F[n][4], F[n][5]); return s; };

  const world = new Container();
  app.stage.addChild(world);

  // ---------------- woda (animowana na CPU, w siatce pikseli świata)
  const wc = document.createElement('canvas'); wc.width = W; wc.height = H;
  const wctx = wc.getContext('2d');
  const wimg = wctx.createImageData(W, H);
  const A_ = readPx(imgs.water_a), B_ = readPx(imgs.water_b);
  const widx = [];
  for (let i = 0; i < W * H; i++) if (A_[i * 4] > 0) widx.push(i);
  const NW = widx.length;
  const wBase = new Float32Array(NW), wF = new Float32Array(NW), wF2 = new Float32Array(NW), wQ = new Float32Array(NW);
  widx.forEach((p, k) => { wBase[k] = (A_[p * 4] - 1) / 18; wF[k] = A_[p * 4 + 1] / 255; wF2[k] = A_[p * 4 + 2] / 255; wQ[k] = B_[p * 4] / 20 - 4; });
  const wsrc = new CanvasSource({ resource: wc, scaleMode: 'nearest' });
  const water = new Sprite(new Texture({ source: wsrc }));
  world.addChild(water);
  const WA = M.WA, BY = M.BAYER;
  const fr = (v) => v - Math.floor(v);
  function drawWater(t) {
    const d = wimg.data;
    const step = Math.floor(t * 6);
    for (let k = 0; k < NW; k++) {
      const p = widx[k], x = p % W, y = (p / W) | 0;
      let idx = wBase[k];
      if (Math.abs(fr(wF2[k] * 2 + t * 0.04) - 0.5) < 0.06) idx -= 1;
      if (Math.abs(fr(wF2[k] * 3 - t * 0.07) - 0.5) < 0.03) idx += 1;
      if (Math.abs(fr(wF[k] * 4 + t * 0.10) - 0.5) < 0.035) idx += 2;
      if (wQ[k] < 0.7 * Math.sin(t * 1.6 + x * 0.13 + y * 0.07) + 0.45) idx = 7.3 + ((x + y + step) & 1);
      idx += BY[y & 3][x & 3] - 0.47;
      let i = Math.round(idx); if (i < 0) i = 0; if (i > 8) i = 8;
      const c = WA[i], o = p * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    wctx.putImageData(wimg, 0, 0);
    wsrc.update();
  }
  drawWater(0);

  // ---------------- teren w pasmach głębi + byty sortowane po s = u + v
  const layer = new Container();
  layer.sortableChildren = true;
  world.addChild(layer);
  for (const b of M.bands) {
    const s = new Sprite(sub(bandsSrc, b.ax, b.ay, b.w, b.h));
    s.position.set(b.x, b.y);
    s.zIndex = b.z * 10;
    layer.addChild(s);
  }
  const sway = [];
  for (const e of M.ents) {
    const c = new Container();
    c.position.set(e.x, e.y);
    c.zIndex = e.z * 10 + 5;
    for (const n of e.s) {
      const s = mk(n);
      c.addChild(s);
      if (n.endsWith('_c') || e.k === 'bush') sway.push({ s, ph: e.ph || 0, amp: e.k === 'bush' ? 0.55 : 0.85 });
    }
    layer.addChild(c);
  }

  // ---------------- siatka chodzenia i mapa wyboru
  const WG = readPx(imgs.walk), NC = M.NC, CELL = M.CELL, OFF = M.OFF;
  const cellH = (ci, cj) => (ci < 0 || cj < 0 || ci >= NC || cj >= NC) ? 0 : WG[(cj * NC + ci) * 4];
  const PK = readPx(imgs.pick);
  const heightAt = (u, v) => { const h = cellH(Math.floor((u + OFF) / CELL), Math.floor((v + OFF) / CELL)); return h ? h - 1 : 0; };
  const toScreen = (u, v) => [u - v + M.X0, Math.floor((u + v) / 2) - heightAt(u, v) + M.Y0];

  function astar(si, sj, ti, tj) {
    const key = (i, j) => j * NC + i;
    const g = new Float32Array(NC * NC).fill(1e9), from = new Int32Array(NC * NC).fill(-1), closed = new Uint8Array(NC * NC);
    const heap = [];
    const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const hfn = (i, j) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const s0 = key(si, sj); g[s0] = 0; push(hfn(si, sj), s0);
    while (heap.length) {
      const [, k] = pop();
      if (closed[k]) continue; closed[k] = 1;
      const i = k % NC, j = (k / NC) | 0;
      if (i === ti && j === tj) {
        const path = []; let c = k;
        while (c !== -1) { path.push([c % NC, (c / NC) | 0]); c = from[c]; }
        return path.reverse();
      }
      const h0 = cellH(i, j);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj, h1 = cellH(ni, nj);
        if (!h1 || Math.abs(h1 - h0) > 8) continue;
        if (di && dj && (!cellH(i + di, j) || !cellH(i, j + dj))) continue;
        const nk = key(ni, nj), ng = g[k] + (di && dj ? 1.414 : 1);
        if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + hfn(ni, nj), nk); }
      }
    }
    return null;
  }

  // ---------------- bohater i pies
  const mkActor = (shadowW) => { const c = new Container(); const sh = mk('shadow'); sh.scale.set(shadowW, 1); const s = new Sprite(); c.addChild(sh, s); layer.addChild(c); return { c, s }; };
  const hero = { u: M.hero[0], v: M.hero[1], path: [], dir: 'NE', flip: false, moving: false, ...mkActor(1) };
  const dog = { u: M.dog[0], v: M.dog[1], ...mkActor(0.7) };
  const headMark = new Graphics().poly([-3, 0, 3, 0, 0, 4]).fill(0xffd84a).stroke({ width: 1, color: 0x1a1210 });
  hero.c.addChild(headMark);
  const fx = new Graphics(); layer.addChild(fx); fx.zIndex = 1e9;
  const effects = [];
  window.GAME = {
    hero,
    teleport() { hero.u = M.hero[0]; hero.v = M.hero[1]; hero.path = []; trail.length = 0; dog.u = M.dog[0]; dog.v = M.dog[1]; },
    ring(color) { effects.push({ t: 0, color }); },
  };
  const trail = [];
  const setFrame = (a, name) => { a.s.texture = ft(name); a.s.pivot.set(F[name][4], F[name][5]); };

  const marker = new Graphics();
  layer.addChild(marker);
  let markT = 0;

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;
  app.stage.cursor = 'pointer';
  function goTo(gx, gy, showMark) {
    const wx = Math.floor((gx - world.x) / zoom), wy = Math.floor((gy - world.y) / zoom);
    if (wx < 0 || wy < 0 || wx >= W || wy >= H) return;
    const o = (wy * W + wx) * 4;
    const val = (PK[o] << 16) | (PK[o + 1] << 8) | PK[o + 2];
    if (val === 0xFFFFFF) return;
    const tu = (val >> 11) - OFF, tv = (val & 2047) - OFF;
    let ti = Math.floor((tu + OFF) / CELL), tj = Math.floor((tv + OFF) / CELL);
    if (!cellH(ti, tj)) {
      let best = null;
      for (let r = 1; r < 8 && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++)
        if (!best && cellH(ti + di, tj + dj)) best = [ti + di, tj + dj];
      if (!best) return; [ti, tj] = best;
    }
    const si = Math.floor((hero.u + OFF) / CELL), sj = Math.floor((hero.v + OFF) / CELL);
    const p = astar(si, sj, ti, tj);
    if (!p) return;
    hero.path = p.slice(1).map(([i, j]) => [i * CELL + CELL / 2 - OFF, j * CELL + CELL / 2 - OFF]);
    if (showMark && hero.path.length) {
      const [mx, my] = toScreen(hero.path.at(-1)[0], hero.path.at(-1)[1]);
      marker.clear().poly([mx, my - 4, mx + 8, my, mx, my + 4, mx - 8, my]).stroke({ width: 1, color: 0xfff1c4, alpha: 1 });
      marker.zIndex = 1e9; markT = 1.2;
    }
  }
  const ptr = { down: false, x: 0, y: 0, t: 0 };
  app.stage.on('pointerdown', (e) => { ptr.down = true; ptr.x = e.global.x; ptr.y = e.global.y; ptr.t = 0; goTo(ptr.x, ptr.y, true); });
  app.stage.on('globalpointermove', (e) => { ptr.x = e.global.x; ptr.y = e.global.y; });
  const up = () => { if (ptr.down) { ptr.down = false; goTo(ptr.x, ptr.y, true); } };
  app.stage.on('pointerup', up); app.stage.on('pointerupoutside', up);
  window.addEventListener('blur', () => { ptr.down = false; });

  // ---------------- chmury (cień, multiply, dithering w siatce pikseli)
  const cc = document.createElement('canvas'); cc.width = cc.height = 512;
  const cx = cc.getContext('2d'); const cd = cx.createImageData(512, 512);
  const rnd = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, y, sc) => { const i = Math.floor(x / sc), j = Math.floor(y / sc), fx = x / sc - i, fy = y / sc - j;
    const sm = (t) => t * t * (3 - 2 * t); const p = (a, b) => rnd(((a % (512 / sc)) + 512 / sc) % (512 / sc), ((b % (512 / sc)) + 512 / sc) % (512 / sc));
    const a = p(i, j), b = p(i + 1, j), c = p(i, j + 1), d = p(i + 1, j + 1);
    return a + (b - a) * sm(fx) + (c - a) * sm(fy) + (a - b - c + d) * sm(fx) * sm(fy); };
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const n = vn(x, y, 128) * 0.6 + vn(x, y, 64) * 0.3 + vn(x, y, 32) * 0.1;
    const th = 0.62 + (BY[y & 3][x & 3] - 0.47) * 0.06;
    const o = (y * 512 + x) * 4; const sh = n > th;
    cd.data[o] = sh ? 196 : 255; cd.data[o + 1] = sh ? 206 : 255; cd.data[o + 2] = sh ? 228 : 255; cd.data[o + 3] = 255;
  }
  cx.putImageData(cd, 0, 0);
  const clouds = new TilingSprite({ texture: new Texture({ source: new CanvasSource({ resource: cc, scaleMode: 'nearest' }) }), width: W, height: H });
  clouds.blendMode = 'multiply';
  world.addChild(clouds);

  // ---------------- kamera (wygładzanie wykładnicze, zoom całkowity, ograniczenie do mapy)
  let zoom = Math.max(2, Math.min(5, Math.floor(Math.min(innerWidth / 330, innerHeight / 200))));
  window.addEventListener('wheel', (e) => { zoom = Math.max(2, Math.min(6, zoom + (e.deltaY < 0 ? 1 : -1))); }, { passive: true });
  const cam = { x: 0, y: 0 };
  { const [x, y] = toScreen(hero.u, hero.v); cam.x = x; cam.y = y - 16; }

  // ---------------- pętla
  let t = 0, wt = 0, at = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(tk.deltaMS / 1000, 0.1);
    t += dt; wt += dt; at += dt;
    if (wt > 0.1) { drawWater(t); wt = 0; }
    clouds.tilePosition.set(Math.round(t * 5) % 512, Math.round(t * 2.5) % 512);
    for (const sw of sway) sw.s.x = Math.round(Math.sin(t * 1.3 + sw.ph) * sw.amp);
    // przytrzymana mysz: cel odświeżany co 0,15 s
    if (ptr.down) { ptr.t += dt; if (ptr.t > 0.15) { ptr.t = 0; goTo(ptr.x, ptr.y, false); } }
    // ruch bohatera
    hero.moving = false;
    if (hero.path.length) {
      const [tu, tv] = hero.path[0];
      const du = tu - hero.u, dv = tv - hero.v, dist = Math.hypot(du, dv);
      const sp = 51 * (window.HUD_SPEED || 1) * dt;
      if (dist <= sp) { hero.u = tu; hero.v = tv; hero.path.shift(); }
      else { hero.u += du / dist * sp; hero.v += dv / dist * sp; }
      const sdx = du - dv, sdy = (du + dv) / 2;
      if (Math.hypot(sdx, sdy) > 0.2) {
        const oct = ((Math.round(Math.atan2(sdy, sdx) / (Math.PI / 4)) % 8) + 8) % 8;   // 0=E,1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE
        hero.dir = ['E', 'SE', 'S', 'SE', 'E', 'NE', 'N', 'NE'][oct];
        hero.flip = oct >= 3 && oct <= 5;
      }
      hero.moving = true;
      trail.push([hero.u, hero.v]); if (trail.length > 120) trail.shift();
    }
    const fi = hero.moving ? `walk${Math.floor(at * 11 * (window.HUD_SPEED || 1) ** 0.5) % 4}` : `idle${Math.floor(at * 1.6) % 2}`;
    setFrame(hero, `hero_${hero.dir}_${fi}`);
    hero.s.scale.x = hero.flip ? -1 : 1;
    let [hx, hy] = toScreen(hero.u, hero.v);
    hero.c.position.set(Math.round(hx), Math.round(hy));
    hero.c.zIndex = Math.round(hero.u + hero.v) * 10 + 6;
    // pies podąża śladem
    if (trail.length > 18) {
      const [gu, gv] = trail[trail.length - 18];
      const du = gu - dog.u, dv = gv - dog.v, d = Math.hypot(du, dv);
      if (d > 1) { const sp = Math.min(d, 60 * (window.HUD_SPEED || 1) * dt); dog.u += du / d * sp; dog.v += dv / d * sp; dog.s.scale.x = (du - dv) > 0 ? -1 : 1; }
      setFrame(dog, d > 1 ? `dog${Math.floor(at * 10) % 2}` : 'dog0');
    } else setFrame(dog, 'dog0');
    const [dx_, dy_] = toScreen(dog.u, dog.v);
    dog.c.position.set(Math.round(dx_), Math.round(dy_));
    dog.c.zIndex = Math.round(dog.u + dog.v) * 10 + 6;
    headMark.position.set(0, -49 + Math.round(Math.sin(t * 4)));
    // efekty: rozchodzący się pierścień (pikselowy, izometryczny)
    fx.clear();
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]; e.t += dt;
      if (e.t > 0.7) { effects.splice(i, 1); continue; }
      const r = Math.round(4 + e.t * 30);
      fx.ellipse(Math.round(hx), Math.round(hy), r, Math.round(r / 2)).stroke({ width: 1, color: e.color, alpha: 1 - e.t / 0.7 });
      fx.ellipse(Math.round(hx), Math.round(hy) - 18, Math.round(r * 0.5), Math.round(r * 0.5)).stroke({ width: 1, color: 0xffffff, alpha: (1 - e.t / 0.7) * 0.5 });
    }
    // znacznik celu
    if (markT > 0) { markT -= dt; marker.alpha = Math.max(0, markT); }
    // kamera
    const k = 1 - Math.exp(-6 * dt);
    cam.x += (hx - cam.x) * k; cam.y += (hy + 4 - cam.y) * k;
    const hw = app.screen.width / (2 * zoom), hh = app.screen.height / (2 * zoom);
    const cxl = W < 2 * hw ? W / 2 : Math.min(Math.max(cam.x, hw), W - hw);
    const cyl = H < 2 * hh ? H / 2 : Math.min(Math.max(cam.y, hh), H - hh);
    world.scale.set(zoom);
    world.position.set(Math.round(app.screen.width / 2 - cxl * zoom), Math.round(app.screen.height / 2 - cyl * zoom));
    if (window.onHeroScreen) window.onHeroScreen(world.x + Math.round(hx) * zoom, world.y + (Math.round(hy) - 52) * zoom, zoom, dt);
  });
  window.__ready = true;
})();
