"""Sprite'y (drzewa, krzaki, skrzynia, kamienie, postać, pies) + kompozycja z buforem głębi terenu."""
from pathlib import Path as _P
ROOT = _P(__file__).resolve().parent.parent
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import scene as S   # bufor terenu, palety, H

img = S.img.copy()
dep = S.dep.copy()
kind = S.kind
W, Hs, X0, Y0 = S.W, S.Hs, S.X0, S.Y0
H = S.H
hexs, ramp, BAYER = S.hexs, S.ramp, S.BAYER
TP = hexs(['#0a1f14', '#103020', '#174427', '#215a2c', '#2e7330', '#428d34', '#5aa63a', '#7cc046', '#a2d656', '#c4e870'])
TPD = hexs(['#081812', '#0c2418', '#12321e', '#1a4424', '#245a2a', '#30702e', '#3e8632'])
BK = hexs(['#1e1410', '#33221a', '#4a3324', '#634530', '#7d5a3c', '#97704a'])
L = np.array([-0.55, -0.7, 0.55]); L /= np.linalg.norm(L)


def where_screen(x, y):
    for dy in (0, 1, -1, 2, -2, 3, -3, 4, -4, 6, -6):
        r = _ws(x, y + dy)
        if r:
            return r
    raise ValueError((x, y))


def _ws(x, y):
    for h in sorted(set(H[::4, ::4].ravel().tolist()), reverse=True):
        a = x - X0
        s = 2 * (y + h - Y0)
        uu, vv = (s + a) // 2, (s - a) // 2
        if 0 <= uu + S.OFF < S.N and 0 <= vv + S.OFF < S.N and H[vv + S.OFF, uu + S.OFF] == h:
            return uu, vv, h
    return None


def tree(R, seed, trunk_h=22, trunk_w=7, dark=False):
    r = np.random.default_rng(seed)
    w, h = int(2.6 * R + 24), int(trunk_h + 2 * R + 16)
    col = np.zeros((h, w, 3), np.float32); al = np.zeros((h, w), bool)
    cx, by = w // 2, h - 3
    yy, xx = np.mgrid[0:h, 0:w]
    # pień + korzenie
    cy = by - trunk_h - R * 0.55
    tw = trunk_w + np.clip((yy - (by - 6)) * 1.6, 0, None) + 0.7 * np.sin(yy * 0.4)
    tm = (np.abs(xx - cx - 0.15 * (by - yy) * (seed % 3 - 1) * 0.3) < tw / 2) & (yy <= by) & (yy > cy)
    lx = (xx - cx) / (tw / 2 + 1e-3)
    bark = 2.6 - 1.6 * lx + 0.8 * (S.hsh(xx // 2, yy // 5, seed) - 0.5) - 1.4 * ((xx + (yy // 6)) % 4 == 0)
    col[tm] = ramp(BK, bark[tm], True, xx[tm], yy[tm]); al |= tm
    for k in range(4):   # korzenie
        ang = (-1 if k % 2 else 1) * (0.6 + 0.6 * r.random())
        L0 = 6 + 6 * r.random()
        for t in np.linspace(0, 1, 30):
            px, py = int(cx + ang * t * L0 * 1.6), int(by - 2 + t * 3)
            for dx in (0, 1):
                if 0 <= px + dx < w and 0 <= py < h:
                    col[py, px + dx] = BK[1 if dx else 2]; al[py, px + dx] = True
    # konary rozchodzące się w koronę
    for k in range(3 if trunk_h > 0 else 0):
        ang = (-0.9, 0.15, 0.95)[k] + 0.2 * (r.random() - 0.5)
        x0_, y0_ = cx, cy + R * 0.35
        L1 = R * (0.75 + 0.2 * r.random())
        for t in np.linspace(0, 1, 60):
            px_ = x0_ + np.sin(ang) * t * L1
            py_ = y0_ - np.cos(ang) * t * L1 * 0.8
            th_ = max(1, int((trunk_w * 0.6) * (1 - t) + 1))
            for dx in range(-th_, th_ + 1):
                X_, Y_ = int(px_ + dx), int(py_)
                if 0 <= X_ < w and 0 <= Y_ < h:
                    col[Y_, X_] = BK[2 if dx < 0 else 1]; al[Y_, X_] = True
    # korona: kępy liści rozłożone na kopule, malowane od tyłu
    canm = np.zeros(al.shape, bool)
    pal = TPD if dark else TP
    clumps = []
    n = int(34 + R * 1.6)
    for k in range(n):
        th = r.random() * 2 * np.pi
        ph = np.arccos(r.random() * 1.2 - 0.2)   # głównie górna półkula
        X = np.cos(th) * np.sin(ph) * R * 1.2
        Yd = np.sin(th) * np.sin(ph) * R * 0.9
        Z = np.cos(ph) * R * 0.7
        px, py = cx + X, cy - Z * 0.85 + Yd * 0.45
        if r.random() < 0.12 and ph > 1.0:
            continue   # prześwity w koronie
        clumps.append((Yd + Z, px, py, R * (0.16 + 0.14 * r.random())))
    clumps.append((-99, cx, cy - R * 0.1, R * 0.62))
    clumps.sort()
    for (_, px, py, cr) in clumps:
        x0, x1 = int(max(0, px - cr - 2)), int(min(w, px + cr + 3))
        y0, y1 = int(max(0, py - cr - 2)), int(min(h, py + cr + 3))
        sy_, sx_ = np.mgrid[y0:y1, x0:x1]
        jag = 0.18 * (S.hsh(sx_ // 2, sy_ // 2, seed + int(px)) - 0.5)
        dx, dy = (sx_ - px) / cr, (sy_ - py) / cr
        f = 1 - dx * dx - dy * dy + jag
        mm = f > 0
        if not mm.any():
            continue
        nz = np.sqrt(np.clip(1 - dx ** 2 - dy ** 2, 0, 1))
        loc = dx * L[0] + dy * L[1] + nz * L[2]
        gx, gy = (px - cx) / R, (py - cy) / R
        glob = -0.55 * gx - 0.85 * gy
        leaf = (S.hsh(sx_, sy_, seed + 7) > 0.8) * 0.9 - (S.hsh(sx_ // 2, sy_, seed + 9) > 0.86) * 0.9
        ti = 3.2 + 2.8 * glob + 3.8 * loc + leaf - 2.4 * (f < 0.2) - 1.0 * (gy > 0.25)
        cc = ramp(pal, ti, True, sx_, sy_)
        sub = col[y0:y1, x0:x1]; sa = al[y0:y1, x0:x1]
        sub[mm] = cc[mm]; sa[mm] = True
        cv_ = canm[y0:y1, x0:x1]; cv_[mm] = True
    cm = al
    # kontur
    out = ndi.binary_dilation(al) & ~al
    col[out] = (pal[0] * 0.8); al |= out
    tree.canopy = canm | (out & ndi.binary_dilation(canm))
    return col, al, (cx, by)


def bush(R, seed):
    c, a, (cx, by) = tree(R, seed, trunk_h=0, trunk_w=0)
    return c, a, (cx, by - int(R * 0.1))


def chest():
    c, a_, anc = chest_small()
    # przerysowanie w większej skali w tej samej siatce (2 px detalu -> 3 px): nowa bryła
    return chest_big()


def chest_big():
    WD = hexs(['#24160c', '#432914', '#673e1c', '#8a5626', '#ad7034', '#cc8c46', '#e4aa60'])
    ME = hexs(['#2a2828', '#58524e', '#8e867e', '#c8c0b2', '#f0e8d8'])
    w, h = 38, 34
    col = np.zeros((h, w, 3), np.float32); al = np.zeros((h, w), bool)
    cx, yc, hw, hh, fh = 19, 10, 17, 8.5, 13
    for x in range(w):
        dxn = abs(x - cx) / hw
        if dxn > 1:
            continue
        ye = yc + hh * (1 - dxn)
        left = x < cx
        # ściany
        for y in range(int(ye), int(ye + fh)):
            ry = y - ye
            c = WD[4 if left else 2] if (int(ry) % 4) else WD[1]
            if left and int(ry) % 4 == 1:
                c = WD[5]
            if abs(x - cx) in (12, 13) or int(ry) == 5:
                c = ME[3 if left else 1]
            col[y, x] = c; al[y, x] = True
        # wieko (romb z wybrzuszeniem)
        for y in range(h):
            dyn = abs(y - yc) / hh
            if dxn + dyn <= 1:
                t = (y - (yc - hh)) / (2 * hh)
                c = WD[6] if t < 0.3 else (WD[5] if t < 0.6 else WD[4])
                if x > cx + 3:
                    c = WD[max(2, int(np.argmax((WD == c).all(1)) - 1))]
                if abs(x - cx) in (12, 13):
                    c = ME[4]
                if (x + 2 * y) % 9 == 0:
                    c = WD[3]
                col[y, x] = c; al[y, x] = True
    for (x, y) in [(18, 20), (19, 20), (20, 20), (18, 21), (19, 21), (20, 21), (19, 22)]:
        col[y, x] = (250, 210, 90) if y < 22 else (160, 110, 40)
    out = ndi.binary_dilation(al) & ~al
    col[out] = (20, 12, 8); al |= out
    return col, al, (19, 31)


def chest_small():
    w, h = 26, 22
    col = np.zeros((h, w, 3), np.float32); al = np.zeros((h, w), bool)
    WD = hexs(['#2a1a10', '#4a2e18', '#6e4422', '#8e5a2c', '#b07438', '#cf9450'])
    ME = hexs(['#3a3838', '#6a6460', '#a09890', '#d8d0c0'])
    # iso skrzynia: wierzch romb, ściana lewa i prawa
    for y in range(h):
        for x in range(w):
            # wierzch (romb w y 0..10)
            cxp = 13
            top = abs(x - cxp) / 2 + abs(y - 5) <= 6 and y <= 10
            if top:
                col[y, x] = WD[4 if (x + y) % 6 else 3]; al[y, x] = True
            # lewa ściana
            if x < 13 and y > 5 + (x - 1) / 2 * 0 and y >= 5 + (13 - x) / 2 * 0:
                pass
    # proste: rysujemy jako bryłę z kolumn
    for x in range(1, 25):
        ytop = 5 + abs(x - 13) / 2
        ybot = ytop + 10
        for y in range(int(ytop), int(ybot) + 1):
            left = x < 13
            band = (x in (4, 5, 20, 21)) or (int(y - ytop) in (2,))
            c = WD[3 if left else 2] if (int(y - ytop) % 4) else WD[1]
            if band:
                c = ME[2 if left else 1]
            col[y, x] = c; al[y, x] = True
        for y in range(int(ytop) - 6, int(ytop) + 1):   # wierzch (wieko wypukłe)
            if y >= 0 and abs(x - 13) / 2 + abs(y - (ytop - 3)) <= 6:
                pass
    for y in range(0, 12):
        for x in range(1, 25):
            d = abs(x - 13) / 2 + abs(y - 5.5)
            if d <= 6.2 and y <= 5 + abs(x - 13) / 2:
                band = x in (4, 5, 20, 21)
                col[y, x] = ME[3] if band else WD[5 if (x - y) % 5 else 4]
                al[y, x] = True
    for (x, y) in [(12, 11), (13, 11), (12, 12), (13, 12)]:
        col[y, x] = (240, 200, 80)
    out = ndi.binary_dilation(al) & ~al
    col[out] = (20, 12, 8); al |= out
    return col, al, (13, 18)


def rock(rw, seed):
    r = np.random.default_rng(seed)
    w, h = rw + 4, int(rw * 1.05) + 4
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2, h * 0.55
    dx, dy = (xx - cx) / (rw / 2), (yy - cy) / (h * 0.46)
    f = 1 - dx * dx - dy * dy + 0.15 * (S.hsh(xx // 3, yy // 3, seed) - 0.5)
    m = f > 0
    nz = np.sqrt(np.clip(f, 0, 1))
    li = dx * L[0] + dy * L[1] + nz * L[2]
    col = np.zeros((h, w, 3), np.float32)
    col[m] = ramp(S.RK, (2.5 + 4 * li)[m], True, xx[m], yy[m])
    out = ndi.binary_dilation(m) & ~m
    col[out] = S.RK[0]; m |= out
    return col, m, (int(cx), int(h * 0.8))


def pixmap(rows, pal):
    h, w = len(rows), len(rows[0])
    col = np.zeros((h, w, 3), np.float32); al = np.zeros((h, w), bool)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                col[y, x] = hexs([pal[ch]])[0]; al[y, x] = True
    out = ndi.binary_dilation(al) & ~al
    col[out] = hexs(['#140e12'])[0]; al |= out
    return col, al


HERO = [".................ff....",
        "................fFf....",
        "........hhh....fFf.....",
        "......hHHHHh..fFf......",
        ".....hHHHHHHhfFf.......",
        "....hHHHHHHHHhFf.......",
        "....hHHHHHHHHgf........",
        "....ghHHHHHHgg.........",
        ".....ggHHHHggs.........",
        "......rsSSssr..........",
        ".....rRRRRRRrr.........",
        "....rRRDqqqqDRr........",
        "...LrRqTTTTTTqRrl......",
        "..LLDqTTTTTTTTqDll.....",
        "..LLqTTTtttTTTTqll.....",
        "..LlqTTtEEEtTTTqll.....",
        "..LlqTtEeEEEtTTqll.....",
        "..SlqTtEEEEEtTTqlS.....",
        "..SsqTTtEEEtTTTqsS.....",
        "...sqTTTtttTTTtq.s.....",
        "....qTTTTTTTTTtq.......",
        "....bqqTTTTTTqqb.......",
        "....bBBqqqqqqBBb.......",
        "....bBBBBBBBBBBb.......",
        "....bBBBBDDBBBBb.......",
        ".....bBBBBBBBBb........",
        ".....PPPPPPPPPP........",
        ".....PPPPPpPPPP........",
        ".....PPPPp.pPPP........",
        ".....PPPp..pPPP........",
        ".....PPPp...pPP........",
        ".....PPPp...pPP........",
        ".....kKKk...kKK........",
        "....kKKKk...kKKk.......",
        "....kkkk.....kkk.......",
        ]
HP = dict(H='#f6f6f2', h='#c8ccd6', g='#8a90a0', S='#e8b890', s='#b07a58', R='#cc4a30', r='#8a2a1c', T='#4cc6d0',
          t='#2a8e9e', q='#1a5466', E='#12303c', e='#8af0f8', B='#8a5632', b='#5a361e', D='#3a2214', L='#4a7aaa', l='#2c4e78',
          P='#363a52', p='#202230', K='#7a4626', k='#3e2412', F='#b88050', f='#6e4626')
DOG = ["...ww...........",
       "..wWWw..........",
       "..wWWWw.....w...",
       ".wkWWWWw...wW...",
       ".nWWWWWWWWWWw...",
       "..wWWWWWWWWWw...",
       "...wWWWWWWWw....",
       "...wWw.wWw.w....",
       "...wW..wW..w....",
       "...gg..gg..g....",
       ]
DP = dict(w='#bab4a6', W='#f6f2e8', k='#1a1414', n='#2a2020', g='#8a8478')


def place(spr, x, y, extra_depth=2):
    col, al, (ax, ay) = spr
    uu, vv, h = where_screen(x, y)
    d = (uu + vv) * 2 + extra_depth
    ox, oy = x - ax, y - ay
    hh, ww = al.shape
    for yy in range(hh):
        for xx in range(ww):
            if al[yy, xx]:
                X, Y = ox + xx, oy + yy
                if 0 <= X < W and 0 <= Y < Hs and d >= dep[Y, X]:
                    img[Y, X] = col[yy, xx]
                    dep[Y, X] = d


def ground_shadow(x, y, rx, ry, k=0.55, dx=0):
    yy, xx = np.mgrid[0:Hs, 0:W]
    e = ((xx - x - dx) / rx) ** 2 + ((yy - y) / ry) ** 2
    n = S.BAYER[yy % 4, xx % 4]
    m = (e + n * 0.25 < 1) & (kind >= 0) & (kind != 10) & (kind != S.WATER)
    img[m] = img[m] * k * np.array([0.85, 0.95, 1.15])


# ---------------------------------------------------------------- scena
TREES = [  # (x, y, R, seed, trunk_h, dark)
    (30, 92, 46, 3, 28, True), (150, 60, 44, 8, 30, True), (300, 6, 40, 9, 26, True), (-10, 40, 50, 51, 30, True), (90, 20, 48, 52, 30, True), (470, 10, 40, 53, 26, True), (450, 76, 36, 5, 24, False),
    (110, 110, 30, 11, 22, False), (200, 196, 32, 13, 24, False), (30, 262, 38, 17, 22, False),
    (390, 20, 28, 23, 18, False), (60, 200, 22, 19, 16, False),
]
BUSHES = [(212, 88, 9, 31), (150, 126, 10, 32), (275, 210, 8, 33), (405, 128, 9, 34), (100, 256, 9, 35), (240, 252, 10, 36), (60, 120, 9, 37), (370, 100, 7, 38)]
objs = []
for (x, y, R, seed, th, dk) in TREES:
    try:
        uu, vv, h = where_screen(x, y)
    except ValueError:
        continue
    ground_shadow(x, y, R * 1.15, R * 0.42, 0.62, dx=R * 0.55)
    objs.append(((uu + vv), tree(R, seed, th, 7 + R // 10, dk), x, y))
for (x, y, R, seed) in BUSHES:
    try:
        uu, vv, h = where_screen(x, y)
    except ValueError:
        continue
    ground_shadow(x, y + 1, R * 1.0, R * 0.4, 0.65, dx=R * 0.4)
    objs.append(((uu + vv), bush(R, seed), x, y))
for (x, y) in [(232, 98)]:
    ground_shadow(x + 4, y, 17, 5, 0.6)
    objs.append((0, chest(), x, y))
for (x, y, rw, seed) in [(432, 238, 18, 41), (462, 214, 12, 42), (398, 262, 14, 43), (470, 258, 22, 44)]:
    objs.append((0, rock(rw, seed), x, y))
hero = pixmap(HERO, HP); hero = (hero[0], hero[1], (10, 35))
dog = pixmap(DOG, DP); dog = (dog[0], dog[1], (7, 10))
ground_shadow(354, 168, 10, 3.5, 0.55)
ground_shadow(330, 172, 7, 2.5, 0.6)
objs.append((0, hero, 352, 168))
objs.append((0, dog, 330, 172))
# kolejność po głębi
def key(o):
    _, spr, x, y = o
    uu, vv, h = where_screen(x, y)
    return uu + vv
objs.sort(key=key)
for (_, spr, x, y) in objs:
    try:
        place(spr, x, y)
    except ValueError as e:
        print('skip', e)

# piana wokół kamieni w wodzie
wm = (kind == S.WATER)
rocks_m = np.zeros_like(wm)
for (x, y, rw, seed) in [(432, 238, 18, 41), (462, 214, 12, 42), (398, 262, 14, 43), (470, 258, 22, 44)]:
    yy, xx = np.mgrid[0:Hs, 0:W]
    rocks_m |= (((xx - x) / (rw * 0.62)) ** 2 + ((yy - y + 2) / (rw * 0.3)) ** 2) < 1
ring = ndi.binary_dilation(rocks_m, iterations=2) & ~rocks_m & wm & (dep < 10 ** 9)
yy, xx = np.nonzero(ring)
for y, x in zip(yy, xx):
    if (x + y) % 3:
        img[y, x] = S.WA[7 + ((x * 7 + y) % 2)]

# korekcja barw: ciepłe światło z lewej-góry, lekka winieta
yy, xx = np.mgrid[0:Hs, 0:W]
warm = np.clip(1 - (xx / W * 0.6 + yy / Hs * 0.6), 0, 1)
img = img * (1 + 0.10 * warm[..., None] * np.array([1.0, 0.85, 0.4]))
vig = np.clip(1 - 0.28 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - Hs / 2) / (Hs / 2)) ** 2), 0.7, 1)
img *= vig[..., None]
out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
out.save(str(ROOT / 'docs' / 'native.png'))
out.resize((W * 4, Hs * 4), Image.NEAREST).save(str(ROOT / 'docs' / 'kadr_testowy.png'))
print('done')
