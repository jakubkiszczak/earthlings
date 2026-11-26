"""Dodatkowe sprite'y świata: latarnia (większa), szyld sklepu, rabaty z kwiatami, wyposażenie sklepu
(manekiny w zbrojach, stojaki z bronią, regał z akcesoriami, pochodnie), fontanna (strumienie wody rysuje gra)."""
import numpy as np
from scipy import ndimage as ndi
import pixelkit as K

INK = (20, 14, 18)


class Px:
    """Proste płótno RGBA z kolorami hex i konturem."""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)

    def put(self, x0, y0, x1, y1, c):
        """prostokąt [x0, x1) × [y0, y1)"""
        x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(self.w, int(x1)), min(self.h, int(y1))
        if x1 <= x0 or y1 <= y0:
            return
        self.a[y0:y1, x0:x1, :3] = K.hexs([c])[0]
        self.a[y0:y1, x0:x1, 3] = 255

    def px(self, x, y, c):
        self.put(x, y, x + 1, y + 1, c)

    def line(self, x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for t in np.linspace(0, 1, n + 1):
            self.px(round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), c)

    def done(self, outline=True):
        if outline:
            al = self.a[..., 3] > 0
            out = ndi.binary_dilation(al) & ~al
            self.a[out] = INK + (255,)
        return self.a


def lamp_big():
    """latarnia o 50% większa (17×60): kuty słup z pierścieniami, ozdobny wspornik, klatka z szybkami, grzybek z kulką"""
    p = Px(19, 62)
    # podstawa: dwa stopnie kamienia
    p.put(3, 55, 16, 61, '#6c6a72'); p.put(3, 55, 6, 61, '#8a8890'); p.put(13, 55, 16, 61, '#4a4850'); p.put(3, 55, 16, 56, '#9a98a0')
    p.put(5, 51, 14, 55, '#5c5a62'); p.put(5, 51, 7, 55, '#7a7880')
    # słup z kanelurami
    p.put(7, 17, 12, 51, '#3a3640'); p.put(7, 17, 8, 51, '#6a6672'); p.put(11, 17, 12, 51, '#24222a')
    for y in range(20, 50, 4):
        p.px(9, y, '#4e4a56')
    for y in (24, 36, 48):
        p.put(6, y, 13, y + 2, '#4a4652'); p.put(6, y, 13, y + 1, '#6a6672')
    # ozdobne wąsy wspornika
    p.line(5, 18, 2, 14, '#3a3640'); p.line(13, 18, 16, 14, '#3a3640'); p.px(2, 13, '#6a6672'); p.px(16, 13, '#6a6672')
    # klatka latarni z szybkami
    p.put(4, 5, 15, 17, '#24222a')
    p.put(5, 6, 14, 16, '#ffd060'); p.put(5, 6, 8, 16, '#fff0a8'); p.put(12, 6, 14, 16, '#e8a030')
    p.put(9, 6, 10, 16, '#3a3640'); p.put(5, 11, 14, 12, '#3a3640')
    p.px(6, 7, '#ffffff'); p.px(6, 8, '#fffbe0')
    p.put(3, 16, 16, 18, '#3a3640'); p.put(3, 16, 16, 17, '#5a5662')
    # daszek-grzybek z kulką
    p.put(3, 3, 16, 5, '#3a3640'); p.put(5, 1, 14, 3, '#4a4652'); p.put(8, 0, 11, 1, '#6a6672'); p.px(9, 0, '#9a98a0')
    return p.done(), (9, 60)


def shop_sign():
    """szyld: wspornik z wiszącą deską, na niej tarcza i skrzyżowany miecz"""
    p = Px(26, 30)
    p.put(0, 2, 22, 4, '#3a2a1e'); p.put(0, 2, 22, 3, '#5a4030')        # wspornik
    p.line(2, 4, 8, 10, '#3a2a1e')
    p.px(6, 4, '#8a8890'); p.px(18, 4, '#8a8890')
    p.line(6, 4, 6, 8, '#8a8890'); p.line(18, 4, 18, 8, '#8a8890')        # łańcuszki
    p.put(3, 8, 23, 28, '#8a5626'); p.put(3, 8, 23, 10, '#ad7034'); p.put(3, 26, 23, 28, '#673e1c')
    p.put(3, 8, 5, 28, '#ad7034'); p.put(21, 8, 23, 28, '#5a3418')
    # miecz po skosie
    p.line(6, 25, 20, 11, '#e8ecf0'); p.line(7, 25, 21, 11, '#a8b0bc')
    p.line(8, 18, 12, 22, '#e0b850'); p.px(6, 26, '#9a7430')
    # tarcza
    p.put(10, 12, 17, 21, '#c8ccd6'); p.put(11, 13, 16, 20, '#3a6ac8'); p.put(14, 13, 16, 20, '#2a4a96')
    p.put(12, 21, 15, 23, '#c8ccd6'); p.px(13, 23, '#c8ccd6'); p.px(13, 16, '#e8c050'); p.px(12, 16, '#e8c050')
    return p.done(), (1, 29)


def flowerbed(seed):
    """mała rabata: zielona kępa z kwiatami"""
    r = np.random.default_rng(seed)
    p = Px(18, 11)
    yy, xx = np.mgrid[0:11, 0:18]
    e = ((xx - 9) / 8.5) ** 2 + ((yy - 6.5) / 4.2) ** 2
    G = ['#2c6630', '#3a7a36', '#4c8e3e', '#64a248']
    for y in range(11):
        for x in range(18):
            if e[y, x] <= 1:
                k = int(np.clip(1.5 - (y - 6.5) / 4 + r.random() * 1.2 - (x - 9) / 18, 0, 3))
                p.px(x, y, G[k])
    cols = [['#ff6a8a', '#ffd84a'], ['#f6f2e8', '#ffb02e'], ['#9ab0ff', '#ff9a3a'], ['#ff4a4a', '#fff0a0']][seed % 4]
    for _ in range(22):
        x, y = int(r.integers(2, 16)), int(r.integers(1, 8))
        if e[y, x] <= 0.85:
            c0 = cols[int(r.integers(0, 2))]
            p.px(x, y, c0); p.px(x + 1, y, c0); p.px(x, y - 1, c0); p.px(x + 1, y - 1, '#fff6c0' if r.random() < 0.3 else c0)
    return p.done(), (9, 9)


ARMOR = {1: ('#8a5a30', '#6a4222', '#3e2410'), 2: ('#9aa0aa', '#6e747e', '#40444c'), 3: ('#c8ccd6', '#8e94a0', '#e8c050')}


def mannequin(tier):
    """manekin na stojaku ubrany w zbroję danego poziomu"""
    a, b, c = ARMOR[tier]
    p = Px(20, 44)
    p.put(9, 30, 11, 41, '#6a4420'); p.put(5, 40, 15, 43, '#4e2e14'); p.put(5, 40, 15, 41, '#6a4420')  # słupek i podstawa
    p.put(5, 12, 15, 30, a); p.put(11, 12, 15, 30, b); p.put(5, 28, 15, 30, b)                       # tułów
    p.put(2, 12, 6, 16, b); p.put(14, 12, 18, 16, b); p.put(2, 12, 6, 13, a); p.put(14, 12, 18, 13, a)  # naramienniki
    p.put(7, 20, 13, 21, c); p.put(9, 14, 11, 26, b if tier != 3 else c)                              # pas / środek
    p.put(7, 3, 13, 11, '#c8a070'); p.put(10, 3, 13, 11, '#a07848')                                    # głowa (drewno)
    if tier >= 2:
        p.put(6, 2, 14, 7, b); p.put(6, 2, 14, 3, a); p.put(9, 6, 11, 9, b)                             # hełm z nosalem
    if tier == 3:
        p.put(9, 0, 11, 2, c)
    return p.done(), (10, 42)


def weapon_rack():
    """stojak z bronią: dwa miecze, topór, włócznia"""
    p = Px(30, 40)
    p.put(1, 4, 4, 39, '#6a4420'); p.put(26, 4, 29, 39, '#5a3418')
    p.put(1, 8, 29, 11, '#8a5626'); p.put(1, 26, 29, 29, '#8a5626'); p.put(1, 36, 29, 39, '#4e2e14')
    for x, blade in ((7, '#e8ecf0'), (12, '#c8ccd6')):
        p.put(x, 1, x + 2, 24, blade); p.put(x + 1, 1, x + 2, 24, '#a8b0bc'); p.put(x - 2, 24, x + 4, 26, '#e0b850'); p.put(x, 26, x + 2, 31, '#5a3418')
    p.put(18, 2, 19, 34, '#8a5626'); p.put(16, 3, 22, 9, '#c8ccd6'); p.put(16, 3, 18, 9, '#e8ecf0')     # topór
    p.put(23, 0, 24, 34, '#a06a34'); p.put(22, 0, 25, 4, '#c8ccd6'); p.px(23, 0, '#e8ecf0')            # włócznia
    return p.done(), (15, 38)


def accessory_shelf():
    """regał z akcesoriami: mikstury, pierścienie, zwoje, sakiewki"""
    p = Px(32, 42)
    p.put(1, 0, 31, 41, '#6a4420'); p.put(3, 2, 29, 39, '#3a2414')
    for y in (12, 24, 36):
        p.put(1, y, 31, y + 3, '#8a5626'); p.put(1, y, 31, y + 1, '#ad7034')
    r = np.random.default_rng(3)
    cols = ['#ff5a6a', '#5a9aff', '#8ae07a', '#ffd84a', '#c88aff']
    for row, ybase in enumerate((12, 24, 36)):
        x = 4
        while x < 27:
            k = int(r.integers(0, 4))
            if k <= 1:                       # butelka
                cc = cols[int(r.integers(0, 5))]
                p.put(x, ybase - 6, x + 3, ybase, cc); p.put(x + 1, ybase - 8, x + 2, ybase - 6, '#d8d0c0'); p.px(x, ybase - 5, '#ffffff')
                x += 5
            elif k == 2:                     # zwój
                p.put(x, ybase - 3, x + 6, ybase, '#e8dcb0'); p.put(x, ybase - 3, x + 1, ybase, '#c8b880'); p.px(x + 3, ybase - 2, '#a03222')
                x += 8
            else:                            # sakiewka / pierścień
                p.put(x, ybase - 4, x + 4, ybase, '#8a5a30'); p.put(x + 1, ybase - 5, x + 3, ybase - 4, '#6a4222'); p.px(x + 4, ybase - 2, '#e8c050')
                x += 6
    return p.done(), (16, 41)


def torch(frame):
    """pochodnia na ścianie (uchwyt + płomień, 2 klatki)"""
    p = Px(12, 26)
    p.put(5, 12, 7, 24, '#5a3418'); p.put(5, 12, 6, 24, '#7a4a24')
    p.put(3, 20, 9, 22, '#3a3640'); p.put(3, 20, 9, 21, '#5a5662')
    p.put(4, 10, 8, 13, '#3a2a1e')
    flame = [['#ff5a1a', '#ffb030', '#fff0a0'], ['#ff6a1a', '#ffc040', '#fffbd0']][frame]
    shape = [(3, 9, 9, 11), (4, 6, 8, 9), (5, 3, 7, 6), (6, 1, 7, 3)] if frame == 0 else [(3, 8, 9, 11), (3, 5, 8, 8), (5, 2, 7, 5), (5, 0, 6, 2)]
    for i, (x0, y0, x1, y1) in enumerate(shape):
        p.put(x0, y0, x1, y1, flame[0] if i == 0 else flame[1])
    p.put(5, 6, 7, 10, flame[2])
    return p.done(), (6, 25)


def iso_face(sprite, anchor, along='v', depth=6):
    """Pochyla płaski sprite (widok z przodu) tak, by leżał wzdłuż osi świata (rzut izometryczny 2:1)
    i dokleja bok o grubości `depth` – mebel stoi pod kątem 45°, a nie przodem do gracza.
    along='u' – front wzdłuż osi u (ściana tylna v): prawa strona niżej; along='v' – wzdłuż v: lewa niżej."""
    h, w = sprite.shape[:2]
    sl = 0.5 if along == 'u' else -0.5
    lift = int(np.ceil(abs(sl) * w))
    H2 = h + lift + depth
    W2 = w + depth * 2
    out = np.zeros((H2, W2, 4), np.uint8)
    ox = depth if along == 'u' else depth
    for x in range(w):
        dy = int(round(x * sl)) + (lift if sl < 0 else 0)
        col = sprite[:, x]
        m = col[:, 3] > 0
        ys = np.nonzero(m)[0]
        out[ys + dy, x + ox] = col[ys]
    # bok (grubość mebla): ciemniejsza kopia krawędzi, przesunięta w drugą oś
    edge_x = w - 1 if along == 'u' else 0
    col = sprite[:, edge_x].copy()
    col[..., :3] = (col[..., :3] * 0.55).astype(np.uint8)
    for k in range(1, depth + 1):
        sx = ox + edge_x + (k if along == 'u' else -k)
        dy = int(round(edge_x * sl)) + (lift if sl < 0 else 0) + int(round(k * 0.5))
        m = col[:, 3] > 0
        ys = np.nonzero(m)[0]
        if 0 <= sx < W2:
            out[ys + dy, sx] = col[ys]
    al = out[..., 3] > 0
    ring = ndi.binary_dilation(al) & ~al
    out[ring] = INK + (255,)
    ax, ay = anchor
    ndy = int(round(ax * sl)) + (lift if sl < 0 else 0)
    return out, (ax + ox, ay + ndy)


def stall(kind):
    """stragan: słupki, pasiasta markiza, lada z towarem (owoce, tkaniny, garnki) – płasko, potem iso_face"""
    p = Px(40, 40)
    stripes = [('#c83a3a', '#f4f0e8'), ('#3a6ac8', '#f4f0e8'), ('#3a8a4a', '#f2d27a')][kind]
    p.put(2, 8, 4, 39, '#6a4420'); p.put(36, 8, 38, 39, '#5a3418')                  # słupki
    for x in range(0, 40):                                                           # markiza w pasy z falbanką
        c = stripes[(x // 5) % 2]
        p.put(x, 2, x + 1, 9, c)
        if (x // 5) % 2 == 0:
            p.put(x, 9, x + 1, 11, c)
    p.put(0, 1, 40, 2, '#6a4420')
    p.put(3, 24, 37, 39, '#8a5626'); p.put(3, 24, 37, 26, '#ad7034'); p.put(3, 37, 37, 39, '#5a3418')   # lada
    for x in range(6, 36, 6):
        p.put(x, 27, x + 1, 37, '#673e1c')
    r = np.random.default_rng(11 + kind)
    if kind == 0:      # owoce i warzywa
        for _ in range(26):
            x, y = int(r.integers(5, 35)), int(r.integers(19, 24))
            c = ['#e03a2a', '#f0b030', '#7ac040', '#a04ac0', '#ff8a2a'][int(r.integers(0, 5))]
            p.put(x, y, x + 2, y + 2, c)
    elif kind == 1:    # tkaniny w belach
        for i, x in enumerate(range(5, 34, 6)):
            c = ['#c83a6a', '#3a8ac8', '#e8c040', '#6a3ac8', '#3aa05a'][i % 5]
            p.put(x, 16, x + 5, 24, c); p.put(x, 16, x + 1, 24, '#ffffff'); p.put(x, 23, x + 5, 24, '#1a1418')
    else:              # garnki i dzbany
        for x in range(5, 34, 7):
            p.put(x, 16, x + 5, 24, '#b06a3a'); p.put(x + 1, 14, x + 4, 16, '#b06a3a'); p.put(x, 16, x + 1, 24, '#d88a50'); p.put(x, 19, x + 5, 20, '#6a3a1a')
    return p.done(), (20, 39)


def planter(seed):
    """duża donica z kwiatami w rzucie izometrycznym: romb z ziemią i kwiatami, dwie kamienne ściany"""
    W, Hh = 50, 42
    p = Px(W, Hh)
    cx, top, hw, hh, wall = 25, 8, 23, 11, 12
    r = np.random.default_rng(seed)
    for y in range(Hh):
        for x in range(W):
            dx, dy = abs(x - cx) / hw, abs(y - (top + hh)) / hh
            if dx + dy <= 1:
                p.px(x, y, '#5a3a22' if r.random() < 0.7 else '#4a2e1a')     # ziemia
            # ściany: lewa (jaśniejsza) i prawa
            yb = top + hh + (hh - abs(x - cx) / hw * hh)
            if x - cx <= 0 and dx <= 1 and yb <= y < yb + wall and y > top + hh:
                p.px(x, y, '#a89888' if (x + y) % 6 else '#8a7a6a')
            if x - cx > 0 and dx <= 1 and yb <= y < yb + wall and y > top + hh:
                p.px(x, y, '#7a6a5c' if (x + y) % 6 else '#665848')
    # obrzeże z cegły na górze
    for x in range(W):
        dx = abs(x - cx) / hw
        if dx <= 1:
            y1 = round(top + hh - (1 - dx) * hh); y2 = round(top + hh + (1 - dx) * hh)
            p.px(x, y1, '#c8b8a4'); p.px(x, y2, '#c8b8a4')
    # kwiaty i liście
    cols = [['#ff5a7a', '#ffd84a'], ['#f6f2e8', '#ff9a3a'], ['#9ab0ff', '#e85aa8'], ['#ff4a4a', '#fff0a0']][seed % 4]
    for _ in range(120):
        x, y = int(r.integers(4, W - 4)), int(r.integers(top - 4, top + 2 * hh - 2))
        if abs(x - cx) / hw + abs(y - (top + hh)) / hh <= 0.85:
            p.px(x, y, ['#2c6630', '#3a7a36', '#4c8e3e'][int(r.integers(0, 3))]); p.px(x, y - 1, '#3a7a36')
    for _ in range(80):
        x, y = int(r.integers(4, W - 4)), int(r.integers(top - 5, top + 2 * hh - 3))
        if abs(x - cx) / hw + abs(y + 2 - (top + hh)) / hh <= 0.8:
            c = cols[int(r.integers(0, 2))]
            p.px(x, y - 2, c); p.px(x + 1, y - 2, c); p.px(x, y - 3, c)
    return p.done(), (cx, top + 2 * hh + wall - 1)


# ------------------------------------------------------------------ bryły w rzucie izometrycznym (stragany)
class Iso:
    """Płótno do rysowania brył w izometrii 2:1: x = u - v, y = (u + v) / 2 - z (jednostki świata = piksele).
    Ściany +v (lewa-dolna) jaśniejsze, +u (prawa-dolna) ciemniejsze – światło z lewej-góry."""
    def __init__(self, w, h, ox, oy):
        self.p = Px(w, h)
        self.ox, self.oy = ox, oy

    def P(self, u, v, z):
        return int(round(u - v + self.ox)), int(round((u + v) / 2 - z + self.oy))

    def dot(self, u, v, z, c):
        x, y = self.P(u, v, z)
        self.p.px(x, y, c)

    def box(self, u0, u1, v0, v1, z0, z1, top, left, right, pat=None):
        """prostopadłościan; pat(face, a, b) -> kolor lub None (np. deski, pasy)"""
        st = 0.5
        for u in np.arange(u0, u1 + 1e-6, st):                    # ściana +v
            for z in np.arange(z0, z1 + 1e-6, st):
                c = (pat and pat('v', u - u0, z - z0)) or left
                self.dot(u, v1, z, c)
        for v in np.arange(v0, v1 + 1e-6, st):                    # ściana +u
            for z in np.arange(z0, z1 + 1e-6, st):
                c = (pat and pat('u', v - v0, z - z0)) or right
                self.dot(u1, v, z, c)
        for u in np.arange(u0, u1 + 1e-6, st):                    # wierzch
            for v in np.arange(v0, v1 + 1e-6, st):
                c = (pat and pat('t', u - u0, v - v0)) or top
                self.dot(u, v, z1, c)


STALL_STRIPES = [('#c83a3a', '#f4f0e8'), ('#3a6ac8', '#f4f0e8'), ('#3a8a4a', '#f2d27a')]


def stall_iso(kind):
    """stragan w prawdziwej izometrii (front wzdłuż u, klienci od strony +v): cztery słupki, tylna półka z towarem,
    lada-skrzynia z deskami, towar na blacie (kosze z owocami / bele tkanin / garnki), skośna markiza w pasy z falbaną.
    Wersję z frontem wzdłuż v daje lustrzane odbicie."""
    L, D, CT = 44, 24, 14                    # długość, głębokość, wysokość lady
    W, H = L + D + 20, 108
    g = Iso(W, H, D + 10, 70)
    wood = ('#ad7034', '#8a5626', '#5a3418')
    sa, sb = STALL_STRIPES[kind]
    r = np.random.default_rng(31 + kind)
    # słupki tylne
    for u in (1, L - 3):
        g.box(u, u + 2, 0, 2, 0, 58, '#8a5626', '#6a4420', '#4a2c14')
    # tylna półka z towarem (deska na wysokości 26) i zawieszone towary
    g.box(0, L, 0, 5, 24, 26, wood[0], wood[1], wood[2])
    for i in range(7):
        u = 3 + i * 6
        if kind == 0:
            g.box(u, u + 4, 1, 4, 26, 30, '#c89048', '#a06a30', '#7a4a20')
            for _ in range(5):
                g.dot(u + r.uniform(0.5, 3.5), r.uniform(1, 3.5), 31, ['#e03a2a', '#f0b030', '#7ac040'][int(r.integers(0, 3))])
        elif kind == 1:
            c = ['#c83a6a', '#3a8ac8', '#e8c040', '#6a3ac8', '#3aa05a'][i % 5]
            g.box(u, u + 4, 2, 4, 30, 46, c, c, '#2a1e28')                       # tkanina zwisająca z drążka
        else:
            g.box(u + 1, u + 4, 1, 4, 26, 31, '#b06a3a', '#d88a50', '#8a4a24')
            g.dot(u + 2.5, 2.5, 32, '#5a2e14')
    # lada: skrzynia z pionowymi deskami i jaśniejszym blatem z krawędzią
    def planks(face, a, b):
        if face == 'v':
            if b > CT - 1.5:
                return '#cc8c46'
            return '#673e1c' if int(a) % 6 == 0 else ('#9a6230' if int(a) % 6 < 3 else '#8a5626')
        if face == 'u':
            if b > CT - 1.5:
                return '#8a5626'
            return '#4a2c14' if int(a) % 6 == 0 else '#5a3418'
        return '#b87a3c' if int(a) % 8 else '#9a6230'
    g.box(0, L, 10, D, 0, CT, '#b87a3c', '#8a5626', '#5a3418', planks)
    # towar na blacie
    if kind == 0:
        for i, u in enumerate((3, 15, 27, 37)):
            g.box(u, u + 8, 12, 20, CT, CT + 4, '#c89048', '#b07a38', '#7a4a20',
                  lambda f, a, b: '#8a5a28' if (int(a) + int(b)) % 3 == 0 else None)
            col = ['#e03a2a', '#f0b030', '#7ac040', '#ff8a2a'][i]
            for _ in range(22):
                g.dot(u + r.uniform(1, 7), r.uniform(13, 19), CT + 5, col if r.random() < 0.8 else '#fff0c0')
    elif kind == 1:
        for i, u in enumerate(range(2, L - 6, 7)):
            c = ['#c83a6a', '#3a8ac8', '#e8c040', '#6a3ac8', '#3aa05a', '#e86a3a'][i % 6]
            g.box(u, u + 6, 12, 21, CT, CT + 3, c, c, '#3a2a30',
                  lambda f, a, b, c=c: '#ffffff' if (f == 't' and int(a) == 1) else None)
    else:
        for i, u in enumerate(range(3, L - 5, 8)):
            hh = 5 + (i % 2) * 3
            g.box(u, u + 5, 14, 19, CT, CT + hh, '#c07a44', '#d88a50', '#8a4a24')
            g.box(u + 1, u + 4, 15, 18, CT + hh, CT + hh + 2, '#b06a3a', '#c07a44', '#7a3a1a')
            g.dot(u + 2.5, 16.5, CT + hh + 2.5, '#3a1a0a')
    # słupki przednie
    for u in (1, L - 3):
        g.box(u, u + 2, D + 1, D + 3, 0, 46, '#8a5626', '#7a4a20', '#4a2c14')
    # markiza: skośna płaszczyzna od tyłu (z=52) do przodu (z=40), pasy wzdłuż u, falbana na przedniej krawędzi
    for u in np.arange(-3, L + 3 + 1e-6, 0.5):
        stripe = sa if int((u + 3) // 5) % 2 == 0 else sb
        for t in np.arange(0, 1 + 1e-6, 0.02):
            v = -3 + t * (D + 10)
            z = 60 - t * 14
            c = stripe
            if t < 0.15:
                c = '#6a4420' if t < 0.04 else stripe                      # tylna listwa
            g.dot(u, v, z, c)
        # falbana: zwisające języki co drugi pas
        fv = D + 7
        drop = 5 if int((u + 3) // 5) % 2 == 0 else 3
        for dz in np.arange(0, drop + 1e-6, 0.5):
            g.dot(u, fv, 46 - dz, stripe if dz < drop - 0.5 else '#1e1418')
    # cień pod markizą na ladzie (ciemniejsze pasy blatu) – drobny akcent głębi
    a = g.p.done()
    ax, ay = g.P(L / 2, D / 2 + 4, 0)
    return a, (ax, ay)


def banner(kind):
    """sztandar na kutym słupie: poprzeczka, długi płat z herbem (tarcza z mieczem), wycięty jaskółczy ogon"""
    cols = [('#b8282c', '#e04a44', '#7a141a', '#f2d27a'), ('#2a4aa8', '#4a72d8', '#16286a', '#f2d27a'),
            ('#2e7a3a', '#4a9e52', '#18481e', '#f4f0e8')][kind]
    p = Px(24, 84)
    # podstawa i słup
    p.put(7, 78, 17, 84, '#6c6a72'); p.put(7, 78, 9, 84, '#8a8890'); p.put(15, 78, 17, 84, '#4a4850')
    p.put(11, 6, 13, 78, '#3a3640'); p.put(11, 6, 12, 78, '#6a6672')
    p.put(9, 2, 15, 6, '#c8a040'); p.put(10, 0, 14, 2, '#f2d27a')                 # złota gałka
    p.put(2, 8, 22, 10, '#3a3640'); p.put(2, 8, 22, 9, '#6a6672')                  # poprzeczka
    # płat
    c1, c2, c3, gold = cols
    for y in range(10, 52):
        for x in range(4, 20):
            if y > 44 and abs(x - 11.5) < (y - 44) * 0.9:                          # jaskółczy ogon
                continue
            c = c1
            if x < 6:
                c = c2
            elif x > 17:
                c = c3
            if y in (12, 13) or x in (5, 18) and y < 45:
                c = gold
            p.px(x, y, c)
    # herb: tarcza z mieczem
    for y in range(18, 34):
        w = 5 if y < 28 else 5 - (y - 28)
        for x in range(12 - w, 12 + w):
            p.px(x, y, gold if (x in (12 - w, 11 + w) or y == 18) else c3)
    p.put(11, 16, 13, 33, '#e8ecf0'); p.put(9, 21, 15, 22, '#c8a040'); p.px(11, 16, '#ffffff')
    return p.done(), (12, 83)


def flag(kind, frame):
    """flaga na maszcie (na dach wieży / basztę), 3 klatki falowania"""
    cols = [('#b8282c', '#e04a44', '#7a141a'), ('#2a4aa8', '#4a72d8', '#16286a'), ('#e8c040', '#fff0a0', '#a07a20')][kind]
    p = Px(30, 40)
    p.put(2, 2, 4, 40, '#3a3640'); p.put(2, 2, 3, 40, '#6a6672'); p.put(1, 0, 5, 2, '#f2d27a')
    for x in range(4, 28):
        ph = frame * 2.1
        off = np.sin(x * 0.45 - ph) * 1.6 * (x - 4) / 24
        top = int(round(4 + off)); bot = int(round(17 + off + (x - 4) * 0.06))
        sh = np.cos(x * 0.45 - ph)
        c = cols[1] if sh > 0.5 else cols[2] if sh < -0.5 else cols[0]
        p.put(x, top, x + 1, bot, c)
        if x > 24 and frame % 2:
            p.px(x, bot, c)
    return p.done(), (3, 39)
