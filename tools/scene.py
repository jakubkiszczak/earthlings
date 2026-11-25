"""Test kierunku 'lush iso pixel' (wg referencji): renderer pola wysokości w pikselach izometrycznych.
Ten sam model co w grze: kafel 64x32 px (32 teksele), poziomy terenu co 24 px, sprite'y sortowane po głębi s=u+v.
Wynik: natywnie 640x360, skalowane x3 do 1920x1080 (najbliższy sąsiad)."""
from pathlib import Path as _P
ROOT = _P(__file__).resolve().parent.parent
import numpy as np
from scipy import ndimage as ndi
from PIL import Image

N = 1100
OFF = 200
W, Hs = 800, 480
X0, Y0 = 382, 34
rng = np.random.default_rng(11)
v, u = np.mgrid[0:N, 0:N] - OFF
a = u - v
s = u + v


def hexs(lst):
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in lst], np.float32)


def noise(scale, seed):
    r = np.random.default_rng(seed)
    g = r.random((N // scale + 4, N // scale + 4))
    z = ndi.zoom(g, scale, order=3)[:N, :N]
    return (z - z.min()) / (z.max() - z.min())


def fbm(seed, scales=(128, 64, 32, 16, 8), w=(1, .55, .3, .16, .08)):
    t = sum(wi * noise(sc, seed + k) for k, (sc, wi) in enumerate(zip(scales, w)))
    return (t - t.min()) / (t.max() - t.min())


def hsh(*xs):
    h = np.uint32(2166136261)
    out = np.full(np.broadcast(*xs).shape, 2166136261, np.uint64)
    for x in xs:
        out = ((out ^ (np.asarray(x).astype(np.int64) & 0xffffffff).astype(np.uint64)) * np.uint64(16777619)) & np.uint64(0xffffffff)
    out ^= out >> np.uint64(13)
    out = (out * np.uint64(0x5bd1e995)) & np.uint64(0xffffffff)
    out ^= out >> np.uint64(15)
    return (out & np.uint64(0xffff)).astype(np.float32) / 65535.0


BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16 - 0.47

# ------------------------------------------------------------------ teren
j1 = (fbm(1, (64, 32, 16, 8)) - 0.5) * 34
j2 = (fbm(2, (64, 32, 16, 8)) - 0.5) * 34
j3 = (fbm(3, (64, 32, 16, 8)) - 0.5) * 30
H = np.full((N, N), 72.0)
GRASS, DIRT, PATH, WALL, PAVE, WATER = 0, 1, 2, 3, 4, 5
MAT = np.zeros((N, N), np.int8)
H[(v + j1 > 262)] = 48
H[(v + j1 > 352) | ((v + j1 > 300) & (u + j2 < 250))] = 24
H[(u + j2 < 205) & (v + j1 > 262)] = 48
water = (u + j3 > 384) & (v + j1 > 150)
water |= (v + j1 > 430)
H[water] = 0
MAT[water] = WATER
tu0, tu1, tv0, tv1 = 228, 272, 150, 194
plinth = (u >= tu0 - 8) & (u <= tu1 + 8) & (v >= tv0 - 8) & (v <= tv1 + 8)
H[plinth] = 80; MAT[plinth] = PAVE
tower = (u >= tu0) & (u <= tu1) & (v >= tv0) & (v <= tv1)
H[tower] = 72 + 118; MAT[tower] = WALL
ring = tower & (((u - tu0) < 4) | ((tu1 - u) < 4) | ((v - tv0) < 4) | ((tv1 - v) < 4))
merlon = ring & ((((u - tu0) // 7 + (v - tv0) // 7) % 2) == 0)
H[merlon] = 72 + 128
pts = np.array([(281, 172), (318, 174), (330, 220), (334, 300), (338, 330)], np.float32)
best_d = np.full((N, N), 1e9, np.float32)
for (p0, p1) in zip(pts[:-1], pts[1:]):
    d = p1 - p0
    L = float(np.hypot(*d))
    t = np.clip(((u - p0[0]) * d[0] + (v - p0[1]) * d[1]) / (L * L), 0, 1)
    dist = np.hypot(u - (p0[0] + t * d[0]), v - (p0[1] + t * d[1]))
    best_d = np.minimum(best_d, dist)
path = (best_d < 8 + j2 * 0.08) & ~tower & ~plinth & ~water
Hp = np.where(v < 236, 72, np.where(v < 262, 72 - np.floor((v - 236) / 6.5 + 1) * 6, 48))
H[path] = Hp[path]
MAT[path] = PATH
# ruina muru na dolnym tarasie
ruin = (u >= 296) & (u <= 352) & (v >= 396) & (v <= 403) & (H == 24) & ~water
ruin &= ~((u > 316) & (u < 326))
H[ruin] = 24 + 16 + (hsh(u // 6, 1, 91)[ruin] * 3).astype(int) * 4 * 0
MAT[ruin] = WALL
# ziemia pod drzewami
dirt = (fbm(7) > 0.7) & (MAT == GRASS) & (a < -60)
MAT[dirt] = DIRT
H = H.astype(np.int32)

# sąsiedzi
Hl = np.pad(H, ((0, 1), (0, 0)), mode='edge')[1:, :]    # (u, v+1)
Hr = np.pad(H, ((0, 0), (0, 1)), mode='edge')[:, 1:]    # (u+1, v)
Hd = np.pad(H, ((0, 1), (0, 1)), mode='edge')[1:, 1:]
low = np.minimum(np.minimum(Hl, Hr), Hd)
drop = np.clip(H - low, 0, None)
drop[MAT == WATER] = 0
faceL = Hl <= Hr
faceLs = ndi.uniform_filter((Hl < Hr).astype(np.float32) + 0.5 * (Hl == Hr), 5)

# cień rzucany (słońce z lewej-góry -> cienie w +u) i AO
shadow = np.zeros((N, N), np.float32)
for d in range(1, 60):
    sh = np.pad(H, ((0, 0), (d, 0)), mode='edge')[:, :N]
    shadow = np.maximum(shadow, ((sh - H) > d * 0.9).astype(np.float32))
shadow = ndi.uniform_filter(shadow, 3)
ao = np.zeros((N, N), np.float32)
for d in range(1, 9):
    s1 = np.pad(H, ((0, 0), (d, 0)), mode='edge')[:, :N]
    s2 = np.pad(H, ((d, 0), (0, 0)), mode='edge')[:N, :]
    hi = np.maximum(s1, s2) - H
    ao = np.maximum(ao, (hi > 6) * (1 - d / 9))
edge = (drop > 0) | (np.pad(drop, ((1, 0), (0, 0)))[:N, :] > 0) | (np.pad(drop, ((0, 0), (1, 0)))[:, :N] > 0)

# ------------------------------------------------------------------ palety
G = hexs(['#12341f', '#1a4c25', '#24662a', '#33822c', '#4a9c2e', '#68b534', '#8ccb3e', '#b2df52', '#d6ef72'])
DR = hexs(['#3a2418', '#54341f', '#6e4628', '#8a5a32', '#a3713f'])
CB = hexs(['#4a3a34', '#6e5a4c', '#8e765f', '#ad9274', '#c8ad8a', '#dcc4a0'])
RK = hexs(['#191312', '#2c2220', '#43342d', '#5c4a3e', '#776050', '#937a62', '#ad9478', '#c6ae90'])
WL = hexs(['#2c2830', '#45404a', '#615a62', '#827a7c', '#a29a94', '#c0b6aa', '#d8cfc0'])
WA = hexs(['#14507e', '#16679a', '#1883b4', '#1ea2c8', '#2cc0d6', '#4ad6de', '#86eae8', '#c4f6f2', '#f0fffc'])


def ramp(pal, f, dither=True, xs=None, ys=None):
    f = np.asarray(f, np.float32)
    if dither:
        f = f + BAYER[ys % 4, xs % 4]
    idx = np.clip(np.floor(f + 0.5), 0, len(pal) - 1).astype(int)
    return pal[idx]


SX = a + X0
SY = s // 2 - H + Y0

def vor(cell, seed):
    gu, gv = np.floor(u / cell).astype(int), np.floor(v / cell).astype(int)
    F1 = np.full((N, N), 1e9, np.float32); F2 = F1.copy(); CID = np.zeros((N, N), np.float32)
    DX = np.zeros((N, N), np.float32); DY = DX.copy()
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cu, cv = gu + ox, gv + oy
            fx = (cu + 0.15 + 0.7 * hsh(cu, cv, 1 + seed)) * cell
            fy = (cv + 0.15 + 0.7 * hsh(cu, cv, 2 + seed)) * cell
            d = np.hypot(u - fx, v - fy)
            closer = d < F1
            F2 = np.where(closer, F1, np.minimum(F2, d))
            CID = np.where(closer, hsh(cu, cv, 3 + seed), CID)
            DX = np.where(closer, u - fx, DX); DY = np.where(closer, v - fy, DY)
            F1 = np.where(closer, d, F1)
    return F1, F2, CID, DX, DY


# ---- kolor wierzchu
n1 = fbm(21)
n2 = noise(6, 33)
top = np.zeros((N, N, 3), np.float32)
lit = 1 - 0.55 * shadow
g = MAT == GRASS
gF1, gF2, gC, gDX, gDY = vor(4.5, 20)
clump = -(gDX + gDY) / 4.5 * 1.1 + (gC - 0.5) * 0.8 - 0.9 * ((gF2 - gF1) < 0.9)
sun = noise(20, 77)
gi = 2.9 + 3.0 * n1 + clump + 1.2 * (sun > 0.66) + 0.6 * (sun > 0.8) + 1.0 * edge - 2.4 * ao - 2.6 * shadow + 0.3 * (H > 50)
top[g] = ramp(G, gi[g], True, SX[g], SY[g])
m = MAT == DIRT
di = 1.6 + 2.2 * n2 - 1.5 * ao - 1.6 * shadow
top[m] = ramp(DR, di[m], True, SX[m], SY[m])
# bruk (Voronoi)
F1, F2, CID, DX, DY = vor(7.0, 0)
mortar = (F2 - F1) < 1.3
m = (MAT == PATH) | (MAT == PAVE)
ci = 2.2 + 1.6 * CID - 0.35 * (DX + DY) / 7.0 * 2 - 2.0 * shadow - 1.2 * ao
ci = np.where(mortar, 0.6 - shadow, ci)
top[m] = ramp(CB, ci[m], True, SX[m], SY[m])
m = MAT == WALL
tF1, tF2, tC, tDX, tDY = vor(9.0, 50)
wti = 2.6 + 1.6 * tC - 0.25 * (tDX + tDY) / 9.0 * 2 - 1.5 * ao
wti = np.where((tF2 - tF1) < 1.0, 0.8, wti)
wti = np.where(H == 72 + 118, wti - 0.9, wti)
top[m] = ramp(WL, wti[m], True, SX[m], SY[m])
# woda
wm = MAT == WATER
dist = ndi.distance_transform_edt(wm)
wn = fbm(41, (64, 32, 16))
depth = np.clip(dist / 70, 0, 1)
wi = 5.6 - 4.4 * depth + 0.8 * (wn - 0.5) - 1.6 * shadow
wf = fbm(43, (24, 12, 6))
wf2 = fbm(47, (40, 20, 10))
line1 = np.abs(wf - 0.5) < 0.028
line2 = np.abs(wf2 - 0.45) < 0.02
dark = np.abs(wf2 - 0.62) < 0.05
wi = np.where(dark, wi - 1.0, wi)
wi = np.where(line2, wi + 1.0, wi)
wi = np.where(line1, wi + 2.0, wi)
foam = dist < (2.2 + 3.0 * noise(8, 51))
wi = np.where(foam, 7.3 + (hsh(u, v, 9) > 0.5), wi)
top[wm] = ramp(WA, wi[wm], True, SX[wm], SY[wm])

_rr = np.random.default_rng(5)
ROWB = np.concatenate([[0], np.cumsum(6 + np.floor(_rr.random(80) * 5))]).astype(np.float32)
# ------------------------------------------------------------------ rasteryzacja (malarz po s)
img = np.zeros((Hs, W, 3), np.float32); img[:] = (10, 26, 20)
dep = np.full((Hs, W), -1, np.int64)
kind = np.full((Hs, W), -1, np.int8)   # -1 tło, MAT dla wierzchu, 10 = ściana
recs = []
vis = (SX >= 0) & (SX < W)
# wierzchy
mk = vis & (SY >= 0) & (SY < Hs)
recs.append((SY[mk], SX[mk], s[mk] * 2 + 1, top[mk], MAT[mk], u[mk], v[mk]))
# ściany: tekstury w układzie (wzdłuż krawędzi, wysokość z)
maxd = int(drop.max())
alongL, alongR = u.astype(np.float32), v.astype(np.float32)
for k in range(1, maxd + 1):
    m = vis & (drop >= k)
    yy = SY + k
    m &= (yy >= 0) & (yy < Hs)
    if not m.any():
        continue
    U_, V_ = u[m], v[m]
    z = (H[m] - k).astype(np.float32)
    fl = faceL[m]
    fls = faceLs[m]
    along = a[m].astype(np.float32)
    mat = MAT[m]
    col = np.zeros((m.sum(), 3), np.float32)
    xs, ys = SX[m], yy[m]
    # skała klifu: nieregularne bloki
    # skała klifu: nieregularne głazy (Voronoi w układzie ściany: wzdłuż x wysokość)
    cs = 11.0
    A_, Z_ = along, z * 1.25
    ga, gz = np.floor(A_ / cs), np.floor(Z_ / cs)
    f1 = np.full(len(z), 1e9, np.float32); f2 = f1.copy(); cid = np.zeros(len(z), np.float32)
    ddx = np.zeros(len(z), np.float32); ddy = ddx.copy()
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            ca, cz = ga + ox, gz + oy
            fa = (ca + 0.2 + 0.6 * hsh(ca, cz, 81)) * cs
            fz = (cz + 0.2 + 0.6 * hsh(ca, cz, 82)) * cs
            d = np.hypot((A_ - fa) * 0.85, Z_ - fz)
            c_ = d < f1
            f2 = np.where(c_, f1, np.minimum(f2, d)); cid = np.where(c_, hsh(ca, cz, 83), cid)
            ddx = np.where(c_, A_ - fa, ddx); ddy = np.where(c_, Z_ - fz, ddy); f1 = np.where(c_, d, f1)
    gap = f2 - f1
    lz = np.clip(-ddy / cs + 0.5, 0, 1)    # 1 = góra kamienia
    la = np.clip(ddx / cs + 0.5, 0, 1)
    edge_d = np.clip(gap / 4.0, 0, 1)
    ri = 1.6 + 1.9 * cid + 2.0 * lz * edge_d + 0.9 * (1 - la) * edge_d - 1.4 * (1 - edge_d)
    ri = ri - 0.7 + 1.3 * fls
    mort = gap < 1.1
    ri = np.where(mort, 0.1, ri)
    wet = z < 5
    ri = np.where(wet, ri - 1.2, ri)
    rock = ramp(RK, ri, True, xs, ys)
    # mur wieży: regularne ciosy
    # mur wieży: nieregularne ciosy, różne wysokości rzędów, narożniki (węgary), mech u podstawy
    rowb = ROWB
    row2 = np.clip(np.searchsorted(rowb, z, 'right') - 1, 0, len(rowb) - 2)
    rh2 = rowb[row2 + 1] - rowb[row2]
    lz2 = (z - rowb[row2]) / rh2
    bw2 = 10 + 12 * hsh(row2, 61)
    off2 = hsh(row2, 62) * 23
    alongW = np.where(fl, U_, V_).astype(np.float32)
    corner = np.minimum(np.minimum(np.abs(alongW - tu0), np.abs(alongW - tu1)), np.minimum(np.abs(alongW - tv0), np.abs(alongW - tv1)))
    quoin = (mat == WALL) & (corner < np.where(row2 % 2 == 0, 9, 5))
    bw2 = np.where(quoin, 9, bw2)
    cid2 = np.floor((along + off2) / bw2)
    la2 = ((along + off2) % bw2) / bw2
    bh2 = hsh(row2, cid2, 6)
    weather = (hsh(np.floor(along / 2), np.floor(z / 2), 64) > 0.9) * 0.9
    wi_ = 2.8 + 1.8 * bh2 + 1.3 * (lz2 > 0.78) - 1.1 * (lz2 < 0.18) + 0.6 * (la2 < 0.12) - 0.5 * (la2 > 0.9) - weather
    wi_ = np.where(quoin, wi_ + 0.9, wi_)
    wi_ = wi_ - 0.9 + 1.5 * fls
    joint = (lz2 < 0.1) | (la2 < 0.06)
    wi_ = np.where(joint, 0.9, wi_)
    wall = ramp(WL, wi_, True, xs, ys)
    warm = (bh2 > 0.66) & ~quoin
    wall = np.where(warm[:, None], ramp(CB, wi_ - 0.3, True, xs, ys), wall)
    base_moss = (mat == WALL) & (z < 80 + 10 * noise(16, 63)[m]) & ~joint & (hsh(U_, V_, 65) > 0.25)
    wall = np.where(base_moss[:, None], ramp(G, 2.0 + 1.2 * (lz2 > 0.6), True, xs, ys), wall)
    # drzwi (ściana R, wieża) i okno (ściana L)
    isw = mat == WALL
    zb = z - 80
    dc = (tv0 + tv1) / 2
    alongF = np.where(fl, U_, V_).astype(np.float32)
    door = isw & ~fl & (np.abs(alongF - dc) < 9) & (zb >= 0) & ((zb < 30) | ((alongF - dc) ** 2 + (zb - 30) ** 2 < 81))
    frame = isw & ~fl & (np.abs(alongF - dc) < 12) & (zb >= 0) & ((zb < 30) | ((alongF - dc) ** 2 + (zb - 30) ** 2 < 144)) & ~door
    plank = ((alongF - dc + 9) % 4.5) < 1
    dcol = ramp(DR, np.where(plank, 0.6, 2.6 + 1.2 * (zb % 11 < 1) - 0.8 * (zb > 30)), True, xs, ys)
    dcol = np.where((np.abs(alongF - dc - 5) < 1.2) & (np.abs(zb - 15) < 1.2), WL[6], dcol.T).T if False else dcol
    knob = door & (np.abs(alongF - dc + 5) < 1.5) & (np.abs(zb - 15) < 1.5)
    wc = (tu0 + tu1) / 2
    zw = z - 80 - 46
    win = isw & fl & (np.abs(alongF - wc) < 6) & (zw >= 0) & ((zw < 14) | ((alongF - wc) ** 2 + (zw - 14) ** 2 < 36))
    wfr = isw & fl & (np.abs(alongF - wc) < 9) & (zw >= -2) & ((zw < 14) | ((alongF - wc) ** 2 + (zw - 14) ** 2 < 81)) & ~win
    wcol = ramp(WA, np.where((np.abs(alongF - wc) < 0.8) | (np.abs(zw - 8) < 0.8), 0.0, 1.0 + 2.5 * ((alongF - wc + zw) % 7 < 2)), True, xs, ys)
    col[:] = rock
    col = np.where(isw[:, None] | (mat == PAVE)[:, None] | (mat == PATH)[:, None], wall, col)
    col = np.where(frame[:, None] | wfr[:, None], ramp(WL, np.full(len(z), 5.6), True, xs, ys), col)
    col = np.where(door[:, None], dcol, col)
    col = np.where(knob[:, None], WL[6][None], col)
    col = np.where(win[:, None], wcol, col)
    # mech i trawa zwisająca nad klifem
    gtop = (mat == GRASS) | (mat == DIRT)
    fringe = 2 + np.floor(4 * hsh(np.floor(along / 2), 11)) + np.where(hsh(np.floor(along / 2), 12) > 0.93, 3 + 6 * hsh(np.floor(along / 2), 13), 0)
    moss = gtop & (k <= fringe)
    mosscol = ramp(G, 3.6 - k * 0.35 - 1.0 * (~fl), True, xs, ys)
    col = np.where(moss[:, None], mosscol, col)
    mossy = gtop & (k > fringe) & (noise(16, 61)[m] > 0.62) & (k < 14) & ~mort & (lz > 0.45)
    col = np.where(mossy[:, None], ramp(G, 2.8 + 1.4 * lz - 0.8 * (1 - fls), True, xs, ys), col)
    recs.append((ys, xs, s[m] * 2, col, np.full(len(z), 10, np.int8), U_, V_))

Y = np.concatenate([r[0] for r in recs]); X = np.concatenate([r[1] for r in recs])
D = np.concatenate([r[2] for r in recs]); C = np.concatenate([r[3] for r in recs]); K = np.concatenate([r[4] for r in recs])
o = np.argsort(D, kind='stable')
PUa = np.concatenate([r[5] for r in recs]); PVa = np.concatenate([r[6] for r in recs])
pu = np.full((Hs, W), -9999, np.int32); pv = pu.copy()
pu[Y[o], X[o]] = PUa[o]; pv[Y[o], X[o]] = PVa[o]
img[Y[o], X[o]] = C[o]
dep[Y[o], X[o]] = D[o]
kind[Y[o], X[o]] = K[o]

# ------------------------------------------------------------------ detale ekranowe na trawie: kępki i kwiaty
R = np.random.default_rng(4)
gm = kind == GRASS
ys_, xs_ = np.nonzero(gm)
RES = dict()
sel = R.random(len(ys_)) < 0.075
for y, x in zip(ys_[sel], xs_[sel]):
    if y > 1 and gm[y - 1, x]:
        base = img[y, x].copy()
        img[y - 1, x] = np.clip(base * 1.28 + 12, 0, 255)
        img[y, x] = np.clip(base * 1.12 + 6, 0, 255)
        if y + 1 < Hs and gm[y + 1, x]:
            img[y + 1, x] = base * 0.72
fl_cluster = noise(24, 71)
FC = hexs(['#ffb02e', '#ffd84a', '#ff8a2a', '#f6f2e8', '#ff9a3a', '#9ab0ff', '#ff6a3a'])
for y, x in zip(ys_, xs_):
    pass
cand = R.random(len(ys_))
flc = fl_cluster[np.clip(ys_,0,N-1), np.clip(xs_,0,N-1)]
for idx in np.nonzero(cand < 0.05 * (flc > 0.62))[0]:
    y, x = ys_[idx], xs_[idx]
    if y < 2 or x < 1 or x >= W - 1:
        continue
    c = FC[R.integers(0, len(FC))]
    n_ = R.integers(1, 4)
    for t in range(n_):
        yy, xx = y + R.integers(-2, 3), x + R.integers(-3, 4)
        if 0 < yy < Hs - 1 and 0 <= xx < W and gm[yy, xx]:
            img[yy, xx] = c
            img[yy + 1, xx] = img[yy + 1, xx] * 0.75

(ROOT / 'build_tmp').mkdir(exist_ok=True); np.save(str(ROOT / 'build_tmp' / 'terrain_img.npy'), img); np.save(str(ROOT / 'build_tmp' / 'terrain_dep.npy'), dep); np.save(str(ROOT / 'build_tmp' / 'terrain_kind.npy'), kind)
np.save(str(ROOT / 'build_tmp' / 'H.npy'), H)
print('terrain ok', maxd)
