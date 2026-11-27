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


# ------------------------------------------------------------------ karczma „Pod Złotym Kuflem”
def tavern_sign():
    """szyld karczmy: wspornik z łańcuszkami, deska z pienistym kuflem piwa"""
    p = Px(28, 32)
    p.put(0, 2, 24, 4, '#3a2a1e'); p.put(0, 2, 24, 3, '#5a4030'); p.line(2, 4, 9, 11, '#3a2a1e')
    p.line(6, 4, 6, 8, '#8a8890'); p.line(20, 4, 20, 8, '#8a8890')
    p.put(3, 8, 25, 30, '#8a5626'); p.put(3, 8, 25, 10, '#ad7034'); p.put(3, 28, 25, 30, '#673e1c')
    p.put(3, 8, 5, 30, '#ad7034'); p.put(23, 8, 25, 30, '#5a3418')
    # kufel: złote piwo, piana, ucho
    p.put(9, 15, 18, 27, '#e8a830'); p.put(9, 15, 11, 27, '#ffd060'); p.put(16, 15, 18, 27, '#b87a18')
    p.put(9, 18, 18, 19, '#c89020'); p.put(9, 23, 18, 24, '#c89020')
    p.put(8, 11, 19, 15, '#fbf6ea'); p.put(10, 10, 17, 11, '#fbf6ea'); p.px(9, 15, '#fbf6ea'); p.px(15, 16, '#fbf6ea')
    p.put(18, 17, 21, 18, '#b87a18'); p.put(20, 17, 21, 24, '#b87a18'); p.put(18, 23, 21, 24, '#b87a18')
    p.px(12, 20, '#fff0b0'); p.px(13, 22, '#fff0b0')
    return p.done(), (1, 31)


def mount_head(kind):
    """wypchana głowa na tarczy z drewna: 0 jeleń (poroże), 1 niedźwiedź, 2 wilk"""
    p = Px(34, 34)
    for y in range(14, 32):                                         # owalna deska
        for x in range(8, 26):
            if ((x - 16.5) / 9) ** 2 + ((y - 23) / 9) ** 2 <= 1:
                p.px(x, y, '#8a5626' if x > 10 else '#ad7034')
    if kind == 0:
        fur, dark = '#a0683a', '#6a4220'
        p.put(13, 12, 21, 26, fur); p.put(14, 24, 20, 30, fur); p.put(15, 28, 19, 31, '#3a2416')
        p.put(12, 12, 14, 15, dark); p.put(20, 12, 22, 15, dark)                         # uszy
        for side in (-1, 1):                                                              # poroże
            bx = 15 if side < 0 else 19
            p.line(bx, 12, bx + side * 6, 3, '#e8dcc0'); p.line(bx + side * 3, 8, bx + side * 1, 2, '#e8dcc0')
            p.line(bx + side * 5, 5, bx + side * 9, 4, '#e8dcc0'); p.line(bx + side * 6, 3, bx + side * 6, 0, '#d0c0a0')
        p.put(14, 18, 15, 19, '#1a1010'); p.put(19, 18, 20, 19, '#1a1010'); p.px(14, 18, '#ffffff')
        p.put(13, 20, 21, 21, '#c08a58')
    elif kind == 1:
        fur, dark = '#5a3a24', '#3a2416'
        p.put(10, 12, 24, 27, fur); p.put(10, 12, 13, 27, '#6e4a2e')
        p.put(9, 9, 13, 13, fur); p.put(21, 9, 25, 13, fur); p.put(10, 10, 12, 12, dark); p.put(22, 10, 24, 12, dark)
        p.put(13, 21, 21, 29, '#8a6a4a'); p.put(15, 21, 19, 23, '#1a1010')                # pysk, nos
        p.put(14, 27, 20, 29, '#7a2020'); p.px(14, 27, '#f4f0e8'); p.px(19, 27, '#f4f0e8')
        p.put(13, 16, 14, 18, '#1a1010'); p.put(20, 16, 21, 18, '#1a1010'); p.px(13, 16, '#ffffff')
    else:
        fur, dark = '#8a8a94', '#56565e'
        p.put(11, 13, 23, 25, fur); p.put(11, 13, 13, 25, '#a8a8b0')
        p.line(11, 13, 12, 6, fur); p.line(12, 13, 14, 7, dark); p.line(23, 13, 22, 6, fur); p.line(22, 13, 20, 7, dark)
        p.put(14, 22, 20, 31, fur); p.put(14, 28, 20, 31, '#d8d4cc'); p.put(16, 30, 18, 32, '#1a1414')
        p.put(14, 29, 20, 30, '#a02a2a'); p.px(14, 29, '#f4f0e8'); p.px(19, 29, '#f4f0e8')
        p.put(13, 17, 15, 18, '#ffd040'); p.put(19, 17, 21, 18, '#ffd040')
    return p.done(), (17, 33)


def shield_swords(k):
    """tarcza herbowa na dwóch skrzyżowanych mieczach"""
    p = Px(36, 36)
    for (x0, y0, x1, y1) in ((3, 33, 32, 3), (32, 33, 3, 3)):
        p.line(x0, y0, x1, y1, '#d8dde4'); p.line(x0 + (1 if x1 > x0 else -1), y0, x1 + (1 if x1 > x0 else -1), y1, '#9aa2ae')
    p.put(1, 30, 7, 32, '#c8a040'); p.put(28, 30, 34, 32, '#c8a040')
    c1, c2 = [('#b8282c', '#f2d27a'), ('#2a4aa8', '#e8ecf0'), ('#2e7a3a', '#f2d27a')][k]
    for y in range(8, 30):
        w = 10 if y < 21 else 10 - (y - 21) * 1.2
        for x in range(int(18 - w), int(18 + w)):
            edge = x <= 18 - w + 1 or x >= 18 + w - 2 or y == 8
            p.px(x, y, '#c8ccd6' if edge else (c1 if (x < 18) == (y < 18) else c2))
    return p.done(), (18, 35)


def dragon_painting(k):
    """obraz w złotej ramie: smok nad górami (czerwony / zielony / czarny)"""
    p = Px(40, 30)
    p.put(0, 0, 40, 30, '#c8a040'); p.put(1, 1, 39, 29, '#8a6a20'); p.put(2, 2, 38, 28, '#e0b850')
    sky = [('#e8a060', '#f4d090'), ('#7aa8d8', '#c0dcf0'), ('#5a4a7a', '#9a7ab0')][k]
    for y in range(3, 27):
        p.put(3, y, 37, y + 1, sky[1] if y < 12 else sky[0])
    for x in range(3, 37):                                                     # góry
        h = int(19 + 4 * np.sin(x * 0.5) + 2 * np.sin(x * 1.3))
        p.put(x, h, x + 1, 27, '#4a4a5a'); p.px(x, h, '#e8ecf0')
    dc = ['#c02a2a', '#2e8a3a', '#2a2a34'][k]
    p.put(14, 10, 24, 14, dc); p.put(22, 8, 27, 11, dc); p.px(27, 9, '#ffd040')         # tułów i głowa
    p.line(10, 12, 14, 12, dc); p.line(6, 14, 10, 12, dc)                                # ogon
    for i in range(7):                                                                    # skrzydła
        p.line(16 + i, 10, 12 + i * 2, 4, dc)
    p.line(27, 10, 33, 12, '#ff9a2a'); p.line(28, 11, 34, 14, '#ffd040')                # ogień
    return p.done(), (20, 29)


def bar_shelf():
    """regał za barem: trzy półki z butelkami, dzbanami i kuflami"""
    p = Px(64, 44)
    p.put(0, 0, 64, 44, '#5a3418'); p.put(2, 2, 62, 42, '#3a2414')
    r = np.random.default_rng(5)
    for sy in (13, 27, 41):
        p.put(0, sy, 64, sy + 3, '#8a5626'); p.put(0, sy, 64, sy + 1, '#ad7034')
        x = 4
        while x < 58:
            kind = int(r.integers(0, 3))
            c = ['#2e7a3a', '#7a2a2a', '#3a5aa8', '#c89040', '#6a3a8a'][int(r.integers(0, 5))]
            if kind == 0:                                                   # butelka
                p.put(x, sy - 9, x + 3, sy, c); p.put(x + 1, sy - 12, x + 2, sy - 9, c); p.px(x, sy - 8, '#ffffff')
                x += 5
            elif kind == 1:                                                 # dzban
                p.put(x, sy - 8, x + 5, sy, '#b06a3a'); p.put(x + 1, sy - 10, x + 4, sy - 8, '#b06a3a'); p.px(x, sy - 7, '#d88a50')
                x += 7
            else:                                                           # kufel
                p.put(x, sy - 6, x + 4, sy, '#c8ccd6'); p.put(x, sy - 7, x + 4, sy - 6, '#fbf6ea'); p.put(x + 4, sy - 5, x + 5, sy - 2, '#9aa2ae')
                x += 7
    return p.done(), (32, 43)


def barrel():
    """beczka z obręczami"""
    p = Px(18, 22)
    for y in range(2, 22):
        w = 7 + (1 if 5 < y < 18 else 0)
        for x in range(9 - w, 9 + w):
            p.px(x, y, '#ad7034' if x < 7 else '#8a5626' if x < 13 else '#673e1c')
    for y in (4, 11, 18):
        p.put(1, y, 17, y + 2, '#4a4652'); p.put(1, y, 6, y + 1, '#7a7682')
    p.put(3, 0, 15, 3, '#9a6230'); p.put(4, 1, 14, 2, '#c08a50')
    return p.done(), (9, 21)


def scale2x(a):
    """powiększenie ×2 algorytmem Scale2x (EPX) – gładsze skosy niż zwykłe podwojenie pikseli"""
    h, w = a.shape[:2]
    key = a[..., 0].astype(np.int64) << 24 | a[..., 1].astype(np.int64) << 16 | a[..., 2].astype(np.int64) << 8 | a[..., 3]
    pad = np.pad(key, 1, mode='edge'); apad = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    P = pad[1:-1, 1:-1]; A = pad[:-2, 1:-1]; B = pad[1:-1, 2:]; C = pad[1:-1, :-2]; D = pad[2:, 1:-1]
    out = np.zeros((h * 2, w * 2, 4), np.uint8)
    srcA, srcB, srcC, srcD = apad[:-2, 1:-1], apad[1:-1, 2:], apad[1:-1, :-2], apad[2:, 1:-1]
    e0 = np.where(((C == A) & (C != D) & (A != B))[..., None], srcA, a)
    e1 = np.where(((A == B) & (A != C) & (B != D))[..., None], srcB, a)
    e2 = np.where(((D == C) & (D != B) & (C != A))[..., None], srcC, a)
    e3 = np.where(((B == D) & (B != A) & (D != C))[..., None], srcD, a)
    out[0::2, 0::2] = e0; out[0::2, 1::2] = e1; out[1::2, 0::2] = e2; out[1::2, 1::2] = e3
    return out


def big(fn):
    """sprite ×2 (Scale2x) z kotwicą ×2"""
    def g(*args):
        a, (ax, ay) = fn(*args)
        return scale2x(a), (ax * 2 + 1, ay * 2 + 1)
    return g


def _chair(g, u, v, face):
    """krzesło z oparciem; face – strona, w którą siedzi gość (oparcie po przeciwnej): 'u+', 'u-', 'v+', 'v-'"""
    seat, side, dark = '#c08a50', '#9a6230', '#5a3418'
    for (du, dv) in ((0, 0), (7, 0), (0, 7), (7, 7)):                    # nogi
        g.box(u + du, u + du + 1.2, v + dv, v + dv + 1.2, 0, 8, side, side, dark)
    g.box(u, u + 8.2, v, v + 8.2, 8, 10, seat, side, dark,
          lambda f, a, b: '#d8a060' if f == 't' and (int(a) + int(b)) % 4 == 0 else None)
    if face == 'u+':                                                     # oparcie od strony -u
        g.box(u, u + 1.6, v, v + 8.2, 10, 22, '#b07840', '#8a5626', dark, lambda f, a, b: dark if f == 'u' and int(b) % 4 == 3 else None)
    elif face == 'u-':
        g.box(u + 6.6, u + 8.2, v, v + 8.2, 10, 22, '#b07840', '#8a5626', dark, lambda f, a, b: dark if f == 'u' and int(b) % 4 == 3 else None)
    elif face == 'v+':
        g.box(u, u + 8.2, v, v + 1.6, 10, 22, '#b07840', '#a06a34', dark, lambda f, a, b: dark if f == 'v' and int(b) % 4 == 3 else None)
    else:
        g.box(u, u + 8.2, v + 6.6, v + 8.2, 10, 22, '#b07840', '#a06a34', dark, lambda f, a, b: dark if f == 'v' and int(b) % 4 == 3 else None)


def tavern_table(seed):
    """duży stół karczemny (ok. 4× większy): gruby blat z desek, cztery toczone nogi, sześć krzeseł z oparciami,
    na blacie kufle, talerze z jedzeniem, dzban i świeca"""
    TL, TW = 40, 26                                                       # długość (u), szerokość (v)
    g = Iso(TL + TW + 60, 110, TW + 30, 70)
    r = np.random.default_rng(seed)
    # krzesła za stołem (dalsze) – rysowane przed stołem
    for u in (4, 16, 28):
        _chair(g, u, -12, 'v+')
    _chair(g, -12, 9, 'u+')
    leg = ('#8a5626', '#6a4220', '#3a2414')
    for (u, v) in ((2, 2), (TL - 4, 2), (2, TW - 4), (TL - 4, TW - 4)):
        g.box(u, u + 2.5, v, v + 2.5, 0, 16, *leg)
        g.box(u - 0.5, u + 3, v - 0.5, v + 3, 6, 7.5, '#a06a34', '#7a4a20', '#4a2c14')
    g.box(0, TL, 0, TW, 16, 19, '#c08a50', '#9a6230', '#5a3418',
          lambda f, a, b: ('#a06a34' if f == 't' and int(b) % 6 == 0 else '#d09a5a' if f == 't' and int(b) % 6 == 2 else None))
    # na blacie
    for _ in range(5):
        u, v = r.uniform(3, TL - 6), r.uniform(3, TW - 6)
        g.box(u, u + 3, v, v + 3, 19, 24, '#fbf6ea', '#d8dce4', '#8a92a0')
        g.box(u + 3, u + 4, v + 1, v + 2, 20, 23, '#9aa2ae', '#9aa2ae', '#6a7280')
    for _ in range(3):
        u, v = r.uniform(4, TL - 9), r.uniform(4, TW - 9)
        g.box(u, u + 6, v, v + 6, 19, 19.6, '#f0e8d8', '#c8c0b0', '#a8a090')
        food = ['#c0603a', '#e8c050', '#8a4a2a', '#7ac040'][int(r.integers(0, 4))]
        g.box(u + 1.5, u + 4.5, v + 1.5, v + 4.5, 19.6, 21, food, food, '#5a2a14')
    u, v = TL / 2 - 2, TW / 2 - 2
    g.box(u, u + 4, v, v + 4, 19, 27, '#b06a3a', '#d88a50', '#8a4a24')    # dzban
    g.box(u + 8, u + 10, v + 4, v + 6, 19, 24, '#f4ecd8', '#e8e0cc', '#b8b0a0')  # świeca
    g.dot(u + 9, v + 5, 25, '#ffd040'); g.dot(u + 9, v + 5, 26, '#ff8a2a')
    # krzesła przed stołem (bliższe)
    for u in (4, 16, 28):
        _chair(g, u, TW + 4, 'v-')
    _chair(g, TL + 4, 9, 'u-')
    a = g.p.done()
    return a, g.P(TL / 2, TW / 2, 0)


def hearth(frame):
    """duży kominek: kamienny portal z łukiem i zwornikiem, gzyms z dzbanem, świecami i rogiem, osmalone wnętrze z cegły,
    żeliwne koziołki, polana, kocioł na haku, ogień z żarem i iskrami (3 klatki)"""
    W, H = 96, 112
    p = Px(W, H)
    r = np.random.default_rng(3)
    # kamienna obudowa z nieregularnymi ciosami
    p.put(0, 0, W, H, '#6a6672')
    y = 0
    while y < H:
        hh = int(r.integers(6, 9)); x = -int(r.integers(0, 10))
        while x < W:
            ww = int(r.integers(10, 18))
            c = ['#8a8692', '#7e7a88', '#948f9c', '#76727e'][int(r.integers(0, 4))]
            p.put(x + 1, y + 1, x + ww, y + hh, c); p.put(x + 1, y + 1, x + ww, y + 2, '#a8a4b0')
            p.put(x + ww - 1, y + 1, x + ww, y + hh, '#5a5662')
            x += ww
        y += hh
    # gzyms (półka) z drewna na wspornikach
    p.put(0, 40, W, 46, '#5a3418'); p.put(0, 40, W, 41, '#ad7034'); p.put(0, 45, W, 46, '#3a2414')
    for x in (6, 84):
        p.put(x, 46, x + 6, 52, '#4a2c14'); p.put(x, 46, x + 2, 52, '#7a4a20')
    # przedmioty na gzymsie: świece, dzban, róg, czaszka jelenia
    for x in (8, 82):
        p.put(x, 26, x + 4, 40, '#f4ecd8'); p.put(x, 26, x + 1, 40, '#ffffff'); p.put(x - 1, 38, x + 5, 40, '#c8a040')
        p.px(x + 1, 23, '#ffd040'); p.px(x + 2, 23, '#ffd040'); p.px(x + 1, 22, '#ff8a2a'); p.px(x + 2, 24, '#fff0a0')
    p.put(24, 28, 33, 40, '#b06a3a'); p.put(26, 25, 31, 28, '#b06a3a'); p.put(24, 28, 26, 40, '#d88a50'); p.put(33, 30, 35, 36, '#8a4a24')
    p.line(58, 38, 70, 30, '#e8dcc0'); p.line(58, 39, 70, 31, '#c8b8a0'); p.line(70, 30, 73, 26, '#e8dcc0'); p.put(56, 37, 60, 40, '#c8a040')
    # łuk paleniska ze zwornikiem
    ox0, ox1, top = 16, 80, 60
    cx = (ox0 + ox1) / 2
    for yy in range(top - 10, H):
        for xx in range(ox0 - 6, ox1 + 6):
            rx = (ox1 - ox0) / 2 + 6
            ins = abs(xx - cx) <= rx and (yy >= top or ((xx - cx) / rx) ** 2 + ((yy - top) / 12) ** 2 <= 1)
            if ins:
                p.px(xx, yy, '#a8a4b0' if (xx + yy) % 7 else '#8a8692')
    p.put(cx - 4, top - 13, cx + 5, top - 3, '#b8b4c0'); p.put(cx - 3, top - 12, cx + 4, top - 11, '#d0ccd8')
    # osmalone wnętrze z cegły
    for yy in range(top - 4, H):
        for xx in range(ox0, ox1):
            rx = (ox1 - ox0) / 2
            if abs(xx - cx) < rx and (yy >= top + 2 or ((xx - cx) / rx) ** 2 + ((yy - top - 2) / 8) ** 2 <= 1):
                brick = (yy // 4) % 2 == 0 and (xx + (yy // 4) * 3) % 8 == 0 or yy % 4 == 0
                depth = (yy - top) / (H - top)
                base = (40 + int(30 * depth), 22 + int(12 * depth), 18 + int(6 * depth))
                c = tuple(int(v * (0.7 if brick else 1.0)) for v in base)
                p.a[yy, xx, :3] = c; p.a[yy, xx, 3] = 255
    # kocioł na haku
    p.line(cx, top + 2, cx, top + 16, '#3a3640')
    for yy in range(top + 16, top + 30):
        w = 9 - abs(yy - (top + 22)) * 0.5
        p.put(cx - w, yy, cx + w, yy + 1, '#2a2830' if yy > top + 18 else '#4a4652')
    p.put(cx - 9, top + 16, cx + 9, top + 18, '#5a5662'); p.px(cx - 6, top + 20, '#6a6672')
    # koziołki i polana
    for xx in (ox0 + 8, ox1 - 11):
        p.put(xx, H - 14, xx + 3, H - 3, '#2a2830'); p.put(xx - 1, H - 15, xx + 4, H - 13, '#4a4652')
    p.put(ox0 + 6, H - 10, ox1 - 6, H - 6, '#6a4220'); p.put(ox0 + 6, H - 10, ox1 - 6, H - 9, '#8a5626')
    p.put(ox0 + 12, H - 13, ox1 - 14, H - 10, '#5a3418'); p.put(ox0 + 12, H - 13, ox1 - 14, H - 12, '#7a4a24')
    # żar
    for xx in range(ox0 + 4, ox1 - 4):
        if (xx * 7 + frame * 3) % 5 < 3:
            p.px(xx, H - 5, ['#ff6a1a', '#ffb030', '#c03a10'][(xx + frame) % 3])
    p.put(ox0 + 4, H - 4, ox1 - 4, H - 2, '#3a1a10')
    # ogień: warstwy płomieni + iskry
    fr = np.random.default_rng(frame * 11 + 5)
    cols = ['#c8300a', '#ff6a1a', '#ffb030', '#fff0a0']
    for layer, c in enumerate(cols):
        for i in range(14 - layer * 3):
            x = int(ox0 + 10 + fr.integers(0, ox1 - ox0 - 20))
            h = int((26 - layer * 6) + fr.integers(-4, 6))
            w = 4 - layer // 2
            for k in range(h):
                ww = max(1, int(w * (1 - k / h)))
                sway = int(round(np.sin(k * 0.35 + frame * 2 + i) * 1.5 * k / h))
                p.put(x + sway - ww // 2, H - 12 - k, x + sway + (ww + 1) // 2, H - 11 - k, c)
    for i in range(6):
        x = int(ox0 + 14 + fr.integers(0, ox1 - ox0 - 28)); yy = int(top + 6 + fr.integers(0, 18))
        p.px(x, yy, '#ffd060')
    # palenisko z płyt przed kominkiem
    return p.done(), (W // 2, H - 1)


def chimney():
    """komin z cegły na dach (bryła izometryczna z czapą)"""
    g = Iso(30, 44, 14, 34)
    def brick(face, a, b):
        if face == 't':
            return None
        return '#5a2a20' if int(b) % 4 == 0 or (int(a) + (int(b) // 4) * 3) % 6 == 0 else None
    g.box(0, 9, 0, 9, 0, 26, '#4a3a36', '#b05a40', '#7a3a2a', brick)
    g.box(-1, 10, -1, 10, 26, 29, '#2a2224', '#8a8692', '#5a5662')
    g.box(1.5, 7.5, 1.5, 7.5, 29, 29.5, '#1a1214', '#1a1214', '#1a1214')
    return g.p.done(), g.P(4.5, 4.5, 0)


def bar_counter(length=180):
    """lada baru wzdłuż v (front od strony +u): deski, ciemniejszy cokół, gruby blat z krawędzią, kufle, beczułka z kranem"""
    D, Hh = 18, 26
    g = Iso(length + D + 40, length // 2 + 80, length + 20, 60)
    def planks(face, a, b):
        if face == 'u':
            if b < 3:
                return '#3a2414'
            if b > Hh - 3:
                return '#d09a5a'
            return '#6a3e1c' if int(a) % 7 == 0 else ('#9a6230' if int(a) % 7 < 4 else '#8a5626')
        if face == 'v':
            return '#7a4a20' if b < Hh - 3 else '#b07840'
        return '#c08a50' if int(b) % 9 else '#9a6230'
    g.box(0, D, 0, length, 0, Hh, '#c08a50', '#8a5626', '#7a4a20', planks)
    g.box(-1, D + 2, -1, length + 1, Hh, Hh + 2, '#d8a060', '#a06a34', '#b07840')
    r = np.random.default_rng(9)
    for v in range(12, length - 10, 22):
        u = r.uniform(4, D - 6)
        g.box(u, u + 3, v, v + 3, Hh + 2, Hh + 7, '#fbf6ea', '#d8dce4', '#8a92a0')
    v = length * 0.55
    g.box(3, 13, v, v + 10, Hh + 2, Hh + 12, '#8a5626', '#ad7034', '#6a4220',
          lambda f, a, b: '#4a4652' if f != 't' and int(b) in (2, 7) else None)
    g.box(13, 15, v + 4, v + 6, Hh + 5, Hh + 7, '#c8a040', '#c8a040', '#8a6a20')
    return g.p.done(), g.P(D / 2, length / 2, 0)
