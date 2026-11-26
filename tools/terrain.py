"""Renderer pola wysokości w pikselach izometrycznych (uogólniony z dawnego scene.py).
Model jak w grze: kafel 64×32 px (32 teksele), poziomy terenu co 24 px, głębia s = u + v.
Tekstury liczone z globalnych współrzędnych (gu, gv), więc komórki mapy łączą się bez szwów."""
import numpy as np
from scipy import ndimage as ndi
import pixelkit as K
from pixelkit import ramp, hsh, vnoise, fbm, vor

GRASS, DIRT, PATH, WALL, PAVE, WATER, ROOF, WOOD = 0, 1, 2, 3, 4, 5, 6, 7
WALKABLE = [GRASS, DIRT, PATH, PAVE, WOOD]
CLIFF_KIND = 10

RF = K.hexs(['#2a1210', '#4a1c16', '#6a2a1c', '#8a3a22', '#a84e2a', '#c46a36', '#da8a4a'])   # dachówka
WD = K.hexs(['#24160c', '#432914', '#673e1c', '#8a5626', '#ad7034', '#cc8c46'])               # deski


def render(gu, gv, H, MAT, buildings, grass_pals, W, Hs, X0, Y0, seed=0, gpid=None):
    """gu, gv – globalne współrzędne tekseli (N×N), H – wysokości (int), MAT – materiały,
    buildings – lista dict(u0, u1, v0, v1, base, door, window) w tych samych współrzędnych co gu/gv.
    grass_pals – lista palet trawy, gpid – indeks palety dla każdego teksela (N×N).
    Zwraca dict z obrazem, buforem głębi, rodzajem piksela, mapą pikseli → teksel oraz danymi wody."""
    N = H.shape[0]
    grass_pal = grass_pals[0]
    if gpid is None:
        gpid = np.zeros(H.shape, np.int8)
    u, v = gu, gv
    a = (u - v).astype(np.int64)
    s = (u + v).astype(np.int64)
    a_loc = a - (u[0, 0] - v[0, 0])          # dla współrzędnych ekranu: lokalne, od lewego-górnego rogu
    s_loc = s - (u[0, 0] + v[0, 0])

    # sąsiedzi
    Hl = np.pad(H, ((0, 1), (0, 0)), mode='edge')[1:, :]    # (u, v+1)
    Hr = np.pad(H, ((0, 0), (0, 1)), mode='edge')[:, 1:]    # (u+1, v)
    Hd = np.pad(H, ((0, 1), (0, 1)), mode='edge')[1:, 1:]
    low = np.minimum(np.minimum(Hl, Hr), Hd)
    drop = np.clip(H - low, 0, None)
    drop[MAT == WATER] = 0
    faceL = Hl <= Hr
    faceLs = ndi.uniform_filter((Hl < Hr).astype(np.float32) + 0.5 * (Hl == Hr), 5)

    # cień rzucany (słońce z lewej-góry → cienie w +u) i AO
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

    SX = a_loc + X0
    SY = s_loc // 2 - H + Y0

    # ---- kolor wierzchu
    n1 = fbm(u, v, 21)
    n1 = K.stretch(n1)
    n2 = vnoise(u, v, 6, 33)
    top = np.zeros((N, N, 3), np.float32)
    g = MAT == GRASS
    gF1, gF2, gC, gDX, gDY = vor(u, v, 4.5, 20)
    clump = -(gDX + gDY) / 4.5 * 1.1 + (gC - 0.5) * 0.8 - 0.9 * ((gF2 - gF1) < 0.9)
    sun = K.stretch(vnoise(u, v, 20, 77) * 0.6 + vnoise(u, v, 10, 78) * 0.4, 0.15, 0.85)
    gi = 2.9 + 3.0 * n1 + clump + 1.2 * (sun > 0.66) + 0.6 * (sun > 0.8) + 1.0 * edge - 2.4 * ao - 2.6 * shadow + 0.3 * (H > 50)
    for pi, pal in enumerate(grass_pals):
        gp = g & (gpid == pi)
        if gp.any():
            top[gp] = ramp(pal, gi[gp], True, SX[gp], SY[gp])
    m = MAT == DIRT
    di = 1.6 + 2.2 * n2 - 1.5 * ao - 1.6 * shadow
    top[m] = ramp(K.DR, di[m], True, SX[m], SY[m])
    # bruk (Voronoi)
    F1, F2, CID, DX, DY = vor(u, v, 7.0, 0)
    mortar = (F2 - F1) < 1.3
    m = (MAT == PATH) | (MAT == PAVE)
    ci = 2.2 + 1.6 * CID - 0.35 * (DX + DY) / 7.0 * 2 - 2.0 * shadow - 1.2 * ao
    ci = np.where(mortar, 0.6 - shadow, ci)
    top[m] = ramp(K.CB, ci[m], True, SX[m], SY[m])
    # mur (wierzch)
    m = MAT == WALL
    tF1, tF2, tC, tDX, tDY = vor(u, v, 9.0, 50)
    wti = 2.6 + 1.6 * tC - 0.25 * (tDX + tDY) / 9.0 * 2 - 1.5 * ao
    wti = np.where((tF2 - tF1) < 1.0, 0.8, wti)
    top[m] = ramp(K.WL, wti[m], True, SX[m], SY[m])
    # dachówka: rzędy wzdłuż u, przesunięte co rząd
    m = MAT == ROOF
    rrow = np.floor(v / 5)
    rcol = np.floor((u + (rrow % 2) * 3) / 6)
    rl = (v % 5) / 5
    ri_ = 3.0 + 1.0 * hsh(rrow, rcol, 7) + 1.4 * (rl > 0.6) - 1.6 * (rl < 0.2) - 1.2 * shadow - 1.0 * ao
    top[m] = ramp(RF, ri_[m], True, SX[m], SY[m])
    # deski (most, pomosty)
    m = MAT == WOOD
    pl = np.floor(u / 6)
    wdi = 2.6 + 1.2 * hsh(pl, np.floor(v / 40), 5) - 1.6 * ((u % 6) < 1) - 1.4 * shadow
    top[m] = ramp(WD, wdi[m], True, SX[m], SY[m])
    # woda
    wm = MAT == WATER
    dist = ndi.distance_transform_edt(wm).astype(np.float32)
    wn = fbm(u, v, 41, (64, 32, 16), (1, .55, .3))
    wn = K.stretch(wn)
    depth = np.clip(dist / 70, 0, 1)
    wi = 5.6 - 4.4 * depth + 0.8 * (wn - 0.5) - 1.6 * shadow
    wf = K.stretch(fbm(u, v, 43, (24, 12, 6), (1, .55, .3)))
    wf2 = K.stretch(fbm(u, v, 47, (40, 20, 10), (1, .55, .3)))
    line1 = np.abs(wf - 0.5) < 0.028
    line2 = np.abs(wf2 - 0.45) < 0.02
    dark = np.abs(wf2 - 0.62) < 0.05
    wi = np.where(dark, wi - 1.0, wi)
    wi = np.where(line2, wi + 1.0, wi)
    wi = np.where(line1, wi + 2.0, wi)
    foamn = vnoise(u, v, 8, 51)
    foam = dist < (2.2 + 3.0 * foamn)
    wi = np.where(foam, 7.3 + (hsh(u, v, 9) > 0.5), wi)
    top[wm] = ramp(K.WA, wi[wm], True, SX[wm], SY[wm])

    # budynki: mapa id do narożników (węgary), drzwi i okien
    BID = np.full((N, N), -1, np.int16)
    for i, b in enumerate(buildings):
        BID[(u >= b['u0']) & (u <= b['u1']) & (v >= b['v0']) & (v <= b['v1'])] = i
    bu0 = np.array([b['u0'] for b in buildings] + [0], np.float32)
    bu1 = np.array([b['u1'] for b in buildings] + [0], np.float32)
    bv0 = np.array([b['v0'] for b in buildings] + [0], np.float32)
    bv1 = np.array([b['v1'] for b in buildings] + [0], np.float32)
    bbase = np.array([b['base'] for b in buildings] + [0], np.float32)
    bdoor = np.array([b.get('door', True) for b in buildings] + [False])
    bwin = np.array([b.get('window', True) for b in buildings] + [False])
    bwinz = np.array([b.get('winz', 46) for b in buildings] + [0], np.float32)

    _rr = np.random.default_rng(5)
    ROWB = np.concatenate([[0], np.cumsum(6 + np.floor(_rr.random(80) * 5))]).astype(np.float32)
    mossn = vnoise(u, v, 16, 63)
    mossn2 = vnoise(u, v, 16, 61)

    # ---- rasteryzacja (malarz po s)
    img = np.zeros((Hs, W, 3), np.float32); img[:] = (10, 26, 20)
    dep = np.full((Hs, W), -1, np.int64)
    kind = np.full((Hs, W), -1, np.int8)
    recs = []
    vis = (SX >= 0) & (SX < W)
    mk = vis & (SY >= 0) & (SY < Hs)
    recs.append((SY[mk], SX[mk], s_loc[mk] * 2 + 1, top[mk], MAT[mk], u[mk], v[mk]))
    maxd = int(drop.max())
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
        bid = BID[m].astype(np.int64)
        xs, ys = SX[m], yy[m]
        n_ = len(z)
        # skała klifu: nieregularne głazy (Voronoi w układzie ściany: wzdłuż × wysokość)
        cs = 11.0
        A_, Z_ = along, z * 1.25
        ga, gz = np.floor(A_ / cs), np.floor(Z_ / cs)
        f1 = np.full(n_, 1e9, np.float32); f2 = f1.copy(); cid = np.zeros(n_, np.float32)
        ddx = np.zeros(n_, np.float32); ddy = ddx.copy()
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
        lz = np.clip(-ddy / cs + 0.5, 0, 1)
        la = np.clip(ddx / cs + 0.5, 0, 1)
        edge_d = np.clip(gap / 4.0, 0, 1)
        ri = 1.6 + 1.9 * cid + 2.0 * lz * edge_d + 0.9 * (1 - la) * edge_d - 1.4 * (1 - edge_d)
        ri = ri - 0.7 + 1.3 * fls
        mort = gap < 1.1
        ri = np.where(mort, 0.1, ri)
        ri = np.where(z < 5, ri - 1.2, ri)
        rock = ramp(K.RK, ri, True, xs, ys)
        # mur: nieregularne ciosy, różne wysokości rzędów, narożniki (węgary), mech u podstawy
        zb = z - bbase[bid]                               # wysokość nad podstawą budynku
        zr = np.where(bid >= 0, zb, z)
        row2 = np.clip(np.searchsorted(ROWB, np.maximum(zr, 0), 'right') - 1, 0, len(ROWB) - 2)
        rh2 = ROWB[row2 + 1] - ROWB[row2]
        lz2 = (zr - ROWB[row2]) / rh2
        bw2 = 10 + 12 * hsh(row2, 61)
        off2 = hsh(row2, 62) * 23
        alongW = np.where(fl, U_, V_).astype(np.float32)
        corner = np.where(fl, np.minimum(np.abs(alongW - bu0[bid]), np.abs(alongW - bu1[bid])),
                          np.minimum(np.abs(alongW - bv0[bid]), np.abs(alongW - bv1[bid])))
        quoin = (mat == WALL) & (bid >= 0) & (corner < np.where(row2 % 2 == 0, 9, 5))
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
        wall = ramp(K.WL, wi_, True, xs, ys)
        warm = (bh2 > 0.66) & ~quoin
        wall = np.where(warm[:, None], ramp(K.CB, wi_ - 0.3, True, xs, ys), wall)
        base_moss = (mat == WALL) & (zr < 10 + 10 * mossn[m]) & ~joint & (hsh(U_, V_, 65) > 0.25)
        wall = np.where(base_moss[:, None], ramp(K.G, 2.0 + 1.2 * (lz2 > 0.6), True, xs, ys), wall)
        # drzwi (ściana +u) i okno (ściana +v) budynków
        isb = (bid >= 0) & ((mat == WALL) | (mat == ROOF))
        dc = (bv0[bid] + bv1[bid]) / 2
        alongF = np.where(fl, U_, V_).astype(np.float32)
        onR = isb & ~fl & (np.abs(U_ - bu1[bid]) < 1.5) & bdoor[bid]
        door = onR & (np.abs(alongF - dc) < 9) & (zb >= 0) & ((zb < 30) | ((alongF - dc) ** 2 + (zb - 30) ** 2 < 81))
        frame = onR & (np.abs(alongF - dc) < 12) & (zb >= 0) & ((zb < 30) | ((alongF - dc) ** 2 + (zb - 30) ** 2 < 144)) & ~door
        plank = ((alongF - dc + 9) % 4.5) < 1
        dcol = ramp(K.DR, np.where(plank, 0.6, 2.6 + 1.2 * (zb % 11 < 1) - 0.8 * (zb > 30)), True, xs, ys)
        knob = door & (np.abs(alongF - dc + 5) < 1.5) & (np.abs(zb - 15) < 1.5)
        wc = (bu0[bid] + bu1[bid]) / 2
        onL = isb & fl & (np.abs(V_ - bv1[bid]) < 1.5) & bwin[bid]
        zw = zb - bwinz[bid]
        win = onL & (np.abs(alongF - wc) < 6) & (zw >= 0) & ((zw < 14) | ((alongF - wc) ** 2 + (zw - 14) ** 2 < 36))
        wfr = onL & (np.abs(alongF - wc) < 9) & (zw >= -2) & ((zw < 14) | ((alongF - wc) ** 2 + (zw - 14) ** 2 < 81)) & ~win
        wcol = ramp(K.WA, np.where((np.abs(alongF - wc) < 0.8) | (np.abs(zw - 8) < 0.8), 0.0, 1.0 + 2.5 * ((alongF - wc + zw) % 7 < 2)), True, xs, ys)
        col = rock.copy()
        stone = (mat == WALL) | (mat == PAVE) | (mat == PATH) | (mat == ROOF)
        col = np.where(stone[:, None], wall, col)
        woodf = mat == WOOD
        col = np.where(woodf[:, None], ramp(WD, 2.2 + 1.0 * (z % 6 < 1) - 0.8 * fl, True, xs, ys), col)
        col = np.where(frame[:, None] | wfr[:, None], ramp(K.WL, np.full(n_, 5.6), True, xs, ys), col)
        col = np.where(door[:, None], dcol, col)
        col = np.where(knob[:, None], K.WL[6][None], col)
        col = np.where(win[:, None], wcol, col)
        # mech i trawa zwisająca nad klifem
        gtop = (mat == GRASS) | (mat == DIRT)
        fringe = 2 + np.floor(4 * hsh(np.floor(along / 2), 11)) + np.where(hsh(np.floor(along / 2), 12) > 0.93, 3 + 6 * hsh(np.floor(along / 2), 13), 0)
        moss = gtop & (k <= fringe)
        mosscol = ramp(grass_pal, 3.6 - k * 0.35 - 1.0 * (~fl), True, xs, ys)
        col = np.where(moss[:, None], mosscol, col)
        mossy = gtop & (k > fringe) & (mossn2[m] > 0.62) & (k < 14) & ~mort & (lz > 0.45)
        col = np.where(mossy[:, None], ramp(grass_pal, 2.8 + 1.4 * lz - 0.8 * (1 - fls), True, xs, ys), col)
        recs.append((ys, xs, s_loc[m] * 2, col, np.full(n_, CLIFF_KIND, np.int8), U_, V_))

    Y = np.concatenate([r[0] for r in recs]); X = np.concatenate([r[1] for r in recs])
    D = np.concatenate([r[2] for r in recs]); C = np.concatenate([r[3] for r in recs]); KD = np.concatenate([r[4] for r in recs])
    o = np.argsort(D, kind='stable')
    PUa = np.concatenate([r[5] for r in recs]); PVa = np.concatenate([r[6] for r in recs])
    pu = np.full((Hs, W), -99999, np.int64); pv = pu.copy()
    pu[Y[o], X[o]] = PUa[o]; pv[Y[o], X[o]] = PVa[o]
    img[Y[o], X[o]] = C[o]
    dep[Y[o], X[o]] = D[o]
    kind[Y[o], X[o]] = KD[o]

    # ---- detale ekranowe na trawie: kępki i kwiaty
    R = np.random.default_rng(4 + seed)
    gm = kind == GRASS
    ys_, xs_ = np.nonzero(gm)
    sel = R.random(len(ys_)) < 0.075
    yA, xA = ys_[sel], xs_[sel]
    ok = (yA > 1) & gm[np.maximum(yA - 1, 0), xA]
    yA, xA = yA[ok], xA[ok]
    base = img[yA, xA].copy()
    img[yA - 1, xA] = np.clip(base * 1.28 + 12, 0, 255)
    img[yA, xA] = np.clip(base * 1.12 + 6, 0, 255)
    below = (yA + 1 < Hs) & gm[np.minimum(yA + 1, Hs - 1), xA]
    img[yA[below] + 1, xA[below]] = base[below] * 0.72
    FC = K.hexs(['#ffb02e', '#ffd84a', '#ff8a2a', '#f6f2e8', '#ff9a3a', '#9ab0ff', '#ff6a3a'])
    flc = vnoise(xs_.astype(np.float32), ys_.astype(np.float32), 24, 71 + seed)
    cand = R.random(len(ys_))
    for idx in np.nonzero(cand < 0.05 * (flc > 0.62))[0]:
        y, x = ys_[idx], xs_[idx]
        if y < 2 or x < 1 or x >= W - 1:
            continue
        c = FC[R.integers(0, len(FC))]
        for t in range(R.integers(1, 4)):
            yy, xx = y + R.integers(-2, 3), x + R.integers(-3, 4)
            if 0 < yy < Hs - 1 and 0 <= xx < W and gm[yy, xx]:
                img[yy, xx] = c
                img[yy + 1, xx] = img[yy + 1, xx] * 0.75

    return dict(img=img, dep=dep, kind=kind, pu=pu, pv=pv, shadow=shadow, dist=dist, wn=wn, wf=wf, wf2=wf2, foamn=foamn)
