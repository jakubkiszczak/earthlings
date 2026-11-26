"""Wspólne narzędzia pixel artu: palety, dithering Bayera, hash i szum zależne od współrzędnych.
Szum liczony z globalnych współrzędnych świata, więc sąsiednie komórki mapy łączą się bez szwów."""
import numpy as np


def hexs(lst):
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in lst], np.float32)


def hsh(*xs):
    """Deterministyczny hash liczb całkowitych → [0, 1]."""
    out = np.full(np.broadcast(*xs).shape, 2166136261, np.uint64)
    for x in xs:
        out = ((out ^ (np.asarray(x).astype(np.int64) & 0xffffffff).astype(np.uint64)) * np.uint64(16777619)) & np.uint64(0xffffffff)
    out ^= out >> np.uint64(13)
    out = (out * np.uint64(0x5bd1e995)) & np.uint64(0xffffffff)
    out ^= out >> np.uint64(15)
    return (out & np.uint64(0xffff)).astype(np.float32) / 65535.0


BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16 - 0.47

G = hexs(['#12341f', '#1a4c25', '#24662a', '#33822c', '#4a9c2e', '#68b534', '#8ccb3e', '#b2df52', '#d6ef72'])
DR = hexs(['#3a2418', '#54341f', '#6e4628', '#8a5a32', '#a3713f'])
CB = hexs(['#4a3a34', '#6e5a4c', '#8e765f', '#ad9274', '#c8ad8a', '#dcc4a0'])
RK = hexs(['#191312', '#2c2220', '#43342d', '#5c4a3e', '#776050', '#937a62', '#ad9478', '#c6ae90'])
WL = hexs(['#2c2830', '#45404a', '#615a62', '#827a7c', '#a29a94', '#c0b6aa', '#d8cfc0'])
WA = hexs(['#14507e', '#16679a', '#1883b4', '#1ea2c8', '#2cc0d6', '#4ad6de', '#86eae8', '#c4f6f2', '#f0fffc'])
# trawa zwiędła (cmentarz) i ciemna (stary las)
GD = hexs(['#1c2a1c', '#28381f', '#344726', '#44562c', '#566632', '#6c7a3a', '#868f46', '#a0a656', '#bab86a'])
GN = hexs(['#0c2216', '#11301c', '#183f22', '#215228', '#2c6630', '#3a7a36', '#4c8e3e', '#64a248', '#80b856'])


def ramp(pal, f, dither=True, xs=None, ys=None):
    f = np.asarray(f, np.float32)
    if dither:
        f = f + BAYER[ys % 4, xs % 4]
    idx = np.clip(np.floor(f + 0.5), 0, len(pal) - 1).astype(int)
    return pal[idx]


def vnoise(u, v, scale, seed):
    """Szum wartości w punktach (u, v) – kratka co `scale`, wygładzanie smoothstep. Wynik [0, 1]."""
    fu, fv = u / scale, v / scale
    iu, iv = np.floor(fu).astype(np.int64), np.floor(fv).astype(np.int64)
    tu, tv = fu - iu, fv - iv
    tu = tu * tu * (3 - 2 * tu)
    tv = tv * tv * (3 - 2 * tv)
    a = hsh(iu, iv, seed); b = hsh(iu + 1, iv, seed); c = hsh(iu, iv + 1, seed); d = hsh(iu + 1, iv + 1, seed)
    return (a + (b - a) * tu + (c - a) * tv + (a - b - c + d) * tu * tv).astype(np.float32)


def fbm(u, v, seed, scales=(128, 64, 32, 16, 8), w=(1, .55, .3, .16, .08)):
    """Suma oktaw, znormalizowana teoretycznie (nie wg min/max), więc identyczna w każdej komórce."""
    t = sum(wi * vnoise(u, v, sc, seed * 31 + k) for k, (sc, wi) in enumerate(zip(scales, w)))
    return (t / sum(w)).astype(np.float32)


def stretch(x, lo=0.25, hi=0.75):
    """Rozciągnięcie typowego zakresu fbm (~0.25–0.75) do [0, 1]."""
    return np.clip((x - lo) / (hi - lo), 0, 1)


def vor(u, v, cell, seed):
    """Komórki Voronoia (bruk, kępy trawy, ciosy muru) w globalnych współrzędnych."""
    gu, gv = np.floor(u / cell).astype(np.int64), np.floor(v / cell).astype(np.int64)
    F1 = np.full(u.shape, 1e9, np.float32); F2 = F1.copy(); CID = np.zeros(u.shape, np.float32)
    DX = np.zeros(u.shape, np.float32); DY = DX.copy()
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
