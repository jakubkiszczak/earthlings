"""Eksport sceny do silnika (PixiJS): pasma terenu wg głębi, dane wody do animacji, mapa wyboru (klik),
siatka chodzenia, atlas sprite'ów (korony osobno od pni), klatki postaci i psa, rozmieszczenie."""
from pathlib import Path as _P
ROOT = _P(__file__).resolve().parent.parent
import json, io, base64
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src = open(ROOT / 'tools' / 'compose.py').read()
src = src[:src.index('# ---------------------------------------------------------------- scena')]
G_ = {'__file__': str(ROOT / 'tools' / 'compose.py')}
exec(compile(src, 'compose_funcs', 'exec'), G_)
S = G_['S']
img, dep, kind = G_['img'], G_['dep'], S.kind
W, Hs, OFF = S.W, S.Hs, S.OFF
where_screen, ground_shadow = G_['where_screen'], G_['ground_shadow']
tree, bush, chest, rock, pixmap = G_['tree'], G_['bush'], G_['chest'], G_['rock'], G_['pixmap']
OUT = str(ROOT / 'assets' / 'generated')
import os
os.makedirs(OUT, exist_ok=True)

DXY = (160, 105)   # przesunięcie starego kadru 480x270 w nowym 800x480
def mv(x, y):
    return x + DXY[0], y + DXY[1]

# ------------------------------------------------------------ rozmieszczenie
TREES = [(30, 92, 46, 3, 28, True), (150, 60, 44, 8, 30, True), (300, 6, 40, 9, 26, True), (-10, 40, 50, 51, 30, True),
         (90, 20, 48, 52, 30, True), (470, 10, 40, 53, 26, True), (450, 76, 36, 5, 24, False), (110, 110, 30, 11, 22, False),
         (200, 196, 32, 13, 24, False), (30, 262, 38, 17, 22, False), (390, 20, 28, 23, 18, False), (60, 200, 22, 19, 16, False)]
TREES = [(mv(x, y)[0], mv(x, y)[1], R, sd, th, dk) for (x, y, R, sd, th, dk) in TREES]
BUSHES = [(212, 88, 9, 31), (150, 126, 10, 32), (275, 210, 8, 33), (405, 128, 9, 34), (100, 256, 9, 35), (240, 252, 10, 36), (60, 120, 9, 37), (370, 100, 7, 38)]
BUSHES = [(mv(x, y)[0], mv(x, y)[1], R, sd) for (x, y, R, sd) in BUSHES]
# dodatkowe drzewa w nowych częściach mapy (deterministycznie, z odstępami)
rr = np.random.default_rng(99)
taken = [(x, y) for (x, y, *_r) in TREES] + [mv(352, 168), mv(232, 98)]
for k in range(400):
    x, y = int(rr.integers(10, W - 10)), int(rr.integers(30, Hs - 4))
    if 150 + 0 < x < 650 and 100 < y < 380:
        continue   # środek sceny zostaje jak w kadrze testowym
    if kind[y, x] != S.GRASS:
        continue
    if any((x - a) ** 2 + (y - b) ** 2 < 55 ** 2 for (a, b) in taken):
        continue
    try:
        uu, vv, h = where_screen(x, y)
    except ValueError:
        continue
    R = int(rr.integers(26, 44))
    TREES.append((x, y, R, 200 + k, int(R * 0.6), bool(rr.random() < 0.35)))
    taken.append((x, y))
    if len(TREES) > 34:
        break
for k in range(300):
    x, y = int(rr.integers(10, W - 10)), int(rr.integers(30, Hs - 4))
    if kind[y, x] != S.GRASS or any((x - a) ** 2 + (y - b) ** 2 < 22 ** 2 for (a, b) in taken):
        continue
    BUSHES.append((x, y, int(rr.integers(7, 11)), 400 + k)); taken.append((x, y))
    if len(BUSHES) > 30:
        break
ROCKS = [(mv(x, y)[0], mv(x, y)[1], rw, sd) for (x, y, rw, sd) in [(432, 238, 18, 41), (462, 214, 12, 42), (398, 262, 14, 43), (470, 258, 22, 44)]]
for k in range(200):
    x, y = int(rr.integers(10, W - 10)), int(rr.integers(30, Hs - 4))
    if kind[y, x] == S.WATER and S.kind[max(0, y - 6), x] == S.WATER and rr.random() < 0.5:
        ROCKS.append((x, y, int(rr.integers(10, 22)), 600 + k))
        if len(ROCKS) > 12:
            break
CHEST = mv(232, 98)
HERO0, DOG0 = mv(352, 168), mv(330, 172)

# cienie pod drzewami/krzakami/skrzynią wypieczone w teren
for (x, y, R, sd, th, dk) in TREES:
    ground_shadow(x, y, R * 1.15, R * 0.42, 0.62, dx=R * 0.55)
for (x, y, R, sd) in BUSHES:
    ground_shadow(x, y + 1, R * 1.0, R * 0.4, 0.65, dx=R * 0.4)
ground_shadow(CHEST[0] + 4, CHEST[1], 17, 5, 0.6)

# ------------------------------------------------------------ woda: dane do animacji na CPU
wm = kind == S.WATER
iu, iv = np.clip(S_pu := G_['S'].pu + OFF, 0, S.N - 1), np.clip(S.pv + OFF, 0, S.N - 1)
depthn = np.clip(S.dist / 70, 0, 1)
base = 5.6 - 4.4 * depthn + 0.8 * (S.wn - 0.5) - 1.6 * S.shadow
fn = S.noise(8, 51)
q = S.dist - 3.0 * fn
B_ = base[iv, iu]; WF = S.wf[iv, iu]; WF2 = S.wf2[iv, iu]; Q = q[iv, iu]
# piana przy kamieniach
rocks_m = np.zeros_like(wm)
yy, xx = np.mgrid[0:Hs, 0:W]
for (x, y, rw, sd) in ROCKS:
    rocks_m |= (((xx - x) / (rw * 0.62)) ** 2 + ((yy - y + 2) / (rw * 0.3)) ** 2) < 1
ring = ndi.binary_dilation(rocks_m, iterations=2) & ~rocks_m & wm
Q = np.where(ring, -3.9, Q)
wr = np.zeros((Hs, W, 4), np.uint8)
wr[..., 0] = np.where(wm, np.clip(B_ * 18 + 1, 1, 255), 0)
wr[..., 1] = np.clip(WF * 255, 0, 255)
wr[..., 2] = np.clip(WF2 * 255, 0, 255)
wr[..., 3] = 255
wq = np.clip((Q + 4) * 20, 0, 255).astype(np.uint8)
Image.fromarray(wr[..., :3]).save(f'{OUT}/water_a.png')
Image.fromarray(np.dstack([wq, wq, wq])).save(f'{OUT}/water_b.png')

# ------------------------------------------------------------ pasma terenu wg głębi
BW = 8
land = (kind >= 0) & ~wm
band = np.where(land, dep // (2 * BW), -1)
bands = []
pieces = []
for b in np.unique(band[band >= 0]):
    m = band == b
    ys_, xs_ = np.nonzero(m)
    y0, y1, x0, x1 = ys_.min(), ys_.max() + 1, xs_.min(), xs_.max() + 1
    tile = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    tile[..., :3] = np.clip(img[y0:y1, x0:x1], 0, 255)
    tile[..., 3] = np.where(m[y0:y1, x0:x1], 255, 0)
    pieces.append((int(b), x0, y0, tile))
# pakowanie półkowe (szer. 2048)
AW = 2048
x = y = rowh = 0
placed = []
for (b, x0, y0, t) in sorted(pieces, key=lambda p: -p[3].shape[0]):
    h_, w_ = t.shape[:2]
    if x + w_ + 1 > AW:
        x, y, rowh = 0, y + rowh + 1, 0
    placed.append((b, x0, y0, x, y, t))
    x += w_ + 1; rowh = max(rowh, h_)
AH = y + rowh + 1
atl = np.zeros((AH, AW, 4), np.uint8)
for (b, x0, y0, ax, ay, t) in placed:
    atl[ay:ay + t.shape[0], ax:ax + t.shape[1]] = t
    bands.append(dict(z=int(b) * BW, x=int(x0), y=int(y0), ax=int(ax), ay=int(ay), w=int(t.shape[1]), h=int(t.shape[0])))
Image.fromarray(atl).save(f'{OUT}/bands.png')
print('bands', len(bands), 'atlas', AW, AH)

# ------------------------------------------------------------ mapa wyboru (piksel -> teksel) i siatka chodzenia
pk = np.full((Hs, W), 0xFFFFFF, np.int64)
ok = (S.pu > -9000) & (kind >= 0)
pk[ok] = ((S.pu[ok] + OFF).astype(np.int64) << 11) | (S.pv[ok] + OFF)
Image.fromarray(np.dstack([(pk >> 16) & 255, (pk >> 8) & 255, pk & 255]).astype(np.uint8)).save(f'{OUT}/pick.png')
CELL = 4
NC = S.N // CELL
Hc = S.H[CELL // 2::CELL, CELL // 2::CELL][:NC, :NC]
Mc = S.MAT[CELL // 2::CELL, CELL // 2::CELL][:NC, :NC]
walk = np.isin(Mc, [S.GRASS, S.DIRT, S.PATH, S.PAVE]) & (Hc < 100)
# komórka musi być w kadrze
cu, cv = np.meshgrid(np.arange(NC) * CELL + CELL // 2 - OFF, np.arange(NC) * CELL + CELL // 2 - OFF)
sx = cu - cv + S.X0; sy = (cu + cv) // 2 - Hc + S.Y0
walk &= (sx > 12) & (sx < W - 12) & (sy > 24) & (sy < Hs - 6)
# przeszkody: pnie, krzaki, skrzynia, kamienie
def block(x, y, r):
    try:
        uu, vv, h = where_screen(x, y)
    except ValueError:
        return
    ci, cj = (uu + OFF) // CELL, (vv + OFF) // CELL
    for dj in range(-r, r + 1):
        for di in range(-r, r + 1):
            if di * di + dj * dj <= r * r and 0 <= cj + dj < NC and 0 <= ci + di < NC:
                walk[cj + dj, ci + di] = False
for (x, y, R, *_r) in TREES:
    block(x, y, 2)
for (x, y, R, sd) in BUSHES:
    block(x, y, 1)
block(*CHEST, 3)
wg = np.where(walk, np.clip(Hc + 1, 1, 254), 0).astype(np.uint8)
Image.fromarray(wg).save(f'{OUT}/walk.png')

# ------------------------------------------------------------ sprite'y
spr = {}   # nazwa -> (rgba, anchor)


def rgba(col, al):
    a = np.zeros(al.shape + (4,), np.uint8)
    a[..., :3] = np.clip(col, 0, 255); a[..., 3] = al * 255
    return a


ents = []
for n, (x, y, R, sd, th, dk) in enumerate(TREES):
    try:
        uu, vv, h = where_screen(x, y)
    except ValueError:
        continue
    col, al, anc = tree(R, sd, th, 7 + R // 10, dk)
    can = tree.canopy & al
    spr[f'tree{n}_t'] = (rgba(col, al & ~can), anc)
    spr[f'tree{n}_c'] = (rgba(col, can), anc)
    ents.append(dict(k='tree', s=[f'tree{n}_t', f'tree{n}_c'], x=x, y=y, z=int(uu + vv), ph=float(rr.random() * 6.28)))
for n, (x, y, R, sd) in enumerate(BUSHES):
    try:
        uu, vv, h = where_screen(x, y)
    except ValueError:
        continue
    col, al, anc = bush(R, sd)
    spr[f'bush{n}'] = (rgba(col, al), anc)
    ents.append(dict(k='bush', s=[f'bush{n}'], x=x, y=y, z=int(uu + vv), ph=float(rr.random() * 6.28)))
col, al, anc = chest(); spr['chest'] = (rgba(col, al), anc)
uu, vv, h = where_screen(*CHEST)
ents.append(dict(k='prop', s=['chest'], x=CHEST[0], y=CHEST[1], z=int(uu + vv)))
for n, (x, y, rw, sd) in enumerate(ROCKS):
    col, al, anc = rock(rw, sd); spr[f'rock{n}'] = (rgba(col, al), anc)
    ents.append(dict(k='prop', s=[f'rock{n}'], x=x, y=y, z=int((2 * (y - S.Y0)))))

# postać: tył (z referencji) i przód, chód 4 klatki (przesunięcia nóg), oddech 2 klatki
HERO = G_['HERO']; HP = G_['HP']
FRONT = HERO[:6] + [
    "....hHgHHHHgHhf........",
    "....hgSSSSSSgh.........",
    ".....gSoSSoSg..........",
    "......sSSSSs...........",
    ".....rRRRRRRrr.........",
    "....rRRRRRRRRRr........",
    "...LrRRDBBBDRRrl.......",
    "..LLlbBBBBBBBblll......",
    "..LLlbBBBBBBBblll......",
    "..LllbBBBBBBBbll.......",
    "..LllbBBBBBBBbll.......",
    "..SllbBBBBBBBbllS......",
    "..SsbBBBBBBBBBbsS......",
    "...sbBBDDDDDBBb.s......",
    "....bBBBBBBBBBb........",
    "....bBBBBBBBBBb........",
    "....bBBBBBBBBBb........",
    "....bBBBBBBBBBb........",
    "....bBBBBDDBBBb........",
    ".....bBBBBBBBb.........",
] + HERO[26:]
HP2 = dict(HP); HP2['o'] = '#1a1414'


def shift(a, region, dy):
    out = a.copy(); x0, x1, y0, y1 = region
    part = a[y0:y1, x0:x1].copy(); out[y0:y1, x0:x1] = 0
    for r_ in range(part.shape[0]):
        yy_ = y0 + r_ + dy
        if 0 <= yy_ < a.shape[0]:
            m = part[r_, :, 3] > 0
            out[yy_, x0:x1][m] = part[r_][m]
    return out


import sys
sys.path.insert(0, str(ROOT / 'tools'))
import hero9
for nm, a_ in hero9.all_frames().items():
    spr[nm] = (a_, (14, 41))
DOG = G_['DOG']; DP = G_['DP']
col, al = pixmap(DOG, DP); d0 = rgba(col, al)
d1 = shift(d0, (0, 16, 8, 11), -1)
spr['dog0'] = (d0, (7, 10)); spr['dog1'] = (d1, (7, 10))
# cień postaci
sh = np.zeros((7, 21, 4), np.uint8)
yy_, xx_ = np.mgrid[0:7, 0:21]
e = ((xx_ - 10) / 10) ** 2 + ((yy_ - 3) / 3.2) ** 2 + S.BAYER[yy_ % 4, xx_ % 4] * 0.3
sh[e < 1] = (10, 20, 30, 110)
spr['shadow'] = (sh, (10, 3))

# atlas sprite'ów
items = sorted(spr.items(), key=lambda kv: -kv[1][0].shape[0])
SW = 1024
x = y = rowh = 0
frames = {}
for nm, (a_, anc) in items:
    h_, w_ = a_.shape[:2]
    if x + w_ + 2 > SW:
        x, y, rowh = 0, y + rowh + 2, 0
    frames[nm] = [x + 1, y + 1, w_, h_, int(anc[0]), int(anc[1])]
    x += w_ + 2; rowh = max(rowh, h_)
SH = y + rowh + 2
sat = np.zeros((SH, SW, 4), np.uint8)
for nm, (a_, anc) in items:
    fx, fy, w_, h_ = frames[nm][:4]
    sat[fy:fy + h_, fx:fx + w_] = a_
Image.fromarray(sat).save(f'{OUT}/sprites.png')
print('sprites atlas', SW, SH, len(frames))

hu, hv, hh = where_screen(*HERO0)
du, dv, dh = where_screen(*DOG0)
meta = dict(W=W, H=Hs, X0=S.X0, Y0=S.Y0, OFF=OFF, N=S.N, CELL=CELL, NC=int(NC), bands=bands, frames=frames, ents=ents,
            hero=[int(hu), int(hv)], dog=[int(du), int(dv)],
            WA=S.WA.astype(int).tolist(), BAYER=(S.BAYER + 0.47).tolist())
json.dump(meta, open(f'{OUT}/meta.json', 'w'))
# podgląd statyczny (kontrola): teren + woda bazowa
prev = np.clip(img, 0, 255).astype(np.uint8)
Image.fromarray(prev).save(f'{OUT}/terrain_preview.png')
print('ok', len(TREES), 'drzew', len(BUSHES), 'krzaków', len(ROCKS), 'kamieni')
