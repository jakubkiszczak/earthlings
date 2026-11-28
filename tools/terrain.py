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

RF = K.hexs(['#2e1610', '#4e2216', '#72301c', '#963f22', '#b4522a', '#cc6a34', '#e08844', '#f0aa62'])   # dachówka (ciepła terakota)
RB = K.hexs(['#1c140e', '#33241a', '#4a3424', '#62462e', '#7a5a3a', '#94704a', '#ae885a'])   # gont brązowy
RS = K.hexs(['#14161e', '#22263a', '#323a52', '#46506a', '#5c6882', '#76829a', '#929eb2'])   # łupek
# dachy w stylu domów drewnianych (paczka domy_drewniane): pomarańczowo-czerwona dachówka, niebieska, turkusowa, fioletowa
RO = K.hexs(['#3a1410', '#6a2418', '#9a3420', '#c44a2a', '#dc6238', '#ec7c4c', '#f69a66', '#ffb886'])
RBL = K.hexs(['#0e1636', '#18285e', '#203c86', '#2a52ac', '#3668c8', '#4e84dc', '#70a0ec', '#94bcf6'])
RT = K.hexs(['#0a2626', '#104040', '#185a5a', '#207876', '#2a948e', '#40b0a4', '#62c8ba', '#8cdece'])
RP = K.hexs(['#1c0e2e', '#341856', '#4c227e', '#642ea2', '#7c42bc', '#965cd0', '#ae7ae0', '#c69cee'])
ROOF_PALS = [RF, RB, RS, RO, RBL, RT, RP]
ROOF_PAL = {'terracotta': 0, 'shingle': 1, 'slate': 2, 'orange': 3, 'blue': 4, 'teal': 5, 'purple': 6}
# ściany: kamień, tynk z murem pruskim, bale, deski pionowe, kamienny parter + mur pruski, dom kupca (deski + mur pruski)
STYLE = {'stone': 0, 'plaster': 1, 'logs': 2, 'planks': 3, 'timber_stone': 4, 'merchant': 5}
LOG = K.hexs(['#2a160c', '#4a2814', '#6c3c1c', '#8c5226', '#a86a32', '#c28444', '#d8a060'])     # bale (ciepły brąz)
PLK = K.hexs(['#26160c', '#422814', '#5e3a1c', '#7a4e26', '#966432', '#b07c42', '#c89656'])     # deski
PL = K.hexs(['#4e4234', '#7c6c56', '#a8987c', '#c8ba9c', '#ded2b6', '#eee6d0', '#f8f2e2'])    # tynk (złamana biel)
IVY = K.hexs(['#1a3a1c', '#24522a', '#356a32', '#4c8a3a', '#6aa848'])                      # bluszcz
SHUT = [K.hexs(['#1e3a2c', '#2c5a40', '#3e7a54']), K.hexs(['#1e2e4a', '#2e4a72', '#4a6a96']), K.hexs(['#3a2416', '#5a3a22', '#7a5230'])]   # okiennice
ROOFS = {'flat': 0, 'gable_u': 1, 'gable_v': 2, 'hip': 3}
WD = K.hexs(['#24160c', '#432914', '#673e1c', '#8a5626', '#ad7034', '#cc8c46'])               # deski


def render(gu, gv, H, MAT, buildings, grass_pals, W, Hs, X0, Y0, seed=0, gpid=None, wood_axis='u'):
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
    drop[(MAT == WATER) & (low > H - 40)] = 0        # woda nie ma ścian, poza wodospadem na krawędzi świata
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
    # kamyki i grudki w ziemi
    peb = hsh(u, v, 141)
    di = np.where(peb > 0.94, di + 1.6, np.where(peb < 0.05, di - 1.2, di))
    top[m] = ramp(K.DR, di[m], True, SX[m], SY[m])
    # bruk (Voronoi)
    F1, F2, CID, DX, DY = vor(u, v, 7.0, 0)
    mortar = (F2 - F1) < 1.3
    m = (MAT == PATH) | (MAT == PAVE)
    ci = 2.2 + 1.6 * CID - 0.35 * (DX + DY) / 7.0 * 2 - 2.0 * shadow - 1.2 * ao
    # każdy kamień: jasna krawędź od światła, ciemna od cienia, drobne pęknięcia i zabrudzenia
    rim = ((F2 - F1) < 2.4) & ~mortar
    ci = np.where(rim & ((DX + DY) < 0), ci + 0.9, ci)
    ci = np.where(rim & ((DX + DY) >= 0), ci - 0.7, ci)
    crack = (np.abs(DX - DY * 0.6 - (CID - 0.5) * 3) < 0.45) & (CID > 0.75) & ~mortar
    ci = np.where(crack, ci - 1.4, ci)
    ci = np.where(hsh(u, v, 131) > 0.97, ci - 1.0, ci)
    ci = np.where(mortar, 0.6 - shadow, ci)
    top[m] = ramp(K.CB, ci[m], True, SX[m], SY[m])
    # mech w fugach (wilgotne miejsca) i krawężnik przy trawie
    mossy_m = m & mortar & (vnoise(u, v, 24, 133) > 0.5) & (hsh(u, v, 134) > 0.35)
    top[mossy_m] = ramp(grass_pal, (1.8 + 1.2 * hsh(u, v, 135) - shadow)[mossy_m], True, SX[mossy_m], SY[mossy_m])
    edge_d = ndi.distance_transform_edt(m)
    curb = m & (edge_d < 2.6)
    top[curb] = ramp(K.CB, (1.4 + 1.6 * (edge_d < 1.5) + 0.6 * hsh(np.floor(u / 3), np.floor(v / 3), 136) - 1.4 * shadow)[curb], True, SX[curb], SY[curb])
    # mur (wierzch)
    m = MAT == WALL
    tF1, tF2, tC, tDX, tDY = vor(u, v, 9.0, 50)
    wti = 2.6 + 1.6 * tC - 0.25 * (tDX + tDY) / 9.0 * 2 - 1.5 * ao
    wti = np.where((tF2 - tF1) < 1.0, 0.8, wti)
    top[m] = ramp(K.WL, wti[m], True, SX[m], SY[m])
    # budynki: mapa id, parametry (dach, ściany, drzwi, okna)
    BID = np.full((N, N), -1, np.int16)
    for i, b in enumerate(buildings):
        BID[(u >= b['u0']) & (u <= b['u1']) & (v >= b['v0']) & (v <= b['v1'])] = i
    barr = lambda key, dflt, dt=np.float32: np.array([b.get(key, dflt) for b in buildings] + [dflt], dt)
    bu0, bu1 = barr('u0', 0), barr('u1', 0)
    bv0, bv1 = barr('v0', 0), barr('v1', 0)
    bbase = barr('base', 0)
    beave = np.array([b.get('eave', b.get('top', 0)) for b in buildings] + [0], np.float32)
    broof = np.array([ROOFS[b.get('roof', 'flat')] for b in buildings] + [0], np.int8)
    bpal = barr('roofpal', 0, np.int8)
    bstyle = np.array([STYLE.get(b.get('walls', 'stone'), 0) for b in buildings] + [0], np.int8)
    bplaster = np.isin(bstyle, (1, 4, 5))                        # część tynkowana (mur pruski)
    blow = barr('lowh', 0)                                       # wysokość parteru (kamień / deski pod murem pruskim)
    bdoorf = np.array([{'u': 1, 'v': 2}.get(b.get('door'), 0) for b in buildings] + [0], np.int8)
    bwu, bwv = barr('wins_u', 0, np.int8), barr('wins_v', 0, np.int8)
    bwinz = barr('winz', 18)
    bdw, bdh = barr('doorw', 11), barr('doorh', 36)          # pół-szerokość i wysokość drzwi (do łuku)
    bww, bwh = barr('winw', 6), barr('winh', 16)            # pół-szerokość i wysokość okna (do łuku)
    bwgap = barr('wingap', 20)                                # odstęp między rzędami okien
    bst = np.array([b.get('stained', False) for b in buildings] + [False])   # witraże

    # dach: rzędy dachówek prostopadle do spadku, połać od światła jaśniejsza
    m = MAT == ROOF
    bid_t = BID.astype(np.int64)
    du_e = np.minimum(u - bu0[bid_t], bu1[bid_t] - u)
    dv_e = np.minimum(v - bv0[bid_t], bv1[bid_t] - v)
    rk = broof[bid_t]
    rows_by_u = (rk == ROOFS['gable_v']) | ((rk == ROOFS['hip']) & (du_e < dv_e))
    q_ = np.where(rows_by_u, u, v); p_ = np.where(rows_by_u, v, u)
    rrow = np.floor(q_ / 4)
    rcol = np.floor((p_ + (rrow % 2) * 2.5) / 5)
    rl = (q_ % 4) / 4
    seam = ((p_ + (rrow % 2) * 2.5) % 5) < 0.9
    gHu = np.pad(H, ((0, 0), (1, 1)), mode='edge')[:, 2:] - np.pad(H, ((0, 0), (1, 1)), mode='edge')[:, :-2]
    gHv = np.pad(H, ((1, 1), (0, 0)), mode='edge')[2:, :] - np.pad(H, ((1, 1), (0, 0)), mode='edge')[:-2, :]
    lit = np.sign(gHu) - np.sign(gHv)
    ridge = (np.abs(gHu) + np.abs(gHv) == 0) & (rk != ROOFS['flat'])
    tj = hsh(rrow, rcol, 7)
    redge = (np.minimum(du_e, dv_e) < 1.6) & (rk != ROOFS['flat'])          # obrys połaci (okap / wiatrownica)
    ri_ = (4.0 + 0.9 * lit + 1.5 * (tj - 0.5) + 1.0 * (rl > 0.62) - 1.6 * (rl < 0.22) - 0.8 * seam
           - 1.0 * shadow - 0.6 * ao + 0.6 * ridge - 1.2 * (tj > 0.96) - 2.6 * redge)
    for pi, pal in enumerate(ROOF_PALS):
        mp = m & (bpal[bid_t] == pi)
        if mp.any():
            top[mp] = ramp(pal, ri_[mp], True, SX[mp], SY[mp])
    # mech i porosty na dachówkach (plamy)
    rmoss = m & (vnoise(u, v, 14, 66) > 0.7) & (hsh(rrow, rcol, 67) > 0.35) & (rl >= 0.22)
    top[rmoss] = ramp(K.G, (2.2 + 1.2 * (rl > 0.62) + 0.8 * lit - shadow)[rmoss], True, SX[rmoss], SY[rmoss])
    # deski (most, pomosty)
    m = MAT == WOOD
    wa_, wb_ = (v, u) if wood_axis == 'v' else (u, v)
    pl = np.floor(wa_ / 6)
    wdi = 2.6 + 1.2 * hsh(pl, np.floor(wb_ / 40), 5) - 1.6 * ((wa_ % 6) < 1) - 1.4 * shadow
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
        quoin = (mat == WALL) & (bid >= 0) & ~bplaster[bid] & (corner < np.where(row2 % 2 == 0, 9, 5))
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
        # budynki: ściana do okapu (kamień lub tynk z belkami), szczyt przy dachu dwuspadowym, połać dachu
        isb = (bid >= 0) & ((mat == WALL) | (mat == ROOF))
        onU = isb & ~fl & (np.abs(U_ - bu1[bid]) < 1.5)          # ściana +u (wzdłuż v)
        onV = isb & fl & (np.abs(V_ - bv1[bid]) < 1.5)           # ściana +v (wzdłuż u)
        eaveb = beave[bid] - bbase[bid]
        rk_ = broof[bid]
        gable_end = ((rk_ == ROOFS['gable_u']) & onU) | ((rk_ == ROOFS['gable_v']) & onV)
        wallpx = isb & ((zb < eaveb) | gable_end | (rk_ == ROOFS['flat']))
        roofpx = isb & ~wallpx
        alongF = np.where(fl, U_, V_).astype(np.float32)
        # komin (mur ponad okapem wewnątrz budynku) – kamień, nie dach
        chim = isb & (mat == WALL) & (zb >= eaveb) & ~gable_end
        roofpx = roofpx & ~chim
        # mur pruski: słupy co 24, oczep pod okapem i belki stropowe co piętro, ukośne zastrzały w części pól
        cornerF = np.where(fl, np.minimum(U_ - bu0[bid], bu1[bid] - U_), np.minimum(V_ - bv0[bid], bv1[bid] - V_))
        fh = np.where(eaveb >= 105, 60.0, 1e9)                         # wysokość piętra (belka stropowa; skala postaci 42×63)
        zf_ = np.where(zb >= 8, zb - 8, -1)                            # nad kamienną podmurówką
        fin = zf_ % fh
        panel = np.floor((alongF + 12) / 24)
        pa_ = (alongF + 12) % 24
        brace = (hsh(panel, np.floor(zf_ / fh), 72) > 0.45) & (zf_ >= 0)
        diag = brace & (np.abs(pa_ - fin * 24 / np.minimum(fh, eaveb - 8 + 1e-3)) < 1.9) & (zb < eaveb)
        diag2 = brace & (hsh(panel, 73) > 0.5) & (np.abs((24 - pa_) - fin * 24 / np.minimum(fh, eaveb - 8 + 1e-3)) < 1.9) & (zb < eaveb)
        beam = (cornerF < 3) | ((zb >= 8) & (zb < 11)) | ((np.abs(zb - eaveb) < 2.5) & (zb < eaveb + 1)) | (pa_ < 2.5)
        beam |= (fin < 2.5) & (zf_ > 4) & (zb < eaveb - 4)
        beam |= diag | diag2
        beam |= gable_end & (zb >= eaveb) & (((alongF + 3) % 12) < 2)
        # tynk: przebarwienia, zacieki, brud przy ziemi, odpryski z cegłą
        stain = vnoise(alongF, zb * 1.6, 7, 91) - 0.5
        pli = 4.2 + 0.7 * hsh(np.floor(alongF / 3), np.floor(zb / 3), 71) + 1.4 * stain - 0.9 * (~fl) + 0.6 * fls
        pli = pli - np.clip((22 - zb) / 22, 0, 1) * 1.3 - 1.4 * ((eaveb - zb) < 7) * (zb < eaveb)
        plcol = ramp(PL, pli, True, xs, ys)
        chip = (vnoise(alongF, zb, 6, 94) > 0.82) & (hsh(np.floor(alongF / 4), np.floor(zb / 2.5), 95) > 0.3)
        brick = ramp(RF, 2.4 + 1.2 * (zb % 2.5 < 0.8) - 0.6 * (~fl), True, xs, ys)
        plcol = np.where(chip[:, None], brick, plcol)
        plcol = np.where(beam[:, None], ramp(WD, 1.2 + 0.9 * fl + 0.5 * hsh(np.floor(alongF / 2), np.floor(zb / 6), 74), True, xs, ys), plcol)
        plinth = zb < 8                                                # kamienna podmurówka pod tynkiem
        # połać dachu widziana z boku: rzędy dachówek z ciemną dolną krawędzią, okap z cienkim ciemnym obrzeżem
        trow = np.floor((zb - eaveb) / 4); tl_ = ((zb - eaveb) % 4) / 4
        tcol = np.floor((alongF + (trow % 2) * 2.5) / 5)
        tseam = ((alongF + (trow % 2) * 2.5) % 5) < 0.9
        rface = (2.6 + 1.3 * fl + 1.2 * (hsh(trow, tcol, 75) - 0.5) - 1.6 * (tl_ < 0.25) + 0.7 * (tl_ > 0.7) - 0.8 * tseam
                 - 2.2 * (zb - eaveb < 1.5))
        rcol_ = np.zeros((n_, 3), np.float32)
        for pi, pal in enumerate(ROOF_PALS):
            sel = roofpx & (bpal[bid] == pi)
            if sel.any():
                rcol_[sel] = ramp(pal, rface[sel], True, xs[sel], ys[sel])
        # drzwi
        dcu = (bv0[bid] + bv1[bid]) / 2           # środek ściany +u (współrzędna v)
        dcv = (bu0[bid] + bu1[bid]) / 2           # środek ściany +v (współrzędna u)
        onDoorFace = (onU & (bdoorf[bid] == 1)) | (onV & (bdoorf[bid] == 2))
        dc = np.where(fl, dcv, dcu)
        dw, dh, ad = bdw[bid], bdh[bid], alongF - dc
        door = onDoorFace & (np.abs(ad) < dw) & (zb >= 0) & ((zb < dh) | (ad ** 2 + (zb - dh) ** 2 < dw ** 2))
        frame = onDoorFace & (np.abs(ad) < dw + 3) & (zb >= 0) & ((zb < dh) | (ad ** 2 + (zb - dh) ** 2 < (dw + 3) ** 2)) & ~door
        plank = ((ad + dw) % 4.5) < 1
        double = (dw > 11) & (np.abs(ad) < 0.8)                     # dwuskrzydłowe drzwi: szczelina
        dcol = ramp(K.DR, np.where(plank | double, 0.6, 2.6 + 1.2 * (zb % 11 < 1) - 0.8 * (zb > dh)), True, xs, ys)
        knob = door & (np.abs(np.abs(ad) - np.where(dw > 11, 3, 5)) < 1.5) & (np.abs(zb - dh * 0.5) < 1.5)
        iron = door & (dw > 11) & ((np.abs(zb - dh * 0.25) < 0.8) | (np.abs(zb - dh * 0.7) < 0.8))   # okucia
        # okna: n na ścianę, równo rozłożone, z pominięciem miejsca na drzwi; drugi rząd przy wysokich ścianach
        nwin = np.where(fl, bwu[bid], bwv[bid]).astype(np.float32)
        f0 = np.where(fl, bu0[bid], bv0[bid]); f1 = np.where(fl, bu1[bid], bv1[bid])
        span = np.maximum(f1 - f0, 1)
        kk = np.clip(np.round((alongF - f0) / span * (nwin + 1)), 1, np.maximum(nwin, 1))
        wc = f0 + kk * span / (nwin + 1)
        wface = (onU | onV) & (nwin > 0) & (zb < eaveb) & ~(onDoorFace & (np.abs(wc - dc) < 16))
        win = np.zeros(n_, bool); wfr = np.zeros(n_, bool); wcol = np.zeros((n_, 3), np.float32)
        for row in (0, 1):
            ww, wh, aw = bww[bid], bwh[bid], alongF - wc
            zw = zb - bwinz[bid] - row * (wh + bwgap[bid])
            ok_row = wface & ((row == 0) | (eaveb >= bwinz[bid] + 2 * wh + bwgap[bid] + 12)) & (zw + wh + ww + 2 < eaveb)
            stb = bst[bid]
            arch = (zw < wh) | (stb & (aw ** 2 + (zw - wh) ** 2 < ww ** 2))
            w_ = ok_row & (np.abs(aw) < ww) & (zw >= 0) & arch
            f_ = ok_row & (np.abs(aw) < ww + 2) & (zw >= -2) & ((zw < wh + 2) | (stb & (aw ** 2 + (zw - wh) ** 2 < (ww + 2) ** 2))) & ~w_
            cross = (np.abs(aw) < 0.8) | (np.abs(zw - wh * 0.5) < 0.8)
            warmw = hsh(bid.astype(np.float32), np.floor(wc), 76) > 0.72          # część okien rozświetlona od środka
            glassv = np.where(cross, 0.0, 1.0 + 2.5 * ((aw + zw) % 7 < 2) + 0.8 * (zw > wh * 0.6))
            wc_ = ramp(K.WA, glassv * 0.7, True, xs, ys) * 0.75
            wc_ = np.where((warmw & ~cross)[:, None], ramp(K.hexs(['#5a3a14', '#a8701e', '#e8b040', '#ffe08a']), 1.2 + 1.6 * (zw > wh * 0.4), True, xs, ys), wc_)
            # okiennice po bokach i skrzynka z kwiatami pod oknem (domy, nie witraże)
            houseW = ok_row & ~stb
            shut = houseW & (np.abs(aw) >= ww + 2) & (np.abs(aw) < ww + 7) & (zw >= -1) & (zw < wh + 1)
            sp_ = SHUT[0]
            shc = np.zeros((n_, 3), np.float32)
            for si, spal in enumerate(SHUT):
                selc = (np.floor(hsh(bid.astype(np.float32), 77) * 3) == si)
                shc = np.where(selc[:, None], ramp(spal, 1.2 + 0.6 * fl + 0.8 * ((np.abs(aw) - ww) % 2.5 < 0.8) * -1 + 0.6, True, xs, ys), shc)
            fbox = houseW & (np.abs(aw) < ww + 3) & (zw >= -7) & (zw < -3)
            flw = houseW & (np.abs(aw) < ww + 3) & (zw >= -3) & (zw < 0.5)
            fcols = K.hexs(['#e83a4a', '#ff7a9a', '#ffd84a', '#f6f2e8', '#ff8a2a', '#c84ac8'])
            fpick = fcols[(np.floor(hsh(np.floor(aw), np.floor(zw), bid.astype(np.float32)) * 6).astype(int)) % 6]
            leaf = hsh(np.floor(aw * 1.0), np.floor(zw), 78) > 0.5
            flc = np.where(leaf[:, None], ramp(IVY, 2.0 + 1.0 * fl, True, xs, ys), fpick)
            wcol = np.where(shut[:, None], shc, wcol); win |= shut
            wcol = np.where(fbox[:, None], ramp(WD, 1.6 + 0.8 * fl + 0.8 * (zw > -4.5), True, xs, ys), wcol); win |= fbox
            wcol = np.where(flw[:, None], flc, wcol); win |= flw
            # witraż: kolorowe szkiełka w ołowianej siatce
            glass = K.hexs(['#c83a3a', '#3a5ac8', '#e8c040', '#3aa05a', '#9a4ac8', '#e87a2a'])
            gi = np.floor(hsh(np.floor((aw + 20) / 2.5), np.floor(zw / 3), 97) * len(glass)).astype(int) % len(glass)
            lead = ((aw + 20) % 2.5 < 0.7) | (zw % 3 < 0.7)
            sg = np.where(lead[:, None], np.array([26, 20, 24], np.float32), glass[gi] * (0.85 + 0.3 * ((aw + zw) % 5 < 1))[:, None])
            wc_ = np.where(bst[bid][:, None], sg, wc_)
            wcol = np.where(w_[:, None], wc_, wcol)
            win |= w_; wfr |= f_
        col = rock.copy()
        stone = (mat == WALL) | (mat == PAVE) | (mat == PATH) | (mat == ROOF)
        col = np.where(stone[:, None], wall, col)
        col = np.where((wallpx & bplaster[bid] & ~plinth)[:, None], plcol, col)
        # domy drewniane: bale (poziome, zaokrąglone, końce na narożnikach) i deski pionowe
        sty = bstyle[bid]
        lowh = blow[bid]
        lz = (zb % 7) / 7
        lrow = np.floor(zb / 7)
        grain = vnoise(alongF * 0.5, zb, 5, 120) - 0.5
        lgi = 1.3 + 3.4 * np.sin(np.pi * np.clip(lz, 0, 1)) + 0.8 * grain + 0.7 * (hsh(lrow, np.floor(alongF / 28), 121) - 0.5) - 0.8 * (~fl) + 0.5 * fls
        lgi = np.where(lz < 0.15, 0.3, lgi)                                         # szczelina między balami
        ring = np.hypot(cornerF - 2.2, (zb % 7) - 3.5)
        lend = cornerF < 4.4
        lgi = np.where(lend, 4.0 - 1.1 * (ring % 2 < 0.8) - 2.6 * (ring > 3.3) - 0.6 * (~fl), lgi)   # słoje na końcach bali
        logcol = ramp(LOG, lgi, True, xs, ys)
        bp = (alongF % 6) / 6
        board = np.floor(alongF / 6)
        pki = 2.8 + 1.1 * (hsh(board, 122) - 0.5) + 0.8 * (vnoise(alongF, zb * 0.25, 6, 123) - 0.5) - 0.8 * (~fl) + 0.5 * fls
        pki = np.where(bp < 0.17, 0.5, pki)                                          # szpara między deskami
        pki = np.where(cornerF < 3, 1.4 + 0.5 * fl, pki)                              # słupy narożne
        pki = np.where((zb % 32 < 2.5) & (zb > 8), 1.0 + 0.6 * fl, pki)               # listwy poziome
        plkcol = ramp(PLK, pki, True, xs, ys)
        lower = zb < lowh
        col = np.where((wallpx & (sty == 2) & ~plinth)[:, None], logcol, col)
        col = np.where((wallpx & ((sty == 3) | ((sty == 5) & lower)) & ~plinth)[:, None], plkcol, col)
        col = np.where((wallpx & (sty == 4) & lower)[:, None], wall, col)               # kamienny parter
        sill = wallpx & np.isin(sty, (4, 5)) & (np.abs(zb - lowh) < 2.5)               # belka nad parterem
        col = np.where(sill[:, None], ramp(WD, 1.0 + 0.8 * fl, True, xs, ys), col)
        # cień pod okapem na kamiennych ścianach
        col = np.where((wallpx & ~bplaster[bid] & ((eaveb - zb) < 6) & (zb < eaveb))[:, None], col * 0.72, col)
        # bluszcz: pnie się od ziemi przy narożnikach i w losowych miejscach (część domów)
        ivyb = hsh(bid.astype(np.float32), 96) > 0.35
        ivyn = vnoise(alongF, zb * 1.3, 8, 97) + 0.35 * np.exp(-cornerF / 10) - zb / np.maximum(eaveb, 1) * 0.55
        ivy = wallpx & ivyb & (ivyn > 0.62) & (hsh(alongF, zb, 98) > 0.28) & (zb < eaveb - 3)
        col = np.where(ivy[:, None], ramp(IVY, 1.6 + 2.0 * (ivyn - 0.62) * 4 * 0.4 + 0.8 * fl + 0.9 * (hsh(alongF, zb, 99) > 0.7), True, xs, ys), col)
        col = np.where(roofpx[:, None], rcol_, col)
        woodf = mat == WOOD
        col = np.where(woodf[:, None], ramp(WD, 2.2 + 1.0 * (z % 6 < 1) - 0.8 * fl, True, xs, ys), col)
        col = np.where(frame[:, None] | wfr[:, None], np.where((bstyle[bid] != 0)[:, None], ramp(WD, np.full(n_, 1.6), True, xs, ys), ramp(K.WL, np.full(n_, 5.6), True, xs, ys)), col)
        col = np.where(door[:, None], dcol, col)
        col = np.where(knob[:, None], K.WL[6][None], col)
        col = np.where(iron[:, None], np.array([40, 36, 44], np.float32), col)
        col = np.where(win[:, None], wcol, col)
        # wodospad na krawędzi świata
        fall = mat == WATER
        if fall.any():
            fi = 3.2 + 2.6 * hsh(np.floor(along / 2), np.floor(z / 5), 77) + 2.0 * (k < 3) - 0.6 * (~fl)
            col = np.where(fall[:, None], ramp(K.WA, fi, True, xs, ys), col)
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
    # źdźbła: gęściej, 2–3 px wysokości, jaśniejsze czubki, ciemna szczelina u podstawy
    sel = R.random(len(ys_)) < 0.19
    yA, xA = ys_[sel], xs_[sel]
    ok = (yA > 2) & gm[np.maximum(yA - 1, 0), xA] & gm[np.maximum(yA - 2, 0), xA]
    yA, xA = yA[ok], xA[ok]
    base = img[yA, xA].copy()
    tall = R.random(len(yA)) < 0.4
    img[yA - 1, xA] = np.clip(base * 1.22 + 10, 0, 255)
    img[yA[tall] - 2, xA[tall]] = np.clip(base[tall] * 1.38 + 18, 0, 255)
    img[yA, xA] = np.clip(base * 1.08 + 4, 0, 255)
    below = (yA + 1 < Hs) & gm[np.minimum(yA + 1, Hs - 1), xA]
    img[yA[below] + 1, xA[below]] = base[below] * 0.68
    # koniczyna (jaśniejsze plamki) i drobne kamyki w trawie
    cl = (R.random(len(ys_)) < 0.012) & (vnoise(xs_.astype(np.float32), ys_.astype(np.float32), 16, 81 + seed) > 0.6)
    for y, x in zip(ys_[cl], xs_[cl]):
        for dy_, dx_ in ((0, 0), (0, 1), (-1, 0), (0, -1)):
            if 0 <= y + dy_ < Hs and 0 <= x + dx_ < W and gm[y + dy_, x + dx_]:
                img[y + dy_, x + dx_] = np.clip(img[y + dy_, x + dx_] * 1.25 + 14, 0, 255)
    st_ = R.random(len(ys_)) < 0.0025
    for y, x in zip(ys_[st_], xs_[st_]):
        if 1 <= y < Hs - 1 and 1 <= x < W - 2:
            img[y, x:x + 2] = (150, 144, 136); img[y - 1, x] = (196, 190, 180); img[y + 1, x:x + 2] = (70, 72, 60)
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
