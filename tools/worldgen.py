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
import props2                 # noqa: E402
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


# most: drewniana kładka nad rzeką na drodze południowej (osobny sprite – pod nim płynie woda)
BR_HALF_W, BR_HALF_L, BR_H = 18, 112, BASE + 2
BRIDGE = dict(u0=int(CTR - BR_HALF_W), u1=int(CTR + BR_HALF_W), v0=int(river_v(CTR) - BR_HALF_L), v1=int(river_v(CTR) + BR_HALF_L))


# ------------------------------------------------------------------ obrót widoku (4 widoki co 90°)
ROTS = tuple(int(x) for x in os.environ.get('WG_ROTS', '0,1,2,3').split(','))   # np. WG_ROTS=0 – szybki podgląd


def rot_pt(u, v, r):
    """punkt świata (u, v) → współrzędne widoku obróconego o r×90° (p, q); obrót kwadratu świata wokół jego środka"""
    G1 = GRID * C - 1
    return [(u, v), (v, G1 - u), (G1 - u, G1 - v), (G1 - v, u)][r % 4]


def rot_vec(du, dv, r):
    """wektor świata → wektor w widoku r"""
    for _ in range(r % 4):
        du, dv = dv, -du
    return du, dv


def rot_building(b, r):
    """budynek w układzie widoku r: prostokąt, oś dachu, strona drzwi (tylko widoczne ściany +p/+q), liczba okien"""
    if r == 0:
        return b
    (p0, q0), (p1, q1) = rot_pt(b['u0'], b['v0'], r), rot_pt(b['u1'], b['v1'], r)
    nb = dict(b, u0=min(p0, p1), u1=max(p0, p1), v0=min(q0, q1), v1=max(q0, q1))
    if r % 2:
        nb['roof'] = {'gable_u': 'gable_v', 'gable_v': 'gable_u'}.get(b['roof'], b['roof'])
        nb['wins_u'], nb['wins_v'] = b.get('wins_v', 0), b.get('wins_u', 0)
    door = None
    if b.get('door') in ('u', 'v'):
        n = rot_vec(*((1, 0) if b['door'] == 'u' else (0, 1)), r)
        door = 'u' if n == (1, 0) else 'v' if n == (0, 1) else None
    nb['door'] = door
    return nb


def bridge_sprite(transpose=False):
    """pomost wzdłuż v; transpose=True – ten sam most wzdłuż u (widok obrócony o 90°)"""
    pad = 6
    L, Wd = BRIDGE['v1'] - BRIDGE['v0'], BRIDGE['u1'] - BRIDGE['u0']
    S = L + 2 * pad
    iv, iu = np.mgrid[0:S, 0:S]
    u = iu - pad; v = iv - pad
    deck = (u >= 0) & (u < Wd) & (v >= 0) & (v < L)
    H = np.full((S, S), BR_H - 4, np.int32)
    MAT = np.full((S, S), TR.WOOD, np.int8)
    H[deck] = BR_H
    edge = deck & ((u < 3) | (u >= Wd - 3))
    H[edge] = BR_H + 5
    post = edge & ((v % 22) < 3)
    H[post] = BR_H + 13
    # pale pod mostem: przed przednią krawędzią (+u) teren głęboko, więc krawędź pomostu schodzi do wody
    vc = L / 2
    for pv_ in (vc - 34, vc, vc + 34):
        H[(u == Wd) & (np.abs(v - pv_) < 5)] = 0
        H[(u >= 0) & (u < Wd) & (v == L) & (np.abs(u - Wd / 2) < 4) & (abs(pv_ - vc) < 1)] = BR_H - 4
    Wi, Hs_ = 2 * S, S + 40 + BR_H
    if transpose:
        H, MAT = H.T.copy(), MAT.T.copy()
    R = TR.render(u, v, H, MAT, [], PALS, Wi, Hs_, S, 40 + BR_H, seed=5, wood_axis='u' if transpose else 'v')
    lu_, lv_ = (L, Wd) if transpose else (Wd, L)
    keep = (R['pu'] >= 0) & (R['pu'] < lu_) & (R['pv'] >= 0) & (R['pv'] < lv_) & (R['kind'] >= 0)
    ys, xs = np.nonzero(keep)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = np.clip(R['img'][y0:y1, x0:x1], 0, 255)
    rgba[..., 3] = np.where(keep[y0:y1, x0:x1], 255, 0)
    # kotwica = teksel (0, 0) pomostu na wysokości BR_H
    ax = (0 - 0 + pad - pad) + S - x0
    ay = (2 * pad) // 2 - BR_H + 40 + BR_H - y0
    return rgba, (int(ax), int(ay))


def lamp_sprite():
    w, h = 11, 40
    a = np.zeros((h, w, 4), np.uint8)
    def put(x0, x1, y0, y1, c):
        a[y0:y1, x0:x1, :3] = K.hexs([c])[0]; a[y0:y1, x0:x1, 3] = 255
    put(4, 7, 9, 36, '#3a3640'); put(4, 5, 9, 36, '#5a5662'); put(6, 7, 9, 36, '#24222a')
    put(2, 9, 35, 39, '#6c6a72'); put(2, 4, 35, 39, '#8a8890'); put(7, 9, 35, 39, '#4a4850')
    put(2, 9, 2, 10, '#24222a'); put(3, 8, 3, 9, '#ffd060'); put(3, 5, 3, 9, '#fff0a8'); put(7, 8, 3, 9, '#e8a030')
    put(5, 6, 3, 9, '#3a3640')
    put(3, 8, 0, 2, '#3a3640'); put(5, 6, 0, 1, '#5a5662')
    al = a[..., 3] > 0
    out = ndi.binary_dilation(al) & ~al
    a[out] = (20, 14, 18, 255)
    return a, (5, 38)


def town_lamps():
    bs = town_buildings()
    lamps = []
    for d in (-410, -290, -175, 175, 290, 410):
        side = 26 if d > 0 else -26
        lamps += [(CTR + d, CTR + side), (CTR - side, CTR + d)]
    lamps += [(CTR + x, CTR + y) for x in (-160, 160) for y in (-160, 160)]
    ok = []
    for (u, v) in lamps:
        if any(b['u0'] - 12 < u < b['u1'] + 12 and b['v0'] - 12 < v < b['v1'] + 12 for b in bs):
            continue
        ok.append((float(u), float(v)))
    return ok


FOUNTAIN_R = 40                          # fontanna na środku placu
STASH = (CTR + 60, CTR - 8)               # skrzynia gracza przy fontannie
STALLS = [((CTR - 104, CTR - 62), 0, 'v'), ((CTR - 62, CTR - 104), 1, 'u'), ((CTR + 66, CTR - 104), 2, 'u')]   # (pozycja, towar, oś frontu)
PLANTERS = [(CTR + dx * 56, CTR + dy * 56) for dx in (-1, 1) for dy in (-1, 1)]
TOWNFOLK = [
    dict(name='Liwia', kind='woman', u=CTR - 38, v=CTR - 86, face=(1, 1),
         lines=['Świeże jabłka! Prosto z sadu za murami.', 'Uważaj na wilki przy drodze na Łąki.', 'Mój brat strzeże wschodniej bramy.']),
    dict(name='Dziadek Ostromir', kind='elder', u=CTR + 72, v=CTR + 22, face=(-1, 0),
         lines=['Za moich czasów smoki latały nad Ruinami…', 'Katedrę zbudowano, zanim przyszły szkielety.', 'Odpocznij, młody. Usiądź – zdrowie samo wraca.']),
]
RING = 78                                # chodnik wokół miasta: odległość od osi muru


WALL_W = 28                              # pół-szerokość muru (mur 56 tekseli)
WALL_H = 120                             # wysokość chodnika na murze nad gruntem
GATE_T, CORNER_T = 34, 44                # pół-wymiary baszt przy bramach i dużych wież w narożnikach (szersze niż mur)
GATE_TH, CORNER_TH = 160, 176            # wysokości baszt i wież
STAIR_L, STAIR_W = 120, 32               # schody: długość (30 stopni po 4 – łagodne) i szerokość


def wall_stairs():
    """schody na mur od strony miasta: po jednych na każdy odcinek muru (8), górą przy baszcie bramnej.
    (oś, pozycja muru, kierunek do środka, początek u/v na dole, koniec na górze)"""
    a0, a1 = TOWN_WALL
    off = GATE + 2 * GATE_T + 10
    st = []
    for wall_axis, wpos, inward in (('u', a0, 1), ('u', a1, -1), ('v', a0, 1), ('v', a1, -1)):
        for sgn in (-1, 1):
            top = CTR + sgn * off
            st.append((wall_axis, wpos, inward, top + sgn * STAIR_L, top))
    return st


def town_wall(gu, gv):
    """mur miejski: wysokości (H, -1 = bez zmian), maska muru i maska przechodnia (chodnik na murze + schody)"""
    a0, a1 = TOWN_WALL
    Hw = np.full(gu.shape, -1, np.int32)
    walk = np.zeros(gu.shape, bool)
    gate = (np.abs(gu - CTR) < GATE) | (np.abs(gv - CTR) < GATE)
    inner_gap = np.zeros(gu.shape, bool)
    # schody (rampa ze stopniami 6 co 4 teksele) i luka w wewnętrznym przedpiersiu przy ich górze
    for (ax, wpos, inward, bot, top) in wall_stairs():
        along, across = (gv, gu) if ax == 'u' else (gu, gv)            # mur na stałym u biegnie wzdłuż v
        face = wpos + inward * WALL_W
        lo, hi = min(bot, top), max(bot, top)
        m = (along >= lo) & (along < hi) & ((across - face) * inward >= 0) & ((across - face) * inward < STAIR_W)
        k = (np.abs(along - bot) - (along < bot)) // 4                   # stopień liczony od dolnej krawędzi (oba kierunki)
        Hw[m] = BASE + np.minimum(WALL_H, (k + 1) * 4)[m]
        walk |= m
        inner_gap |= (np.abs(along - top) < 10) & (np.abs(across - wpos) <= WALL_W)
    for (wpos, ax) in ((a0, 'u'), (a1, 'u'), (a0, 'v'), (a1, 'v')):
        across, along = (gu, gv) if ax == 'u' else (gv, gu)
        out_dir = -1 if wpos == a0 else 1
        d = (across - wpos) * out_dir                                    # >0 na zewnątrz
        body = (np.abs(across - wpos) <= WALL_W) & (along > a0 - WALL_W) & (along < a1 + WALL_W) & ~gate
        outer = body & (d > WALL_W - 4)
        inner = body & (d < -WALL_W + 3) & ~inner_gap
        Hw[body] = BASE + WALL_H
        Hw[outer] = BASE + WALL_H + 8
        Hw[outer & ((((along) // 8) % 2) == 0)] = BASE + WALL_H + 14        # blanki
        Hw[inner] = BASE + WALL_H + 5
        walk |= body & ~outer & ~inner
    # baszty przy bramach i duże wieże w narożnikach
    towers = [(CTR + s_ * (GATE + GATE_T), w, GATE_T, GATE_TH) for s_ in (-1, 1) for w in (a0, a1)]
    towers += [(w, CTR + s_ * (GATE + GATE_T), GATE_T, GATE_TH) for s_ in (-1, 1) for w in (a0, a1)]
    towers += [(x, y, CORNER_T, CORNER_TH) for x in (a0, a1) for y in (a0, a1)]
    for (pu_, pv_, r_, h_) in towers:
        bt = (np.abs(gu - pu_) < r_) & (np.abs(gv - pv_) < r_)
        Hw[bt] = BASE + h_
        rim = bt & ((np.abs(gu - pu_) > r_ - 5) | (np.abs(gv - pv_) > r_ - 5))
        Hw[rim & ((((gu + gv) // 8) % 2) == 0)] = BASE + h_ + 10
        walk &= ~bt
    return Hw, walk, gate


def house_chimney(b):
    """komin domu: (u0, u1, v0, v1, wysokość szczytu) na kalenicy, bliżej jednego końca; None dla wież, katedry i karczmy"""
    if b.get('roof', 'flat') == 'flat' or b['tag'] in ('tavern', 'church', 'church_tower', 'tower'):
        return None
    cu, cv = (b['u0'] + b['u1']) / 2, (b['v0'] + b['v1']) / 2
    hu, hv = (b['u1'] - b['u0']) / 2, (b['v1'] - b['v0']) / 2
    side = 1 if hsh(b['u0'], b['v0'], 401) > 0.5 else -1
    if b['roof'] == 'gable_u':
        pu, pv, d = cu + side * (hu - 12), cv, hv
    elif b['roof'] == 'gable_v':
        pu, pv, d = cu, cv + side * (hv - 12), hu
    else:
        pu, pv, d = cu + side * hu * 0.35, cv - hv * 0.25, min(hu, hv) * 0.6
    ridge = b['eave'] + d * b.get('pitch', 0.8)
    return (int(pu - 4), int(pu + 4), int(pv - 4), int(pv + 4), int(ridge + 14))


def town_banners():
    """sztandary: przy wylotach ulic na plac i przy bramach (od środka miasta)"""
    a0, a1 = TOWN_WALL
    pts = []
    for d in (-150, 150):
        for s_ in (-40, 40):
            pts += [(CTR + d, CTR + s_), (CTR + s_, CTR + d)]
    for s_ in (-58, 58):
        d_ = WALL_W + 60
        pts += [(a0 + d_, CTR + s_), (a1 - d_, CTR + s_), (CTR + s_, a0 + d_), (CTR + s_, a1 - d_)]
    return [(float(u), float(v)) for (u, v) in pts]


def town_flags():
    """flagi na dachach: baszty przy bramach, wieża strażnicza, wieża katedry (u, v, wysokość podstawy masztu)"""
    a0, a1 = TOWN_WALL
    g_ = GATE + GATE_T
    fl = [(CTR + s_ * g_, w, BASE + GATE_TH) for s_ in (-1, 1) for w in (a0, a1)] + [(w, CTR + s_ * g_, BASE + GATE_TH) for s_ in (-1, 1) for w in (a0, a1)]
    fl += [(x, y, BASE + CORNER_TH) for x in (a0, a1) for y in (a0, a1)]
    fl += [
          (CTR + TOWER[0], CTR + TOWER[1], BASE + 8 + 150), (CTR - 378, CTR + 240, BASE + 150 + 40)]
    return [(float(u), float(v), int(h)) for (u, v, h) in fl]


def town_guards():
    """strażnicy: po dwóch przed każdą bramą (na zewnątrz muru), z kierunkiem patrzenia"""
    a0, a1 = TOWN_WALL
    g = []
    for s_ in (-32, 32):
        o_ = WALL_W + 14
        g += [((a0 - o_, CTR + s_), (-1, 0)), ((a1 + o_, CTR + s_), (1, 0)), ((CTR + s_, a0 - o_), (0, -1)), ((CTR + s_, a1 + o_), (0, 1))]
    return [dict(u=float(u), v=float(v), fu=fu, fv=fv) for ((u, v), (fu, fv)) in g]


def town_flowers():
    """rabaty: wokół fontanny i przy wejściach do domów"""
    bs = town_buildings()
    pts = []
    for b in bs:
        if b['tag'] in ('tower', 'church_tower'):
            continue
        if b['door'] == 'u':
            dc = (b['v0'] + b['v1']) / 2
            pts += [(b['u1'] + 14, dc - 22), (b['u1'] + 14, dc + 22)]
        else:
            dc = (b['u0'] + b['u1']) / 2
            pts += [(dc - 22, b['v1'] + 14), (dc + 22, b['v1'] + 14)]
    ok = []
    for (u, v) in pts:
        if abs(u - CTR) < 22 or abs(v - CTR) < 22:
            continue
        if any(b['u0'] - 10 < u < b['u1'] + 10 and b['v0'] - 10 < v < b['v1'] + 10 for b in bs):
            continue
        if np.hypot(u - STASH[0], v - STASH[1]) < 24 or any(np.hypot(u - q[0][0], v - q[0][1]) < 30 for q in STALLS):
            continue
        ok.append((float(u), float(v)))
    return ok


# ------------------------------------------------------------------ miasto (komórka 1,1), współrzędne globalne
def rect(cu, cv, hu, hv):
    return dict(u0=int(CTR + cu - hu), u1=int(CTR + cu + hu), v0=int(CTR + cv - hv), v1=int(CTR + cv + hv))


TOWN_WALL = (C + 120, 2 * C - 120)       # mur miejski: kwadrat (oś muru)
GATE = 44                                # połowa szerokości bramy
# Domy: (środek u, v względem środka miasta, pół-wymiary hu, hv, wysokość okapu, dach, paleta dachu,
#        ściany, ściana z drzwiami ('u' = +u, 'v' = +v), okna na ścianie +v, okna na ścianie +u, znacznik)
# dach: gable_u – dwuspadowy z kalenicą wzdłuż u, gable_v – wzdłuż v, hip – czterospadowy; palety: 0 dachówka, 1 gont, 2 łupek
HOUSES = [
    (-255, -100, 56, 44, 67, 'gable_v', 0, 'stone', 'u', 2, 2, 'shop'),
    (-420, -300, 40, 56, 56, 'gable_u', 1, 'plaster', 'v', 1, 2, None),
    (-250, -360, 32, 32, 50, 'hip', 2, 'plaster', 'u', 1, 1, None),
    (-440, 380, 36, 48, 56, 'gable_v', 1, 'plaster', 'v', 2, 1, None),
    (-210, 420, 30, 30, 48, 'gable_u', 0, 'plaster', 'u', 1, 1, None),
    (-410, 110, 36, 28, 53, 'hip', 1, 'plaster', 'u', 1, 1, None),
    (240, 250, 48, 36, 62, 'gable_u', 2, 'stone', 'v', 2, 1, None),
    (420, 230, 34, 52, 87, 'gable_v', 0, 'plaster', 'u', 1, 3, None),
    (300, 430, 56, 30, 56, 'hip', 1, 'plaster', 'v', 3, 1, None),
    (230, -405, 40, 40, 67, 'hip', 0, 'plaster', 'v', 2, 2, None),
    (415, -230, 30, 44, 53, 'gable_u', 2, 'plaster', 'u', 1, 2, None),
    (220, 110, 30, 26, 48, 'gable_v', 1, 'plaster', 'v', 1, 1, None),
    # pierzeje rynku: kamienice wokół placu z fontanną
    (-200, -215, 34, 30, 70, 'gable_u', 0, 'plaster', 'v', 2, 1, None),
    (-110, -210, 28, 26, 62, 'gable_v', 0, 'plaster', 'v', 1, 1, None),
    (110, -210, 34, 28, 74, 'gable_u', 1, 'plaster', 'v', 2, 1, None),
    (210, -200, 28, 30, 60, 'hip', 0, 'plaster', 'v', 1, 1, None),
    (215, -100, 44, 42, 104, 'gable_u', 0, 'plaster', 'v', 3, 2, 'tavern'),     # karczma „Pod Złotym Kuflem” (2 piętra)
    (-205, 110, 30, 34, 64, 'gable_v', 0, 'plaster', 'u', 1, 2, None),
    (-100, 215, 34, 30, 70, 'gable_u', 0, 'plaster', 'u', 2, 1, None),
    (100, 210, 30, 30, 58, 'hip', 2, 'plaster', 'u', 1, 1, None),
]
TOWER = (300, -280, 22, 22)              # wieża (jak w dawnym kadrze) w ćwiartce NE
SPAWN = (CTR - 100, CTR + 92)          # na placu, z dala od fontanny i donic


def town_buildings():
    bs = []
    for (cu, cv, hu, hv, eave, roof, pal, walls, door, wu, wv, tag) in HOUSES:
        r = rect(cu, cv, hu, hv)
        bs.append(dict(r, base=BASE, eave=BASE + eave, roof=roof, roofpal=pal, walls=walls, door=door,
                       wins_u=wu, wins_v=wv, winz=18, mat=TR.ROOF, tag=tag, pitch=1.05))      # stromsze dachy
    # katedra: wysoka nawa z dwuspadowym dachem, duże łukowe drzwi od strony placu, okna z witrażami; wieża z iglicą z tyłu
    nave = rect(-300, 240, 64, 34)
    bs.append(dict(nave, base=BASE, eave=BASE + 86, roof='gable_u', roofpal=2, walls='stone', door='u', wins_u=4, wins_v=0,
                   winz=14, winw=6, winh=32, stained=True, doorw=18, doorh=46, pitch=1.0, mat=TR.ROOF, tag='church'))
    tw_ = rect(-378, 240, 14, 14)
    bs.append(dict(tw_, base=BASE, eave=BASE + 150, roof='hip', roofpal=2, walls='stone', door=None, wins_u=1, wins_v=1,
                   winz=96, winw=3, winh=14, stained=True, pitch=3.0, mat=TR.ROOF, tag='church_tower'))
    r = rect(TOWER[0], TOWER[1], TOWER[2], TOWER[3])
    bs.append(dict(r, base=BASE + 8, top=BASE + 8 + 150, eave=BASE + 8 + 150, roof='flat', walls='stone', door='u',
                   wins_u=1, wins_v=0, winz=60, mat=TR.WALL, tag='tower', plinth=8))
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
    # rzeka: nieregularne brzegi (szum), niższy taras przy wodzie; most to osobny sprite nad wodą
    rn = (vnoise(gu, gv, 48, 61) - 0.5) * 30 + (vnoise(gu, gv, 17, 62) - 0.5) * 12 + (vnoise(gu, gv, 7, 63) - 0.5) * 5
    rd = np.abs(gv - river_v(gu)) + rn
    bank = rd < 100
    H[bank & (H > BASE)] = BASE
    lowbank = rd < 72 + (vnoise(gu, gv, 23, 64) - 0.5) * 16
    H[lowbank] = BASE - 24
    MAT[lowbank & (MAT == TR.PATH)] = TR.GRASS
    water = rd < 44
    H[water] = 0
    MAT[water] = TR.WATER
    # miasto: wyrównany teren, plac, mur z bramami
    town = (gu > C + 40) & (gu < 2 * C - 40) & (gv > C + 40) & (gv < 2 * C - 40)
    H[town] = BASE
    MAT[town & (MAT == TR.DIRT)] = TR.GRASS
    plaza = town & (np.abs(gu - CTR) < 200) & (np.abs(gv - CTR) < 200)
    MAT[plaza] = TR.PAVE
    street = town & ((np.abs(gu - CTR) < 34) | (np.abs(gv - CTR) < 34))          # główne ulice brukowane
    street |= town & ((np.abs(np.abs(gu - CTR) - 300) < 12) | (np.abs(np.abs(gv - CTR) - 300) < 12))   # przecznice
    MAT[street] = TR.PAVE
    for b in town_buildings():                                                    # chodniki wokół domów
        side = (gu > b['u0'] - 20) & (gu < b['u1'] + 20) & (gv > b['v0'] - 20) & (gv < b['v1'] + 20)
        MAT[town & side] = TR.PAVE
    a0, a1 = TOWN_WALL
    # chodnik dookoła miasta (wzdłuż muru, od środka) – łączy bramy
    rjit = (vnoise(gu, gv, 30, 93) - 0.5) * 4
    ringw = town & (((np.abs(gu - (a0 + RING)) < 7 + rjit) | (np.abs(gu - (a1 - RING)) < 7 + rjit)) & (gv > a0 + RING - 7) & (gv < a1 - RING + 7)
                    | ((np.abs(gv - (a0 + RING)) < 7 + rjit) | (np.abs(gv - (a1 - RING)) < 7 + rjit)) & (gu > a0 + RING - 7) & (gu < a1 - RING + 7))
    MAT[ringw] = TR.PAVE
    # fontanna: kamienne obramowanie, woda, kolumna
    fr = np.hypot(gu - CTR, gv - CTR)
    H[fr < FOUNTAIN_R] = BASE + 10; MAT[fr < FOUNTAIN_R] = TR.WALL
    H[fr < FOUNTAIN_R - 6] = BASE + 3; MAT[fr < FOUNTAIN_R - 6] = TR.WATER
    H[fr < 7] = BASE + 24; MAT[fr < 7] = TR.WALL
    H[fr < 4] = BASE + 30
    MAT[(fr >= FOUNTAIN_R) & (fr < FOUNTAIN_R + 10) & town] = TR.PAVE
    Hw, _, _ = town_wall(gu, gv)
    wm = Hw >= 0
    H[wm] = Hw[wm]
    MAT[wm] = TR.WALL
    buildings = town_buildings()
    for b in buildings:
        pl = b.get('plinth', 0)
        if pl:
            m = (gu >= b['u0'] - 8) & (gu <= b['u1'] + 8) & (gv >= b['v0'] - 8) & (gv <= b['v1'] + 8)
            H[m] = b['base']; MAT[m] = TR.PAVE
        m = (gu >= b['u0']) & (gu <= b['u1']) & (gv >= b['v0']) & (gv <= b['v1'])
        if b['roof'] == 'flat':
            H[m] = b['top']
        else:
            du_ = np.minimum(gu - b['u0'], b['u1'] - gu)
            dv_ = np.minimum(gv - b['v0'], b['v1'] - gv)
            d_ = dv_ if b['roof'] == 'gable_u' else du_ if b['roof'] == 'gable_v' else np.minimum(du_, dv_)
            H[m] = (b['eave'] + np.floor(d_ * b.get('pitch', 0.8)))[m].astype(np.int32)
        MAT[m] = b['mat']
        ch = house_chimney(b)
        if ch:                                                            # kamienny komin ponad dachem
            mc = (gu >= ch[0]) & (gu <= ch[1]) & (gv >= ch[2]) & (gv <= ch[3])
            H[mc] = ch[4]; MAT[mc] = TR.WALL
        if b['tag'] == 'church_tower':
            continue
        if b['tag'] == 'tower':
            ringb = m & (((gu - b['u0']) < 4) | ((b['u1'] - gu) < 4) | ((gv - b['v0']) < 4) | ((b['v1'] - gv) < 4))
            merlon = ringb & ((((gu - b['u0']) // 7 + (gv - b['v0']) // 7) % 2) == 0)
            H[merlon] = b['top'] + 10
        else:
            # ścieżka spod drzwi
            if b['door'] == 'u':
                dc = (b['v0'] + b['v1']) / 2
                walk = (gu > b['u1']) & (gu < b['u1'] + 40) & (np.abs(gv - dc) < 10) & town
            else:
                dc = (b['u0'] + b['u1']) / 2
                walk = (gv > b['v1']) & (gv < b['v1'] + 40) & (np.abs(gu - dc) < 10) & town
            MAT[walk & (MAT == TR.GRASS)] = TR.PAVE
            # kamienny schodek przed drzwiami
            dwh = b.get('doorw', 11) + 3
            if b['door'] == 'u':
                stp = (gu > b['u1']) & (gu <= b['u1'] + 6) & (np.abs(gv - dc) < dwh)
            else:
                stp = (gv > b['v1']) & (gv <= b['v1'] + 6) & (np.abs(gu - dc) < dwh)
            H[stp & town] = b['base'] + 4; MAT[stp & town] = TR.PAVE
            # dalej chodnik prosto do najbliższej drogi lub chodnika (w kierunku wyjścia z drzwi)
            lines = [CTR, a0 + RING, a1 - RING]
            if b['door'] == 'u':
                p0 = b['u1'] + 40
                ahead = [x for x in lines if x >= p0] or [max(lines)]
                tgt = min(ahead, key=lambda x: abs(x - p0))
                conn = (gu >= p0 - 2) & (gu <= tgt) & (np.abs(gv - dc) < 7)
            else:
                p0 = b['v1'] + 40
                ahead = [x for x in lines if x >= p0] or [max(lines)]
                tgt = min(ahead, key=lambda x: abs(x - p0))
                conn = (gv >= p0 - 2) & (gv <= tgt) & (np.abs(gu - dc) < 7)
            MAT[conn & town & ((MAT == TR.GRASS) | (MAT == TR.DIRT))] = TR.PATH
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
    # granica świata: teren urywa się w pustkę (wyspa) – poza światem nisko i przezroczyście
    out = (gu < 0) | (gv < 0) | (gu >= GRID * C) | (gv >= GRID * C)
    H[out] = -96
    MAT[out] = TR.GRASS
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
    spr['bridge'] = bridge_sprite()
    spr['bridge_t'] = bridge_sprite(transpose=True)
    spr['lamp'] = props2.lamp_big()
    spr['shopsign'] = props2.shop_sign()
    a_, anc = props2.shop_sign()
    spr['shopsign_m'] = (np.ascontiguousarray(a_[:, ::-1]), (a_.shape[1] - 1 - anc[0], anc[1]))
    for i in range(4):
        spr[f'flowers{i}'] = props2.flowerbed(i)
    for t in (1, 2, 3):
        spr[f'mannequin{t}'] = props2.mannequin(t)
    spr['weaponrack'] = props2.iso_face(*props2.weapon_rack(), along='u')        # przy tylnej ścianie v
    spr['shelfitems'] = props2.iso_face(*props2.accessory_shelf(), along='v')    # przy tylnej ścianie u
    spr['shelfitems_u'] = props2.iso_face(*props2.accessory_shelf(), along='u')
    for k in range(3):
        for g_ in range(4):                                          # stragan widziany z czterech stron
            spr[f'stall{k}_g{g_}'] = props2.stall_iso(k, g_)
        spr[f'banner{k}'] = props2.banner(k)
        spr[f'head{k}_u'] = props2.iso_face(*props2.big(props2.mount_head)(k), along='u', depth=3)
        spr[f'head{k}_v'] = props2.iso_face(*props2.big(props2.mount_head)(k), along='v', depth=3)
        spr[f'dragonpic{k}_u'] = props2.iso_face(*props2.big(props2.dragon_painting)(k), along='u', depth=2)
        spr[f'dragonpic{k}_v'] = props2.iso_face(*props2.big(props2.dragon_painting)(k), along='v', depth=2)
        spr[f'fire_{k}'] = props2.iso_face(*props2.hearth(k), along='u', depth=10)
        for f_ in range(3):
            spr[f'flag{k}_{f_}'] = props2.flag(k, f_)
    for k in range(4):
        spr[f'planter{k}'] = props2.planter(k)
    spr['tavernsign'] = props2.tavern_sign()
    a_, anc = props2.tavern_sign()
    spr['tavernsign_m'] = (np.ascontiguousarray(a_[:, ::-1]), (a_.shape[1] - 1 - anc[0], anc[1]))
    spr['chimney'] = props2.chimney()
    for k in range(2):
        spr[f'shieldsw{k}_u'] = props2.iso_face(*props2.big(props2.shield_swords)(k), along='u', depth=3)
        spr[f'shieldsw{k}_v'] = props2.iso_face(*props2.big(props2.shield_swords)(k), along='v', depth=3)
    spr['barshelf'] = props2.iso_face(*props2.bar_shelf(), along='v', depth=6)
    spr['barrel'] = props2.barrel()
    spr['barcounter'] = props2.bar_counter(180)
    for k in range(3):
        spr[f'ttable{k}'] = props2.tavern_table(k)
    spr['torch0'] = props2.torch(0)
    spr['torch1'] = props2.torch(1)
    import hero9
    frames_h = hero9.all_frames()
    for nm, a_ in frames_h.items():
        spr[nm] = (a_, (14, 41))
    # kupiec: ten sam szkielet postaci, inne kolory (włosy, chusta, kaftan, spodnie)
    swap = {'H': '#5a3a22', 'h': '#43291a', 'g': '#2e1c12', 'G': '#1e120c', 'R': '#3a8a4a', 'r': '#286434', 'x': '#173f20',
            'B': '#6a5a8a', 'b': '#4a3e66', 'D': '#2e2644', 'c': '#d8c070', 'L': '#7a5a3a', 'l': '#5a3e26', 'n': '#3a2616'}
    cmap = {tuple(int(hero9.PAL[k][i:i + 2], 16) for i in (1, 3, 5)): tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in swap.items()}
    for d_ in ('S', 'SE'):
        for k_ in (0, 1):
            a_ = frames_h[f'hero_{d_}_idle{k_}'].copy()
            rgb = a_[..., :3]
            for src, dst in cmap.items():
                mm = (rgb[..., 0] == src[0]) & (rgb[..., 1] == src[1]) & (rgb[..., 2] == src[2])
                rgb[mm] = dst
            spr[f'npc_{d_}_idle{k_}'] = (a_, (14, 41))
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



# ------------------------------------------------------------------ zapis warstw komórki (świat i wnętrza)
def save_water(d, R, kind, pu_l, pv_l, sfx=''):
    """Dane wody do animacji na CPU: water_a (indeks koloru, fazy fal), water_b (piana)."""
    HSd, Wd = kind.shape
    wm = kind == TR.WATER
    depthn = np.clip(R['dist'] / 70, 0, 1)
    base = 5.6 - 4.4 * depthn + 0.8 * (R['wn'] - 0.5) - 1.6 * R['shadow']
    q = R['dist'] - 3.0 * R['foamn']
    B_ = base[pv_l, pu_l]; WF = R['wf'][pv_l, pu_l]; WF2 = R['wf2'][pv_l, pu_l]; Q = q[pv_l, pu_l]
    wr = np.zeros((HSd, Wd, 3), np.uint8)
    wr[..., 0] = np.where(wm, np.clip(B_ * 18 + 1, 1, 255), 0)
    wr[..., 1] = np.where(wm, np.clip(WF * 255, 0, 255), 0)
    wr[..., 2] = np.where(wm, np.clip(WF2 * 255, 0, 255), 0)
    wq = np.where(wm, np.clip((Q + 4) * 20, 0, 255), 0).astype(np.uint8)
    Image.fromarray(wr).save(d / f'water_a{sfx}.png', optimize=True)
    Image.fromarray(wq).save(d / f'water_b{sfx}.png', optimize=True)


def save_layers(d, R, img, kind, dep, H, pu_l, pv_l, Mg, no_occ=None, pick=None, sfx=''):
    """pu_l/pv_l – indeksy tablic (H, no_occ) dla pikseli; pick – (u, v) lokalne do mapy wyboru (domyślnie te same)"""
    """ground.webp (teren pod wszystkim), bands.webp (pasma głębi: ściany, klify, dachy), pick.png (piksel → teksel)."""
    HSd, Wd = kind.shape
    wm = kind == TR.WATER
    land = (kind >= 0) & ~wm
    base_rgba = np.zeros((HSd, Wd, 4), np.uint8)
    base_rgba[..., :3] = np.clip(img, 0, 255)
    base_rgba[..., 3] = np.where(land, 255, 0)
    Image.fromarray(base_rgba).save(d / f'ground{sfx}.webp', lossless=True, quality=100, method=6)
    raised = H > ndi.minimum_filter(H, size=129)
    occ = land & ((kind == TR.CLIFF_KIND) | raised[pv_l, pu_l])
    if no_occ is not None:
        occ &= ~no_occ[pv_l, pu_l]          # np. teren pod mostem – nie może zasłaniać pomostu
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
    AW = 4096                  # szeroki atlas: wysokość poniżej 4096 (limit tekstur na słabszych GPU)
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
        bands.append(dict(z=int(b) * BW - 2 * Mg, x=int(x0), y=int(y0), ax=int(ax), ay=int(ay), w=int(t.shape[1]), h=int(t.shape[0])))
    Image.fromarray(atl).save(d / f'bands{sfx}.webp', lossless=True, quality=100, method=6)

    # ---- mapa wyboru (piksel → teksel lokalny + OFF) i siatka chodzenia
    pk = np.full((HSd, Wd), 0xFFFFFF, np.int64)
    ok = (R['pu'] > -90000) & (kind >= 0)
    ku, kv = pick if pick is not None else (pu_l, pv_l)
    pk[ok] = (ku[ok].astype(np.int64) << 11) | kv[ok]
    Image.fromarray(np.dstack([(pk >> 16) & 255, (pk >> 8) & 255, pk & 255]).astype(np.uint8)).save(d / f'pick{sfx}.png', optimize=True)
    return bands, AW, AH


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
    shop_door = (shop['u1'] + 16, (shop['v0'] + shop['v1']) / 2)        # portal przed drzwiami (+u)
    chest_uv = (shop['u1'] + 14, shop['v0'] - 6)
    tav = next(b for b in buildings if b['tag'] == 'tavern')
    tav_door = ((tav['u0'] + tav['u1']) / 2, tav['v1'] + 16)          # portal przed drzwiami (+v)

    # ---- obiekty: opisy w układzie świata; rzut na ekran osobno dla każdego widoku
    rr = np.random.default_rng(ci * 7 + cj)
    specs = []
    def add(k, s_, u, v, h=None, dz=0, ph=None, sh=None, zfront=None):
        specs.append(dict(k=k, s=s_, u=float(u), v=float(v), h=h, dz=dz, ph=ph, sh=sh, zfront=zfront))
    for (kd_, idx, u, v, lu, lv) in placed:
        if kd_ == 'tree':
            R_ = TREE_VARIANTS[idx][0]
            add('tree', [f'tree{idx}_t', f'tree{idx}_c'], u, v, ph=round(float(rr.random() * 6.28), 3), sh=(R_ * 0.55, 0, R_ * 1.15, R_ * 0.42, 0.62))
        elif kd_ == 'bush':
            R_ = BUSH_VARIANTS[idx][0]
            add('bush', [f'bush{idx}'], u, v, ph=round(float(rr.random() * 6.28), 3), sh=(R_ * 0.4, 1, R_, R_ * 0.4, 0.65))
        else:
            add('prop', [f'rock{idx}'], u, v)
    if (ci, cj) == (1, 1):
        add('prop', ['chest'], *chest_uv, sh=(4, 0, 17, 5, 0.6))
        for (u, v) in town_lamps():
            add('lamp', ['lamp'], u, v, sh=(2, 0, 7, 3, 0.7))
        for i, (u, v) in enumerate(town_flowers()):
            add('bush', [f'flowers{i % 4}'], u, v, ph=round(float(rr.random() * 6.28), 3))
        add('stash', ['chest'], *STASH, sh=(4, 0, 17, 5, 0.6))
        for ((u, v), k, ax_) in STALLS:
            face = (0, 1) if ax_ == 'u' else (1, 0)                       # strona klientów w świecie
            def stall_name(r, k=k, face=face):
                f = rot_vec(*face, r)
                g_ = [rot_vec(0, 1, g) for g in range(4)].index(f)
                return [f'stall{k}_g{g_}']
            add('prop', stall_name, u, v, sh=(6, 2, 26, 9, 0.6))
        for i, (u, v) in enumerate(PLANTERS):
            add('prop', [f'planter{i % 4}'], u, v)
        for i, (u, v) in enumerate(town_banners()):
            add('prop', [f'banner{i % 3}'], u, v, sh=(3, 0, 6, 2, 0.6))
        for i, (u, v, h) in enumerate(town_flags()):
            add('flag', [f'flag{i % 3}_0'], u, v, h=h, dz=4, ph=round(float(rr.random()), 3))
        # szyldy tylko gdy ich ściana jest widoczna (zwrócona do +p albo +q)
        def sign(names):
            def f(r, wall):
                n = rot_vec(*wall, r)
                return [names[0]] if n == (1, 0) else [names[1]] if n == (0, 1) else None
            return f
        tsign = sign(('tavernsign', 'tavernsign_m'))
        add('prop', lambda r: tsign(r, (0, 1)), (tav['u0'] + tav['u1']) / 2 + 20, tav['v1'] + 2, h=BASE + 44, dz=2)
        ridge = tav['eave'] + int((tav['v1'] - tav['v0']) / 2 * tav.get('pitch', 0.8))
        cu_, cv_ = tav['u1'] - 18, (tav['v0'] + tav['v1']) / 2
        add('prop', ['chimney'], cu_, cv_, h=ridge - 6, zfront=(tav, 4))
        add('smoke', [], cu_, cv_, h=ridge + 24, zfront=(tav, 5))
        for b_ in buildings:
            ch = house_chimney(b_)
            if ch and hsh(b_['u0'], b_['v0'], 402) > 0.4:             # z części kominów leci dym
                add('smoke', [], (ch[0] + ch[1]) / 2, (ch[2] + ch[3]) / 2, h=ch[4] + 2, zfront=(b_, 5))
        ssign = sign(('shopsign', 'shopsign_m'))
        add('prop', lambda r: ssign(r, (1, 0)), shop['u1'] + 2, (shop['v0'] + shop['v1']) / 2 - 18, h=BASE + 42, dz=2)

    under_bridge = (np.abs(gu - CTR) < BR_HALF_W + 14) & (gv > BRIDGE['v0'] - 6) & (gv < BRIDGE['v1'] + 6)
    bcx, bcy = int(((BRIDGE['u0'] + BRIDGE['u1']) / 2) // C), int(((BRIDGE['v0'] + BRIDGE['v1']) / 2) // C)
    d = OUT / f'c{ci}{cj}'
    d.mkdir(parents=True, exist_ok=True)
    total_bands = 0
    for r in ROTS:
        # początek komórki w układzie widoku i indeksy tablic świata dla każdego piksela-teksela widoku
        (pa, qa), (pb, qb) = rot_pt(ou, ov, r), rot_pt(ou + C - 1, ov + C - 1, r)
        op, oq = min(pa, pb), min(qa, qb)
        Pg = (op - M + iu).astype(np.int64)
        Qg = (oq - M + iv).astype(np.int64)
        Ug, Vg = rot_pt(Pg, Qg, (4 - r) % 4)
        IU, IV = (Ug - ou + M).astype(np.int64), (Vg - ov + M).astype(np.int64)
        Hr, MATr, gpr = H[IV, IU], MAT[IV, IU], gpid[IV, IU]
        R = TR.render(Pg, Qg, Hr, MATr, [rot_building(b, r) for b in buildings], PALS, W, HS, X0, Y0, seed=ci * 3 + cj, gpid=gpr)
        img, dep, kind = R['img'], R['dep'], R['kind']
        # poza światem: przezroczyście (w grze widać tam niebo)
        beyond = (R['pu'] < 0) | (R['pv'] < 0) | (R['pu'] >= GRID * C) | (R['pv'] >= GRID * C)
        kind[beyond] = -1

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

        def loc(u, v):
            P_, Q_ = rot_pt(u, v, r)
            return P_ - op + M, Q_ - oq + M

        ents = []
        for sp in specs:
            names = sp['s'](r) if callable(sp['s']) else sp['s']
            if names is None:
                continue
            lp, lq = loc(sp['u'], sp['v'])
            h = sp['h']
            if h is None:
                h = int(H[int(np.clip(sp['v'] - ov + M, 0, N - 1)), int(np.clip(sp['u'] - ou + M, 0, N - 1))])
            x, y = int(lp - lq + X0), int((lp + lq) // 2 - h + Y0)
            if sp['zfront'] is not None:                                   # przed dachem budynku (najbliższy narożnik)
                b_, off = sp['zfront']
                z = int(max(sum(loc(cu2, cv2)) for cu2 in (b_['u0'], b_['u1']) for cv2 in (b_['v0'], b_['v1'])) - 2 * M) + off
            else:
                z = int(lp + lq - 2 * M) + sp['dz']
            if sp['sh']:
                dx_, dy_, rx_, ry_, k_ = sp['sh']
                ground_shadow(x, y + dy_, rx_, ry_, k_, dx=dx_)
            e = dict(k=sp['k'], s=names, x=x, y=y, z=z)
            if sp['ph'] is not None:
                e['ph'] = sp['ph']
            ents.append(e)
        if (ci, cj) == (bcx, bcy):
            (pa, qa), (pb, qb) = loc(BRIDGE['u0'], BRIDGE['v0']), loc(BRIDGE['u1'] - 1, BRIDGE['v1'] - 1)
            lp, lq = min(pa, pb), min(qa, qb)
            ents.append(dict(k='bridge', s=['bridge_t' if r % 2 else 'bridge'], x=int(lp - lq + X0), y=int((lp + lq) // 2 - BR_H + Y0), z=int(lp + lq - 2 * M) - 8))

        # piksel → indeks tablic widoku (woda, pasma) i lokalne (u, v) świata (mapa wyboru – gra liczy w układzie świata)
        ip_l = np.clip(R['pu'] - (op - M), 0, N - 1)
        iq_l = np.clip(R['pv'] - (oq - M), 0, N - 1)
        Uw, Vw = rot_pt(R['pu'], R['pv'], (4 - r) % 4)
        pick_u = np.clip(Uw - ou + M, 0, N - 1); pick_v = np.clip(Vw - ov + M, 0, N - 1)
        sfx = '' if r == 0 else f'_r{r}'
        save_water(d, R, kind, ip_l, iq_l, sfx)
        bands, AW, AH = save_layers(d, R, img, kind, dep, Hr, ip_l, iq_l, M, no_occ=under_bridge[IV, IU], pick=(pick_u, pick_v), sfx=sfx)
        total_bands += len(bands)
        NC_ = N // CELLW
        meta = dict(cx=ci, cy=cj, name=name, biome=biome, W=W, H=HS, X0=X0, Y0=Y0 + M, OFF=M, N=N, CELL=CELLW, NC=NC_,
                    size=C, rot=r, bands=bands, ents=ents)
        json.dump(meta, open(d / f'meta{sfx}.json', 'w'), separators=(',', ':'))
        if r == 0:
            (ROOT / 'build_tmp').mkdir(exist_ok=True)
            Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(ROOT / 'build_tmp' / f'preview_c{ci}{cj}.png')
        else:
            Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(ROOT / 'build_tmp' / f'preview_c{ci}{cj}_r{r}.png')

    NC = N // CELLW
    Hc = H[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    Mc = MAT[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    Gc = gu[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC], gv[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    walk = np.isin(Mc, TR.WALKABLE) & (Hc < BASE + 60)
    walk |= town_wall(*Gc)[1]                                                     # chodnik na murze i schody
    walk &= (Gc[0] >= 0) & (Gc[1] >= 0) & (Gc[0] < GRID * C) & (Gc[1] < GRID * C)
    for (kd_, idx, u, v, lu, lv) in placed:
        r = 2 if kd_ == 'tree' else 1
        cic, cjc = lu // CELLW, lv // CELLW
        walk[max(0, cjc - r):cjc + r + 1, max(0, cic - r):cic + r + 1] = False
    if (ci, cj) == (1, 1):
        cic, cjc = int((chest_uv[0] - ou + M) // CELLW), int((chest_uv[1] - ov + M) // CELLW)
        walk[cjc - 3:cjc + 4, cic - 4:cic + 4] = False
        for (u, v) in town_lamps() + town_flowers() + town_banners() + [STASH] + PLANTERS + [q[0] for q in STALLS]:
            cic, cjc = int((u - ou + M) // CELLW), int((v - ov + M) // CELLW)
            walk[cjc - 1:cjc + 2, cic - 1:cic + 2] = False
        cic, cjc = int((STASH[0] - ou + M) // CELLW), int((STASH[1] - ov + M) // CELLW)
        walk[cjc - 3:cjc + 4, cic - 4:cic + 4] = False
        for (u, v) in PLANTERS + [q[0] for q in STALLS]:
            cic, cjc = int((u - ou + M) // CELLW), int((v - ov + M) // CELLW)
            walk[cjc - 4:cjc + 5, cic - 4:cic + 5] = False
    # most: przechodni pomost nad wodą (wysokość pomostu)
    on_bridge = (np.abs(Gc[0] - CTR) < BR_HALF_W - 4) & (Gc[1] > BRIDGE['v0'] + 2) & (Gc[1] < BRIDGE['v1'] - 2)
    walk |= on_bridge
    Hc = np.where(on_bridge, BR_H, Hc)
    # usuń małe odcięte wysepki (np. wnętrza ruin)
    lab, nl = ndi.label(walk, structure=np.ones((3, 3)))
    if nl:
        sizes_ = ndi.sum(walk, lab, range(1, nl + 1))
        small = np.isin(lab, 1 + np.nonzero(sizes_ < 400)[0])
        walk &= ~small
    wg = np.where(walk, np.clip(Hc + 1, 1, 254), 0).astype(np.uint8)
    Image.fromarray(wg).save(d / 'walk.png')

    extra = {}
    if (ci, cj) == (1, 1):
        extra = dict(shop=[float(shop_door[0] - ou), float(shop_door[1] - ov)], spawn=[float(SPAWN[0] - ou), float(SPAWN[1] - ov)],
                     stash=[float(STASH[0] - ou), float(STASH[1] - ov)],
                     tavern=[float(tav_door[0] - ou), float(tav_door[1] - ov)],
                     guards=[dict(g, u=g['u'] - ou, v=g['v'] - ov) for g in town_guards()],
                     folk=[dict(t, u=t['u'] - ou, v=t['v'] - ov, face=list(t['face'])) for t in TOWNFOLK])
    sz = sum(os.path.getsize(d / f) for f in ['ground.webp', 'bands.webp', 'water_a.png', 'water_b.png', 'pick.png', 'walk.png', 'meta.json'])
    print(f'komórka {ci},{cj} {name}: 4 widoki, pasma {total_bands}, obiekty {len(specs)}, widok 0: {sz / 1e6:.1f} MB', flush=True)
    return (ci, cj), extra


# ------------------------------------------------------------------ wnętrze sklepu
RU, RV = 320, 256        # pokój 10×8 kafli
MI = 32                  # margines wokół pokoju
NI = max(RU, RV) + 2 * MI
HI_MAX = 150


def gen_interior():
    d = OUT / 'shop'
    d.mkdir(parents=True, exist_ok=True)
    iv, iu = np.mgrid[0:NI, 0:NI]
    u = (iu - MI).astype(np.int64); v = (iv - MI).astype(np.int64)
    H = np.full((NI, NI), BASE, np.int32)
    MAT = np.full((NI, NI), TR.WOOD, np.int8)
    room = (u >= 0) & (u < RU) & (v >= 0) & (v < RV)
    # ściany tylne (wysokie, z oknami) i przednie (niski cokół, żeby widzieć wnętrze)
    walls = [dict(u0=-10, u1=-1, v0=-10, v1=RV + 5, base=BASE, eave=BASE + 110, top=BASE + 110, roof='flat', walls='plaster',
                  door=None, wins_u=0, wins_v=2, winz=42),
             dict(u0=-10, u1=RU + 5, v0=-10, v1=-1, base=BASE, eave=BASE + 110, top=BASE + 110, roof='flat', walls='plaster',
                  door=None, wins_u=3, wins_v=0, winz=42)]
    for b in walls:
        m = (u >= b['u0']) & (u <= b['u1']) & (v >= b['v0']) & (v <= b['v1'])
        H[m] = b['top']; MAT[m] = TR.WALL
    front = ((u >= RU) & (u < RU + 6) & (v >= -10) & (v < RV + 6)) | ((v >= RV) & (v < RV + 6) & (u >= -10) & (u < RU + 6))
    H[front] = BASE + 8; MAT[front] = TR.WALL
    # lada (drewno) i regały
    COUNTER = (56, 72, 60, 200)        # lada: niska, kupiec stoi dość daleko za nią, żeby był cały widoczny
    m = (u >= COUNTER[0]) & (u <= COUNTER[1]) & (v >= COUNTER[2]) & (v <= COUNTER[3])
    H[m] = BASE + 20; MAT[m] = TR.WOOD
    for (a0, a1, b0, b1, h) in [(110, 300, 0, 12, 64), (0, 8, 40, 220, 72)]:
        m = (u >= a0) & (u <= a1) & (v >= b0) & (v <= b1)
        H[m] = BASE + h; MAT[m] = TR.WOOD
    W_, HS_ = 2 * NI, NI + HI_MAX + 8
    R = TR.render(u, v, H, MAT, walls, PALS, W_, HS_, NI, HI_MAX, seed=99)
    img, dep, kind = R['img'], R['dep'], R['kind']
    pu_l = np.clip(R['pu'] + MI, 0, NI - 1); pv_l = np.clip(R['pv'] + MI, 0, NI - 1)
    # poza pokojem: przezroczyste
    inside = (R['pu'] >= -10) & (R['pu'] < RU + 6) & (R['pv'] >= -10) & (R['pv'] < RV + 6)
    kind[~inside] = -1
    # ciepłe światło z okien (prosty gradient od tylnej ściany)
    lightf = np.clip(1.15 - (R['pu'] + R['pv']) / (RU + RV) * 0.45, 0.7, 1.15)
    img *= lightf[..., None] * np.array([1.0, 0.96, 0.88])
    save_water(d, R, kind, pu_l, pv_l)
    bands, AW, AH = save_layers(d, R, img, kind, dep, H, pu_l, pv_l, MI)
    NC = NI // CELLW
    Hc = H[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    uc = u[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]; vc = v[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    walk = (Hc == BASE) & (uc >= 4) & (uc < RU - 4) & (vc >= 4) & (vc < RV - 4) & (uc > COUNTER[1] + 6)
    for (cu, cv_, rr_) in [(150, 30, 14), (200, 30, 14), (250, 30, 14), (100, 16, 18), (300, 16, 18), (14, 236, 18), (14, 26, 18)]:
        walk &= np.hypot(uc - cu, vc - cv_) > rr_
    wg = np.where(walk, BASE + 1, 0).astype(np.uint8)
    Image.fromarray(wg).save(d / 'walk.png')
    def scr(lu, lv):
        return int(lu - lv + NI), int((lu + lv + 2 * MI) // 2 - BASE + HI_MAX)
    def scrh(lu, lv, h):
        return int(lu - lv + NI), int((lu + lv + 2 * MI) // 2 - h + HI_MAX)
    ents = []
    for (cu, cv_, nm) in [(150, 30, 'mannequin1'), (200, 30, 'mannequin2'), (250, 30, 'mannequin3'),
                          (100, 16, 'weaponrack'), (300, 16, 'weaponrack'), (14, 236, 'shelfitems'), (14, 26, 'shelfitems')]:
        x, y = scr(cu, cv_)
        ents.append(dict(k='prop', s=[nm], x=x, y=y, z=int(cu + cv_)))
    for (cu, cv_) in [(2, 62), (2, 200), (96, 2), (270, 2)]:
        x, y = scrh(cu, cv_, BASE + 62)
        ents.append(dict(k='torch', s=['torch0'], x=x, y=y, z=int(cu + cv_)))
    meta = dict(cx=-1, cy=-1, name='Sklep', biome='interior', W=W_, H=HS_, X0=NI, Y0=HI_MAX + MI, OFF=MI, N=NI, CELL=CELLW, NC=NC,
                size=max(RU, RV), bands=bands, ents=ents)
    json.dump(meta, open(d / 'meta.json', 'w'), separators=(',', ':'))
    (ROOT / 'build_tmp').mkdir(exist_ok=True)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(ROOT / 'build_tmp' / 'preview_shop.png')
    print('wnętrze sklepu zapisane', flush=True)
    return dict(dir='shop', name='Sklep', spawn=[262.0, 196.0], exit=[290.0, 222.0], npc=[22.0, 130.0], floor=BASE)


# ------------------------------------------------------------------ wnętrze karczmy „Pod Złotym Kuflem”
TU, TV = 448, 400        # sala 14×12,5 kafla (duże stoły)
NT = max(TU, TV) + 2 * MI
HT = 210                 # zapas wysokości obrazu (wyższe ściany i kominek)
TAV_TABLES = [(150, 100), (245, 100), (345, 104), (150, 195), (245, 195), (345, 195), (420, 108), (420, 205), (195, 295), (300, 295)]
HEARTH_U = 300           # środek kominka przy tylnej ścianie v
TAV_BAR = (62, 80, 46, 226)        # lada baru (u0, u1, v0, v1) – karczmarz za nią (mniejsze u)


def gen_tavern():
    d = OUT / 'tavern'
    d.mkdir(parents=True, exist_ok=True)
    iv, iu = np.mgrid[0:NT, 0:NT]
    u = (iu - MI).astype(np.int64); v = (iv - MI).astype(np.int64)
    H = np.full((NT, NT), BASE, np.int32)
    MAT = np.full((NT, NT), TR.WOOD, np.int8)
    walls = [dict(u0=-10, u1=-1, v0=-10, v1=TV + 5, base=BASE, eave=BASE + 150, top=BASE + 150, roof='flat', walls='plaster',
                  door=None, wins_u=0, wins_v=0, winz=60),
             dict(u0=-10, u1=TU + 5, v0=-10, v1=-1, base=BASE, eave=BASE + 150, top=BASE + 150, roof='flat', walls='plaster',
                  door=None, wins_u=0, wins_v=0, winz=60)]
    for b in walls:
        m = (u >= b['u0']) & (u <= b['u1']) & (v >= b['v0']) & (v <= b['v1'])
        H[m] = b['top']; MAT[m] = TR.WALL
    front = ((u >= TU) & (u < TU + 6) & (v >= -10) & (v < TV + 6)) | ((v >= TV) & (v < TV + 6) & (u >= -10) & (u < TU + 6))
    H[front] = BASE + 8; MAT[front] = TR.WALL
    m = (u >= TAV_BAR[0]) & (u <= TAV_BAR[1]) & (v >= TAV_BAR[2]) & (v <= TAV_BAR[3])
    MAT[m] = TR.WOOD                                                     # lada to sprite; tu tylko blokada chodzenia
    W_, HS_ = 2 * NT, NT + HT + 8
    R = TR.render(u, v, H, MAT, walls, PALS, W_, HS_, NT, HT, seed=77)
    img, dep, kind = R['img'], R['dep'], R['kind']
    pu_l = np.clip(R['pu'] + MI, 0, NT - 1); pv_l = np.clip(R['pv'] + MI, 0, NT - 1)
    inside = (R['pu'] >= -10) & (R['pu'] < TU + 6) & (R['pv'] >= -10) & (R['pv'] < TV + 6)
    kind[~inside] = -1
    # ciepłe, przyćmione światło (pochodnie i kominek), jaśniej przy kominku
    fire_d = np.hypot(R['pu'] - HEARTH_U, R['pv'] - 10)
    lightf = np.clip(0.82 + 0.38 * np.exp(-fire_d / 130) - (R['pu'] + R['pv']) / (TU + TV) * 0.12, 0.62, 1.2)
    img *= lightf[..., None] * np.array([1.0, 0.9, 0.76])
    save_water(d, R, kind, pu_l, pv_l)
    bands, AW, AH = save_layers(d, R, img, kind, dep, H, pu_l, pv_l, MI)
    NC = NT // CELLW
    Hc = H[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    uc = u[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]; vc = v[CELLW // 2::CELLW, CELLW // 2::CELLW][:NC, :NC]
    walk = (Hc == BASE) & (uc >= 4) & (uc < TU - 4) & (vc >= 4) & (vc < TV - 4) & (uc > TAV_BAR[1] + 8)
    for (cu, cv_) in TAV_TABLES:
        walk &= ~((np.abs(uc - cu) < 36) & (np.abs(vc - cv_) < 28))      # stół z krzesłami
    walk &= ~((np.abs(uc - HEARTH_U) < 56) & (vc < 30))                  # kominek
    walk &= ~((uc < 46) & (vc > 228))                                    # beczki
    Image.fromarray(np.where(walk, BASE + 1, 0).astype(np.uint8)).save(d / 'walk.png')
    def scrh(lu, lv, h):
        return int(lu - lv + NT), int((lu + lv + 2 * MI) // 2 - h + HT)
    ents = []
    def put(nm, cu, cv_, h=BASE, k='prop', z=None, **kw):
        x, y = scrh(cu, cv_, h)
        ents.append(dict(k=k, s=[nm], x=x, y=y, z=int(cu + cv_) if z is None else z, **kw))
    for i, (cu, cv_) in enumerate(TAV_TABLES):
        put(f'ttable{i % 3}', cu, cv_)
    for (cu, cv_) in [(14, 246), (14, 270), (34, 258), (14, 294)]:
        put('barrel', cu, cv_)
    put('barshelf', 1, 92, BASE + 30); put('barshelf', 1, 164, BASE + 30)
    put('barcounter', (TAV_BAR[0] + TAV_BAR[1]) / 2, (TAV_BAR[2] + TAV_BAR[3]) / 2)
    put('fire_0', HEARTH_U, 2, k='fire', ph=0.0)
    # ściana tylna v (wzdłuż u): głowy jelenia i wilka, obrazy ze smokami, tarcza nad kominkiem
    put('head0_u', 95, 0, BASE + 70); put('dragonpic0_u', 198, 0, BASE + 66); 
    put('head2_u', 402, 0, BASE + 70)
    # ściana tylna u (wzdłuż v): głowa niedźwiedzia, obraz, tarcza z mieczami
    put('head1_v', 0, 250, BASE + 70); put('dragonpic1_v', 0, 345, BASE + 66)
    put('shieldsw0_v', 0, 92, BASE + 76); put('shieldsw1_v', 0, 164, BASE + 76)        # tarcze nad półkami za barem
    for (cu, cv_) in [(40, 0), (146, 0), (246, 0), (356, 0), (438, 0), (0, 40), (0, 212), (0, 292)]:
        put('torch0', cu, cv_, BASE + 80, k='torch')
    meta = dict(cx=-1, cy=-1, name='Karczma', biome='interior', W=W_, H=HS_, X0=NT, Y0=HT + MI, OFF=MI, N=NT, CELL=CELLW, NC=NC,
                size=max(TU, TV), bands=bands, ents=ents)
    json.dump(meta, open(d / 'meta.json', 'w'), separators=(',', ':'))
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(ROOT / 'build_tmp' / 'preview_tavern.png')
    print('wnętrze karczmy zapisane', flush=True)
    return dict(dir='tavern', name='Karczma „Pod Złotym Kuflem”', spawn=[380.0, 344.0], exit=[414.0, 370.0], npc=[28.0, 136.0], floor=BASE,
                role='inn', npcName='Karczmarz Bogumił',
                lines=['Siadaj, wędrowcze! Piwo z naszej warzelni najlepsze w Glastemii.',
                       'Tę głowę niedźwiedzia przyniósł strażnik spod Urwisk. Twierdzi, że gołymi rękami…',
                       'Smoki? Widziano jednego nad Ruinami. Stąd te obrazy – ku przestrodze.',
                       'Przy kominku najlepiej się odpoczywa. Usiądź, zdrowie samo wraca.'])


def _job(args):
    return gen_cell(*args)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    frames, sizes = build_sprites()
    args = sys.argv[1:]
    do_shop = not args or 'shop' in args
    want = [tuple(int(x) for x in a.split(',')) for a in args if a != 'shop'] or ([] if args else sorted(CELLS))
    results = []
    if want:
        with Pool(min(3, len(want))) as pool:
            results = pool.map(_job, [(i, j, sizes) for (i, j) in want])
    shop_int = gen_interior() if do_shop else None
    tav_int = gen_tavern() if do_shop else None
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
        world['stash'] = dict(cx=1, cy=1, u=town['stash'][0], v=town['stash'][1])
        world['guards'] = [dict(cx=1, cy=1, **g) for g in town['guards']]
        world['folk'] = [dict(cx=1, cy=1, **t) for t in town['folk']]
    ints = world.get('interiors', {})
    keep = lambda k: {x: ints.get(k, {})[x] for x in ('door', 'back') if x in ints.get(k, {})}   # drzwi z poprzedniego miasta
    if shop_int:
        ints['shop'] = dict(shop_int, role='shop', npcName='Kupiec Bronek', **keep('shop'))
    if tav_int:
        ints['tavern'] = dict(tav_int, **keep('tavern'))
    if town:
        ints.setdefault('shop', {})['door'] = dict(cx=1, cy=1, u=town['shop'][0], v=town['shop'][1])
        ints['shop']['back'] = [22.0, 6.0]
        if 'tavern' in ints:
            ints['tavern']['door'] = dict(cx=1, cy=1, u=town['tavern'][0], v=town['tavern'][1])
            ints['tavern']['back'] = [6.0, 22.0]
    world['interiors'] = ints
    json.dump(world, open(wpath, 'w'), separators=(',', ':'))
    print('świat zapisany:', wpath)


if __name__ == '__main__':
    main()
