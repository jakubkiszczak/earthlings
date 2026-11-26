"""Generator świata 3×3: każda komórka 40×40 kafli (1280 tekseli) + margines 128 tekseli z sąsiadów.
Ukształtowanie, drogi, rzeka i rozmieszczenie obiektów liczone w globalnych współrzędnych,
więc komórki łączą się bez szwów. Wynik: assets/generated/world/.

Użycie:  python tools/worldgen.py            (cały świat)
         python tools/worldgen.py 1,1 0,2    (wybrane komórki + wspólne sprite'y)"""
import json
import os
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixelkit as K          # noqa: E402
import props                  # noqa: E402
import terrain as TR          # noqa: E402
from pixelkit import hsh, vnoise, fbm, stretch   # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'generated' / 'world'

T = 32                  # tekseli na kafel
TILES = 40
C = T * TILES           # bok komórki w tekselach
M = 128                 # margines (widok na sąsiada)
N = C + 2 * M
GRID = 3
BASE = 48               # poziom gruntu (poziomy co 24)
CELLW = 4               # rozdzielczość siatki chodzenia (tekseli)
BW = 8                  # grubość pasma głębi
MAXH = 240              # zapas na najwyższe obiekty (wieża)
X0 = N
Y0 = MAXH
W = 2 * N
HS = N + MAXH + 8
CTR = 1.5 * C           # środek świata (= środek miasta)

# biomy: nazwa, paleta trawy, progi wzgórz (wyż, szczyt, niż), gęstość drzew/krzaków/kamieni, ciemne drzewa
BIOMES = {
    'town':       dict(pal=0, hi=2.0, top=2.0, lo=-1.0, tree=0.03, bush=0.10, rock=0.00, dark=0.0),
    'meadow':     dict(pal=0, hi=0.80, top=2.0, lo=-1.0, tree=0.07, bush=0.30, rock=0.03, dark=0.1),
    'forest':     dict(pal=0, hi=0.78, top=2.0, lo=-1.0, tree=0.50, bush=0.25, rock=0.03, dark=0.3),
    'hills':      dict(pal=0, hi=0.62, top=0.80, lo=-1.0, tree=0.14, bush=0.15, rock=0.18, dark=0.2),
    'river':      dict(pal=0, hi=0.84, top=2.0, lo=-1.0, tree=0.12, bush=0.25, rock=0.05, dark=0.1),
    'ruins':      dict(pal=0, hi=0.74, top=2.0, lo=0.22, tree=0.16, bush=0.20, rock=0.10, dark=0.4),
    'darkforest': dict(pal=2, hi=0.74, top=2.0, lo=-1.0, tree=0.60, bush=0.20, rock=0.04, dark=0.9),
    'cemetery':   dict(pal=1, hi=0.86, top=2.0, lo=-1.0, tree=0.08, bush=0.08, rock=0.04, dark=0.9),
    'crags':      dict(pal=0, hi=0.58, top=0.74, lo=0.28, tree=0.06, bush=0.10, rock=0.34, dark=0.3),
}
PALS = [K.G, K.GD, K.GN]
CELLS = {
    (0, 0): ('Ruiny', 'ruins'), (1, 0): ('Łąki', 'meadow'), (2, 0): ('Ciemny las', 'darkforest'),
    (0, 1): ('Las', 'forest'), (1, 1): ('Miasto', 'town'), (2, 1): ('Wzgórza', 'hills'),
    (0, 2): ('Cmentarz', 'cemetery'), (1, 2): ('Brzeg rzeki', 'river'), (2, 2): ('Urwiska', 'crags'),
}


def biome_at(ci, cj):
    ci, cj = min(max(ci, 0), GRID - 1), min(max(cj, 0), GRID - 1)
    return BIOMES[CELLS[(ci, cj)][1]]


def interp(gu, gv, key):
    """Parametr biomu interpolowany dwuliniowo między środkami komórek (gładkie przejścia)."""
    fu, fv = gu / C - 0.5, gv / C - 0.5
    i0, j0 = np.floor(fu).astype(int), np.floor(fv).astype(int)
    tu, tv = np.clip(fu - i0, 0, 1), np.clip(fv - j0, 0, 1)
    tab = np.array([[biome_at(i, j)[key] for i in range(-1, GRID + 1)] for j in range(-1, GRID + 1)], np.float32)
    g = lambda i, j: tab[np.clip(j + 1, 0, GRID + 1), np.clip(i + 1, 0, GRID + 1)]
    return (g(i0, j0) * (1 - tu) * (1 - tv) + g(i0 + 1, j0) * tu * (1 - tv) + g(i0, j0 + 1) * (1 - tu) * tv + g(i0 + 1, j0 + 1) * tu * tv)


def river_v(gu):
    return 2.45 * C + 140 * np.sin(gu / 420.0) + 60 * np.sin(gu / 170.0 + 1.0)


# ------------------------------------------------------------------ miasto (komórka 1,1), współrzędne globalne
def rect(cu, cv, hu, hv):
    return dict(u0=int(CTR + cu - hu), u1=int(CTR + cu + hu), v0=int(CTR + cv - hv), v1=int(CTR + cv + hv))


TOWN_WALL = (C + 150, 2 * C - 150)       # mur miejski: kwadrat
GATE = 44                                # połowa szerokości bramy
HOUSES = [  # (środek u, środek v względem środka miasta, pół-wymiary, wysokość dachu)
    (-260, -130, 48, 48, 56, 'shop'), (-400, -300, 48, 40, 56, None), (-250, -330, 40, 40, 48, None),
    (-300, 220, 48, 48, 56, None), (-420, 360, 40, 48, 48, None), (-200, 400, 40, 32, 48, None),
    (230, 260, 48, 40, 56, None), (400, 220, 40, 40, 48, None), (300, 420, 48, 36, 56, None),
    (230, -420, 40, 40, 48, None), (420, -250, 36, 48, 48, None),
]
TOWER = (300, -280, 22, 22)              # wieża (jak w dawnym kadrze) w ćwiartce NE
SPAWN = (CTR - 70, CTR + 70)


def town_buildings():
    bs = []
    for (cu, cv, hu, hv, h, tag) in HOUSES:
        r = rect(cu, cv, hu, hv)
        bs.append(dict(r, base=BASE, top=BASE + h, mat=TR.ROOF, tag=tag, door=True, window=True, winz=14))
    r = rect(TOWER[0], TOWER[1], TOWER[2], TOWER[3])
    bs.append(dict(r, base=BASE + 8, top=BASE + 8 + 118, mat=TR.WALL, tag='tower', door=True, window=True, plinth=8))
    return bs


def cemetery_graves():
    gs = []
    cu0, cv0 = 0.18 * C, 2 * C + 0.12 * C
    for j in range(7):
        for i in range(9):
            u = cu0 + i * 56 + 10 * hsh(i, j, 3)
            v = cv0 + j * 48 + 8 * hsh(i, j, 4)
            if hsh(i, j, 5) < 0.18:
                continue
            gs.append((int(u), int(v)))
    return gs


def ruin_walls():
    """Fragmenty murów w komórce (0,0): odcinki wzdłuż u lub v z przerwami."""
    rr = np.random.default_rng(17)
    segs = []
    for k in range(26):
        u = rr.uniform(0.12, 0.88) * C
        v = rr.uniform(0.12, 0.88) * C
        L = rr.uniform(60, 180)
        along_u = rr.random() < 0.5
        h = int(rr.choice([16, 24, 32, 40]))
        segs.append((u, v, L, along_u, h))
    return segs


# ------------------------------------------------------------------ ukształtowanie
def layout(gu, gv):
    """H i MAT dla tablic globalnych współrzędnych; plus lista budynków."""
    n = stretch(fbm(gu, gv, 5, (320, 160, 80, 40), (1, .5, .25, .12)))
    hi, top, lo = interp(gu, gv, 'hi'), interp(gu, gv, 'top'), interp(gu, gv, 'lo')
    H = np.full(gu.shape, BASE, np.int32)
    MAT = np.zeros(gu.shape, np.int8)
    H[n > hi] = BASE + 24
    H[n > top] = BASE + 48
    H[n < lo] = BASE - 24
    # dróżki ziemne pod drzewami
    dirt = (stretch(fbm(gu, gv, 7)) > 0.78)
    MAT[dirt] = TR.DIRT
    # drogi: osie świata przez środek miasta
    jit = (vnoise(gu, gv, 40, 91) - 0.5) * 14
    dU, dV = np.abs(gu - CTR + jit), np.abs(gv - CTR - jit)
    near_road = (dU < 70) | (dV < 70)
    H[near_road] = BASE
    road = (dU < 15) | (dV < 15)
    MAT[road] = TR.PATH
    # rzeka z mostem
    rd = np.abs(gv - river_v(gu))
    bank = rd < 96
    H[bank & (H > BASE)] = BASE
    lowbank = (rd < 70) & ~(dU < 22)
    H[lowbank] = BASE - 24
    MAT[lowbank & (MAT == TR.PATH)] = TR.GRASS
    water = rd < 44
    H[water] = 0
    MAT[water] = TR.WATER
    bridge = (dU < 20) & (rd < 60)
    H[bridge] = BASE
    MAT[bridge] = TR.WOOD
    railing = bridge & (dU >= 17)
    H[railing] = BASE + 6
    # miasto: wyrównany teren, plac, mur z bramami
    town = (gu > C + 40) & (gu < 2 * C - 40) & (gv > C + 40) & (gv < 2 * C - 40)
    H[town] = BASE
    MAT[town & (MAT == TR.DIRT)] = TR.GRASS
    plaza = town & (np.abs(gu - CTR) < 150) & (np.abs(gv - CTR) < 150)
    MAT[plaza] = TR.PAVE
    a0, a1 = TOWN_WALL
    ring = ((np.abs(gu - a0) < 7) | (np.abs(gu - a1) < 7)) & (gv > a0 - 7) & (gv < a1 + 7)
    ring |= ((np.abs(gv - a0) < 7) | (np.abs(gv - a1) < 7)) & (gu > a0 - 7) & (gu < a1 + 7)
    gate = (np.abs(gu - CTR) < GATE) | (np.abs(gv - CTR) < GATE)
    tower_merlon = ring & ((((gu + gv) // 10) % 2) == 0)
    H[ring & ~gate] = BASE + 36
    H[ring & ~gate & tower_merlon] = BASE + 42
    MAT[ring & ~gate] = TR.WALL
    # baszty przy bramach
    for (pu_, pv_) in [(CTR - GATE - 10, a0), (CTR + GATE + 10, a0), (CTR - GATE - 10, a1), (CTR + GATE + 10, a1),
                       (a0, CTR - GATE - 10), (a0, CTR + GATE + 10), (a1, CTR - GATE - 10), (a1, CTR + GATE + 10)]:
        bt = (np.abs(gu - pu_) < 14) & (np.abs(gv - pv_) < 14)
        H[bt] = BASE + 56
        H[bt & ((((gu + gv) // 8) % 2) == 0) & ((np.abs(gu - pu_) > 9) | (np.abs(gv - pv_) > 9))] = BASE + 62
        MAT[bt] = TR.WALL
    buildings = town_buildings()
    for b in buildings:
        pl = b.get('plinth', 0)
        if pl:
            m = (gu >= b['u0'] - 8) & (gu <= b['u1'] + 8) & (gv >= b['v0'] - 8) & (gv <= b['v1'] + 8)
            H[m] = b['base']; MAT[m] = TR.PAVE
        m = (gu >= b['u0']) & (gu <= b['u1']) & (gv >= b['v0']) & (gv <= b['v1'])
        H[m] = b['top']; MAT[m] = b['mat']
        if b['tag'] == 'tower':
            ringb = m & (((gu - b['u0']) < 4) | ((b['u1'] - gu) < 4) | ((gv - b['v0']) < 4) | ((b['v1'] - gv) < 4))
            merlon = ringb & ((((gu - b['u0']) // 7 + (gv - b['v0']) // 7) % 2) == 0)
            H[merlon] = b['top'] + 10
        else:
            # ścieżka do drzwi (+u)
            dc = (b['v0'] + b['v1']) / 2
            walk = (gu > b['u1']) & (gu < b['u1'] + 40) & (np.abs(gv - dc) < 10) & town
            MAT[walk & (MAT == TR.GRASS)] = TR.PAVE
    # cmentarz: nagrobki
    for (u, v) in cemetery_graves():
        m = (np.abs(gu - u) < 5) & (np.abs(gv - v) < 3)
        H[m] = np.maximum(H[m], BASE + 10); MAT[m] = TR.WALL
        m2 = (np.abs(gu - u) < 9) & (np.abs(gv - v - 8) < 6) & (MAT == TR.GRASS)
        MAT[m2] = TR.DIRT
    # ruiny: fragmenty murów i posadzki
    for (u, v, L, along_u, h) in ruin_walls():
        if along_u:
            m = (gu > u) & (gu < u + L) & (np.abs(gv - v) < 5)
            gap = (hsh(np.floor((gu - u) / 18), 7, int(u)) < 0.25)
        else:
            m = (gv > v) & (gv < v + L) & (np.abs(gu - u) < 5)
            gap = (hsh(np.floor((gv - v) / 18), 8, int(v)) < 0.25)
        m &= (H == BASE) & ~gap
        top_ = BASE + h - (hsh(np.floor(gu / 9), np.floor(gv / 9), 9) * 3).astype(np.int32) * 6
        H[m] = np.maximum(H[m], top_[m]); MAT[m] = TR.WALL
        fl_ = (np.abs(gu - (u + (L / 2 if along_u else 0))) < 60) & (np.abs(gv - (v + (0 if along_u else L / 2))) < 40)
        MAT[fl_ & (MAT == TR.GRASS) & (H == BASE) & (hsh(np.floor(gu / 7), np.floor(gv / 7), 11) > 0.35)] = TR.PAVE
    # granica świata: wysoki klif
    out = (gu < 0) | (gv < 0) | (gu >= GRID * C) | (gv >= GRID * C)
    H[out] = BASE + 72
    MAT[out & (MAT != TR.GRASS)] = TR.GRASS
    return H, MAT, buildings


# ------------------------------------------------------------------ biblioteka sprite'ów (wspólna)
TREE_VARIANTS = [(26 + 2 * k, 300 + k, 16 + k % 4 * 3, k >= 10) for k in range(16)]
BUSH_VARIANTS = [(7 + k % 4, 500 + k) for k in range(8)]
ROCK_VARIANTS = [(10 + 2 * k, 700 + k) for k in range(8)]


def rgba(col, al):
    a = np.zeros(al.shape + (4,), np.uint8)
    a[..., :3] = np.clip(col, 0, 255)
    a[..., 3] = al * 255
    return a


def build_sprites():
    spr = {}
    for i, (R, sd, th, dk) in enumerate(TREE_VARIANTS):
        col, al, anc = props.tree(R, sd, th, 7 + R // 10, dk)
        can = props.tree.canopy & al
        spr[f'tree{i}_t'] = (rgba(col, al & ~can), anc)
        spr[f'tree{i}_c'] = (rgba(col, can), anc)
    for i, (R, sd) in enumerate(BUSH_VARIANTS):
        col, al, anc = props.bush(R, sd)
        spr[f'bush{i}'] = (rgba(col, al), anc)
    for i, (rw, sd) in enumerate(ROCK_VARIANTS):
        col, al, anc = props.rock(rw, sd)
        spr[f'rock{i}'] = (rgba(col, al), anc)
    col, al, anc = props.chest()
    spr['chest'] = (rgba(col, al), anc)
    import hero9
    for nm, a_ in hero9.all_frames().items():
        spr[nm] = (a_, (14, 41))
    col, al = props.pixmap(props.DOG, props.DP)
    d0 = rgba(col, al)
    d1 = d0.copy()
    part = d0[8:11, 0:16].copy(); d1[8:11, 0:16] = 0
    for r_ in range(part.shape[0]):
        m = part[r_, :, 3] > 0
        d1[8 + r_ - 1, 0:16][m] = part[r_][m]
    spr['dog0'] = (d0, (7, 10)); spr['dog1'] = (d1, (7, 10))
    sh = np.zeros((7, 21, 4), np.uint8)
    yy_, xx_ = np.mgrid[0:7, 0:21]
    e = ((xx_ - 10) / 10) ** 2 + ((yy_ - 3) / 3.2) ** 2 + K.BAYER[yy_ % 4, xx_ % 4] * 0.3
    sh[e < 1] = (10, 20, 30, 110)
    spr['shadow'] = (sh, (10, 3))
    items = sorted(spr.items(), key=lambda kv: -kv[1][0].shape[0])
    SW = 1024
    x = y = rowh = 0
    frames = {}
    for nm, (a_, anc) in items:
        h_, w_ = a_.shape[:2]
        if x + w_ + 2 > SW:
            x, y, rowh = 0, y + rowh + 2, 0
        frames[nm] = [x + 1, y + 1, w_, h_, int(anc[0]), int(anc[1])]
        x += w_ + 2
        rowh = max(rowh, h_)
    atl = np.zeros((y + rowh + 2, SW, 4), np.uint8)
    for nm, (a_, anc) in items:
        fx, fy, w_, h_ = frames[nm][:4]
        atl[fy:fy + h_, fx:fx + w_] = a_
    Image.fromarray(atl).save(OUT / 'sprites.png')
    return frames, {k: v[0].shape[:2] for k, v in spr.items()}


# ------------------------------------------------------------------ obiekty: siatka globalna z losowym przesunięciem
PROP_STEP = 40


def props_in(gu0, gv0, gu1, gv1):
    """Kandydaci obiektów w prostokącie współrzędnych globalnych (deterministycznie, niezależnie od komórki)."""
    out = []
    for gj in range(int(gv0 // PROP_STEP) - 1, int(gv1 // PROP_STEP) + 2):
        for gi in range(int(gu0 // PROP_STEP) - 1, int(gu1 // PROP_STEP) + 2):
            u = gi * PROP_STEP + float(hsh(gi, gj, 1)) * PROP_STEP
            v = gj * PROP_STEP + float(hsh(gi, gj, 2)) * PROP_STEP
            if not (gu0 <= u < gu1 and gv0 <= v < gv1):
                continue
            b = biome_at(int(u // C), int(v // C))
            r = float(hsh(gi, gj, 3))
            pick = float(hsh(gi, gj, 4))
            if r < b['tree']:
                dark = float(hsh(gi, gj, 5)) < b['dark']
                idx = 10 + int(pick * 6) if dark else int(pick * 10)
                out.append(('tree', idx, u, v))
            elif r < b['tree'] + b['bush']:
                out.append(('bush', int(pick * len(BUSH_VARIANTS)), u, v))
            elif r < b['tree'] + b['bush'] + b['rock']:
                out.append(('rock', int(pick * len(ROCK_VARIANTS)), u, v))
    return out


# ------------------------------------------------------------------ komórka
def gen_cell(ci, cj, sizes):
    name, biome = CELLS[(ci, cj)]
    ou, ov = ci * C, cj * C                       # początek komórki w globalnych
    iv, iu = np.mgrid[0:N, 0:N]
    gu = (ou - M + iu).astype(np.float32)
    gv = (ov - M + iv).astype(np.float32)
    H, MAT, buildings = layout(gu, gv)
    gui, gvi = gu.astype(np.int64), gv.astype(np.int64)
    # paleta trawy: komórka z poszarpaną granicą (szum), żeby nie było prostej linii
    jit = (vnoise(gu, gv, 30, 13) - 0.5) * 90
    pc = np.clip(((gu + jit) // C).astype(int), 0, GRID - 1)
    pr = np.clip(((gv - jit) // C).astype(int), 0, GRID - 1)
    gpid = np.zeros((N, N), np.int8)
    for (i, j), (_, bn) in CELLS.items():
        gpid[(pc == i) & (pr == j)] = BIOMES[bn]['pal']

    # obiekty
    free_mat = (MAT == TR.GRASS) | (MAT == TR.DIRT)
    Hpad = ndi.minimum_filter(H, 9) == ndi.maximum_filter(H, 9)
    clear = ndi.distance_transform_edt(free_mat & Hpad)
    placed = []
    for (kind, idx, u, v) in props_in(ou - M + 4, ov - M + 4, ou + C + M - 4, ov + C + M - 4):
        lu, lv = int(u - ou + M), int(v - ov + M)
        need = 14 if kind == 'tree' else 8 if kind == 'bush' else 6
        if clear[lv, lu] < need:
            continue
        if kind == 'tree' and (abs(u - CTR) < 60 or abs(v - CTR) < 60):
            continue
        placed.append((kind, idx, u, v, lu, lv))
    # skrzynia przy sklepie
    shop = next(b for b in buildings if b['tag'] == 'shop')
    shop_door = (shop['u1'] + 20, (shop['v0'] + shop['v1']) / 2)
    chest_uv = (shop['u1'] + 14, shop['v0'] - 10)

    # render terenu (z wypiekanymi cieniami obiektów)
    R = TR.render(gui, gvi, H, MAT, buildings, PALS, W, HS, X0, Y0, seed=ci * 3 + cj, gpid=gpid)
    img, dep, kind = R['img'], R['dep'], R['kind']

    def to_screen(lu, lv):
        h = int(H[int(lv), int(lu)])
        return int(lu - lv + X0), int((lu + lv) // 2 - h + Y0)

    def ground_shadow(x, y, rx, ry, k=0.6, dx=0.0):
        x0, x1 = int(max(0, x + dx - rx - 2)), int(min(W, x + dx + rx + 3))
        y0, y1 = int(max(0, y - ry - 2)), int(min(HS, y + ry + 3))
        if x1 <= x0 or y1 <= y0:
            return
        yy, xx = np.mgrid[y0:y1, x0:x1]
        e = ((xx - x - dx) / rx) ** 2 + ((yy - y) / ry) ** 2 + K.BAYER[yy % 4, xx % 4] * 0.25
        kd = kind[y0:y1, x0:x1]
        m = (e < 1) & (kd >= 0) & (kd != TR.CLIFF_KIND) & (kd != TR.WATER)
        sub = img[y0:y1, x0:x1]
        sub[m] = sub[m] * k * np.array([0.85, 0.95, 1.15])

    ents = []
    rr = np.random.default_rng(ci * 7 + cj)
    for (kd_, idx, u, v, lu, lv) in placed:
        x, y = to_screen(lu, lv)
        z = int(lu + lv - 2 * M)
        if kd_ == 'tree':
            R_ = TREE_VARIANTS[idx][0]
            ground_shadow(x, y, R_ * 1.15, R_ * 0.42, 0.62, dx=R_ * 0.55)
            ents.append(dict(k='tree', s=[f'tree{idx}_t', f'tree{idx}_c'], x=x, y=y, z=z, ph=round(float(rr.random() * 6.28), 3)))
        elif kd_ == 'bush':
            R_ = BUSH_VARIANTS[idx][0]
            ground_shadow(x, y + 1, R_, R_ * 0.4, 0.65, dx=R_ * 0.4)
            ents.append(dict(k='bush', s=[f'bush{idx}'], x=x, y=y, z=z, ph=round(float(rr.random() * 6.28), 3)))
        else:
            ents.append(dict(k='prop', s=[f'rock{idx}'], x=x, y=y, z=z))
    if (ci, cj) == (1, 1):
        lu, lv = chest_uv[0] - ou + M, chest_uv[1] - ov + M
        x, y = to_screen(lu, lv)
        ground_shadow(x + 4, y, 17, 5, 0.6)
        ents.append(dict(k='prop', s=['chest'], x=x, y=y, z=int(lu + lv - 2 * M)))

    # ---- woda: dane do animacji na CPU
    wm = kind == TR.WATER
    pu_l = np.clip(R['pu'] - ou + M, 0, N - 1)
    pv_l = np.clip(R['pv'] - ov + M, 0, N - 1)
    depthn = np.clip(R['dist'] / 70, 0, 1)
    base = 5.6 - 4.4 * depthn + 0.8 * (R['wn'] - 0.5) - 1.6 * R['shadow']
    q = R['dist'] - 3.0 * R['foamn']
    B_ = base[pv_l, pu_l]; WF = R['wf'][pv_l, pu_l]; WF2 = R['wf2'][pv_l, pu_l]; Q = q[pv_l, pu_l]
    wr = np.zeros((HS, W, 3), np.uint8)
    wr[..., 0] = np.where(wm, np.clip(B_ * 18 + 1, 1, 255), 0)
    wr[..., 1] = np.where(wm, np.clip(WF * 255, 0, 255), 0)
    wr[..., 2] = np.where(wm, np.clip(WF2 * 255, 0, 255), 0)
    wq = np.where(wm, np.clip((Q + 4) * 20, 0, 255), 0).astype(np.uint8)
    d = OUT / f'c{ci}{cj}'
    d.mkdir(parents=True, exist_ok=True)
    Image.fromarray(wr).save(d / 'water_a.png', optimize=True)
    Image.fromarray(wq).save(d / 'water_b.png', optimize=True)

    # ---- teren: jeden obraz pod postaciami + pasma głębi tylko dla tego, co może je zasłonić
    # (ściany, klify, dachy i wierzchy wyższe od terenu w promieniu 64 tekseli)
    land = (kind >= 0) & ~wm
    base_rgba = np.zeros((HS, W, 4), np.uint8)
    base_rgba[..., :3] = np.clip(img, 0, 255)
    base_rgba[..., 3] = np.where(land, 255, 0)
    Image.fromarray(base_rgba).save(d / 'ground.webp', lossless=True, quality=100, method=6)
    raised = H > ndi.minimum_filter(H, size=129)
    occ = land & ((kind == TR.CLIFF_KIND) | raised[pv_l, pu_l])
    band = np.where(occ, dep // (2 * BW), -1)
    pieces = []
    CH = 256
    for b in np.unique(band[band >= 0]):
        m = band == b
        ys_, xs_ = np.nonzero(m)
        for cx0 in range(int(xs_.min() // CH) * CH, int(xs_.max()) + 1, CH):
            sel = (xs_ >= cx0) & (xs_ < cx0 + CH)
            if not sel.any():
                continue
            y0, y1 = ys_[sel].min(), ys_[sel].max() + 1
            x0, x1 = xs_[sel].min(), xs_[sel].max() + 1
            tile = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
            tile[..., :3] = np.clip(img[y0:y1, x0:x1], 0, 255)
            tile[..., 3] = np.where(m[y0:y1, x0:x1], 255, 0)
            pieces.append((int(b), x0, y0, tile))
    AW = 2048
    x = y = rowh = 0
    placed_b = []
    for (b, x0, y0, t) in sorted(pieces, key=lambda p: -p[3].shape[0]):
        h_, w_ = t.shape[:2]
        if x + w_ + 1 > AW:
            x, y, rowh = 0, y + rowh + 1, 0
        placed_b.append((b, x0, y0, x, y, t))
        x += w_ + 1
        rowh = max(rowh, h_)
    AH = max(1, y + rowh + 1)
    atl = np.zeros((AH, AW, 4), np.uint8)
    bands = []
    for (b, x0, y0, ax, ay, t) in placed_b:
        atl[ay:ay + t.shape[0], ax:ax + t.shape[1]] = t
        bands.append(dict(z=int(b) * BW - 2 * M, x=int(x0), y=int(y0), ax=int(ax), ay=int(ay), w=int(t.shape[1]), h=int(t.shape[0])))
    Image.fromarray(atl).save(d / 'bands.webp', lossless=True, quality=100, method=6)

    # ---- mapa wyboru (piksel → teksel lokalny + OFF) i siatka chodzenia
    pk = np.full((HS, W), 0xFFFFFF, np.int64)
    ok = (R['pu'] > -90000) & (kind >= 0)
    pk[ok] = (pu_l[ok].astype(np.int64) << 11) | pv_l[ok]
    Image.fromarray(np.dstack([(pk >> 16) & 255, (pk >> 8) & 255, pk & 255]).astype(np.uint8)).save(d / 'pick.png', optimize=True)
    NC = N // CELLW
    Hc = H[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    Mc = MAT[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    Gc = gu[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC], gv[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    walk = np.isin(Mc, TR.WALKABLE) & (Hc < BASE + 60)
    walk &= (Gc[0] >= 0) & (Gc[1] >= 0) & (Gc[0] < GRID * C) & (Gc[1] < GRID * C)
    for (kd_, idx, u, v, lu, lv) in placed:
        r = 2 if kd_ == 'tree' else 1
        cic, cjc = lu // CELLW, lv // CELLW
        walk[max(0, cjc - r):cjc + r + 1, max(0, cic - r):cic + r + 1] = False
    if (ci, cj) == (1, 1):
        cic, cjc = int((chest_uv[0] - ou + M) // CELLW), int((chest_uv[1] - ov + M) // CELLW)
        walk[cjc - 3:cjc + 4, cic - 4:cic + 4] = False
    # usuń małe odcięte wysepki (np. wnętrza ruin)
    lab, nl = ndi.label(walk, structure=np.ones((3, 3)))
    if nl:
        sizes_ = ndi.sum(walk, lab, range(1, nl + 1))
        small = np.isin(lab, 1 + np.nonzero(sizes_ < 400)[0])
        walk &= ~small
    wg = np.where(walk, np.clip(Hc + 1, 1, 254), 0).astype(np.uint8)
    Image.fromarray(wg).save(d / 'walk.png')

    meta = dict(cx=ci, cy=cj, name=name, biome=biome, W=W, H=HS, X0=X0, Y0=Y0 + M, OFF=M, N=N, CELL=CELLW, NC=NC,
                size=C, bands=bands, ents=ents)
    json.dump(meta, open(d / 'meta.json', 'w'), separators=(',', ':'))
    (ROOT / 'build_tmp').mkdir(exist_ok=True)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(ROOT / 'build_tmp' / f'preview_c{ci}{cj}.png')
    extra = {}
    if (ci, cj) == (1, 1):
        extra = dict(shop=[float(shop_door[0] - ou), float(shop_door[1] - ov)], spawn=[float(SPAWN[0] - ou), float(SPAWN[1] - ov)])
    sz = sum(os.path.getsize(d / f) for f in ['ground.webp', 'bands.webp', 'water_a.png', 'water_b.png', 'pick.png', 'walk.png', 'meta.json'])
    print(f'komórka {ci},{cj} {name}: pasma {len(bands)}, atlas pasm {AW}×{AH}, obiekty {len(ents)}, {sz / 1e6:.1f} MB', flush=True)
    return (ci, cj), extra


def _job(args):
    return gen_cell(*args)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    frames, sizes = build_sprites()
    want = [tuple(int(x) for x in a.split(',')) for a in sys.argv[1:]] or sorted(CELLS)
    with Pool(min(3, len(want))) as pool:
        results = pool.map(_job, [(i, j, sizes) for (i, j) in want])
    town = dict(results).get((1, 1))
    wpath = OUT / 'world.json'
    world = json.load(open(wpath)) if wpath.exists() else {}
    world.update(dict(
        grid=GRID, tiles=TILES, cellSize=C,
        cells=[dict(cx=i, cy=j, name=CELLS[(i, j)][0], biome=CELLS[(i, j)][1], dir=f'c{i}{j}') for (i, j) in sorted(CELLS)],
        frames=frames, WA=K.WA.astype(int).tolist(), BAYER=(K.BAYER + 0.47).tolist(),
    ))
    if town:
        world['start'] = dict(cx=1, cy=1, u=town['spawn'][0], v=town['spawn'][1])
        world['shop'] = dict(cx=1, cy=1, u=town['shop'][0], v=town['shop'][1])
    json.dump(world, open(wpath, 'w'), separators=(',', ':'))
    print('świat zapisany:', wpath)


if __name__ == '__main__':
    main()
