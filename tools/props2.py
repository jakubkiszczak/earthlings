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
    """latarnia o 50% większa (16×58), kotwica w podstawie"""
    p = Px(17, 60)
    p.put(6, 13, 11, 54, '#3a3640'); p.put(6, 13, 7, 54, '#5a5662'); p.put(10, 13, 11, 54, '#24222a')
    for y in (22, 34, 46):
        p.put(5, y, 12, y + 2, '#4a4652')                         # pierścienie na słupie
    p.put(3, 52, 14, 58, '#6c6a72'); p.put(3, 52, 6, 58, '#8a8890'); p.put(11, 52, 14, 58, '#4a4850')
    p.put(2, 56, 15, 58, '#5c5a62')
    p.put(3, 3, 14, 14, '#24222a')                               # klatka latarni
    p.put(4, 4, 13, 13, '#ffd060'); p.put(4, 4, 7, 13, '#fff0a8'); p.put(11, 4, 13, 13, '#e8a030')
    p.put(8, 4, 9, 13, '#3a3640'); p.put(4, 8, 13, 9, '#3a3640')
    p.put(4, 0, 13, 3, '#3a3640'); p.put(7, 0, 10, 1, '#5a5662'); p.px(8, 0, '#8a8890')
    p.put(5, 14, 12, 15, '#3a3640')
    return p.done(), (8, 57)


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
