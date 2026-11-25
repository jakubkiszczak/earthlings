"""Bohater v2: 28x42, więcej detalu (twarz z oczami, brwiami, nosem, brodą; skórzany kaftan ze sznurowaniem,
naramienniki, karwasze z ćwiekami, pas z klamrą i sakwą, łaty na spodniach, cholewy butów, kij z kryształem).
5 kierunków (S, SE, E, NE, N) + lustro; chód 4 klatki, oddech 2. Kotwica = środek stóp (14, 41)."""
from pathlib import Path as _P
ROOT = _P(__file__).resolve().parent.parent
import numpy as np
from scipy import ndimage as ndi

PAL = dict(
    H='#fbfbf6', h='#d4d8e0', g='#9aa0b0', G='#6a7080',
    S='#f0c49c', s='#c8906a', z='#96603e', m='#a24e40', w='#f4f0e8', i='#3a7aa0', o='#1a1414', y='#b8bcc8',
    R='#d8503a', r='#a03222', x='#6a1e16',
    B='#9a6236', b='#6e4224', D='#4a2a16', c='#d4a462',
    L='#5a8ac0', l='#3a6496', n='#26446a',
    V='#7a4a28', v='#4e2e18', M='#d8d0c0',
    K='#3a2214', Y='#ecc460', U='#8a5a30',
    P='#3e4460', p='#2a2e44', q='#1c1e2e',
    A='#8a5230', a='#5a3218', j='#3a1e0e',
    T='#52ccd4', t='#2e96a4', Q='#1c5c6c', E='#12303c', e='#9af4fa',
    F='#c08a56', f='#7a4e2c', C='#8ae8ff', k='#3aa0d0',
)
COL = {kk: np.array([int(vv[q:q + 2], 16) for q in (1, 3, 5)], np.uint8) for kk, vv in PAL.items()}
W_, H_ = 28, 42
CX = 14


class Cv:
    def __init__(self):
        self.a = np.zeros((H_, W_, 4), np.uint8)

    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W_ and 0 <= y < H_ and c:
            self.a[y, x, :3] = COL[c]; self.a[y, x, 3] = 255

    def rect(self, x0, y0, x1, y1, c):
        for yy in range(int(round(y0)), int(round(y1)) + 1):
            for xx in range(int(round(x0)), int(round(x1)) + 1):
                self.px(xx, yy, c)

    def shade_rect(self, x0, y0, x1, y1, lit, mid, dark):
        x0, x1 = int(round(x0)), int(round(x1))
        w = max(1, x1 - x0)
        for yy in range(int(round(y0)), int(round(y1)) + 1):
            for xx in range(x0, x1 + 1):
                t = (xx - x0) / w
                self.px(xx, yy, lit if t < 0.3 else (mid if t < 0.75 else dark))

    def disc(self, cx, cy, rx, ry, lit, mid, dark):
        for yy in range(int(cy - ry - 1), int(cy + ry + 2)):
            for xx in range(int(cx - rx - 1), int(cx + rx + 2)):
                dx, dy = (xx - cx) / rx, (yy - cy) / ry
                if dx * dx + dy * dy <= 1:
                    l = dx * 0.7 + dy * 0.7
                    self.px(xx, yy, lit if l < -0.35 else (mid if l < 0.45 else dark))

    def line(self, x0, y0, x1, y1, c, c2=None):
        nn = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for q in range(nn + 1):
            t = q / max(nn, 1)
            xx, yy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            self.px(xx, yy, c)
            if c2:
                self.px(xx + 1, yy, c2)


def staff(cv, x0, y0, x1, y1):
    cv.line(x0, y0, x1, y1, 'F', 'f')
    # kryształ na szczycie + oplot
    cv.px(x1, y1 - 1, 'C'); cv.px(x1 + 1, y1 - 1, 'k'); cv.px(x1, y1 - 2, 'C'); cv.px(x1 + 1, y1 - 2, 'C')
    cv.px(x1, y1 - 3, 'e'); cv.px(x1 + 1, y1, 'D'); cv.px(x1, y1 + 1, 'D')


def hero(d, phase=0, breath=0, walking=True):
    cv = Cv()
    back = d in ('N', 'NE')
    side = {'S': 0, 'SE': 0.5, 'E': 1, 'NE': 0.5, 'N': 0}[d]
    stride = [1, 0, -1, 0][phase] if walking else 0
    by = breath
    cx = CX
    hx = cx + (1 if d in ('SE', 'NE') else (2 if d == 'E' else 0))

    def do_staff():
        if d == 'E':
            staff(cv, 18, 31 + by, 21, 3)
        elif d in ('S', 'SE'):
            staff(cv, 22, 31 + by, 24, 3)
        else:
            staff(cv, 21, 30 + by, 24, 2)
    if not back:
        do_staff()

    # ---------------- nogi i buty
    if side < 1:
        sep = 3.0 - side * 1.0
        for sgn in (-1, 1):
            lx = cx + sgn * sep
            lift = 1 if (stride > 0 and sgn < 0) or (stride < 0 and sgn > 0) else 0
            dx = stride * sgn * 0.6 * side
            cv.shade_rect(lx - 1.5 + dx, 30, lx + 1.5 + dx, 36 - lift, 'P', 'p', 'q')
            cv.px(lx - 0.5 + dx, 33 - lift, 'b'); cv.px(lx + 0.5 + dx, 33 - lift, 'b')   # łata na kolanie
            cv.shade_rect(lx - 1.5 + dx, 37 - lift, lx + 1.5 + dx, 40 - lift, 'A', 'a', 'j')
            cv.rect(lx - 1.5 + dx, 37 - lift, lx + 1.5 + dx, 37 - lift, 'A')   # wywinięta cholewa
            cv.px(lx + dx, 38 - lift, 'Y')                                       # sprzączka
            cv.rect(lx - 1.5 + dx + (1 if sgn > 0 else -1), 41 - lift, lx + 1.5 + dx + (1 if sgn > 0 else -1) * 0, 41 - lift, 'j')
    else:
        for sgn in (1, -1):   # najpierw noga dalsza (ciemniejsza)
            dx = stride * sgn * 2.2
            far = sgn > 0
            up = 1 if dx > 0 else 0
            cv.rect(cx - 1.5 + dx, 30, cx + 1.5 + dx, 36 - up, 'p' if far else 'P')
            if not far:
                cv.rect(cx + 0.5 + dx, 30, cx + 1.5 + dx, 36 - up, 'p')
            cv.rect(cx - 1.5 + dx, 37 - up, cx + 2.5 + dx, 40 - up, 'a' if far else 'A')
            cv.rect(cx - 1.5 + dx, 41 - up, cx + 3 + dx, 41 - up, 'j')
            if not far:
                cv.px(cx + dx, 38 - up, 'Y')

    # ---------------- tułów: kaftan
    tw = 5.0 - side * 1.2
    t0, t1 = 18 + by, 29
    cv.shade_rect(cx - tw, t0, cx + tw, t1, 'B', 'B', 'b')
    cv.rect(cx - tw, t1, cx + tw, t1, 'D')
    for xx in range(int(cx - tw) + 1, int(cx + tw), 2):
        cv.px(xx, t1 - 1, 'c')                       # przeszycia przy dolnym brzegu
    if not back:
        if side < 1:
            for k_, yy in enumerate(range(t0 + 3, t1 - 2)):   # sznurowanie
                cv.px(cx + (k_ % 2) - 0.5 + side, yy, 'c')
            cv.px(cx - 0.5 + side, t0 + 2, 'D'); cv.px(cx + 0.5 + side, t0 + 2, 'D')
        # pasy plecaka z przodu
        cv.line(cx - tw + 1, t0, cx - tw + 2, t1 - 2, 'D')
        if side < 0.6:
            cv.line(cx + tw - 1, t0, cx + tw - 2, t1 - 2, 'D')
    else:
        cv.rect(cx - 1, t0 + 1, cx, t1 - 1, 'b')    # szew na plecach
    # pas z klamrą i sakwą
    cv.rect(cx - tw, 27 + by, cx + tw, 28 + by, 'K')
    if not back:
        bxk = cx + side * 2
        cv.rect(bxk - 1, 27 + by, bxk, 28 + by, 'Y'); cv.px(bxk - 1, 27 + by, 'w')
        cv.rect(cx + tw - 2, 28 + by, cx + tw, 31 + by, 'U'); cv.px(cx + tw - 1, 29 + by, 'Y')
    else:
        cv.rect(cx - tw, 28 + by, cx - tw + 2, 31 + by, 'U')

    # ---------------- plecak
    if d == 'N':
        cv.rect(cx - 5, t0, cx - 4, t0 + 4, 'D'); cv.rect(cx + 4, t0, cx + 5, t0 + 4, 'D')
        cv.disc(cx, 23 + by, 5.6, 5.6, 'T', 't', 'Q')
        cv.disc(cx, 23 + by, 3.0, 3.0, 'Q', 'Q', 'Q'); cv.disc(cx, 23 + by, 1.9, 1.9, 'E', 'E', 'E')
        cv.px(cx - 1, 22 + by, 'e'); cv.px(cx, 22 + by, 'e'); cv.px(cx - 4, 20 + by, 'e')
        cv.rect(cx - 2, 17 + by, cx + 2, 17 + by, 'D')   # uchwyt
    elif d == 'NE':
        cv.disc(cx - 1.5, 23 + by, 5.6, 5.6, 'T', 't', 'Q')
        cv.disc(cx - 1.5, 23 + by, 3.0, 3.0, 'Q', 'Q', 'Q'); cv.disc(cx - 1.5, 23 + by, 1.9, 1.9, 'E', 'E', 'E')
        cv.px(cx - 2.5, 22 + by, 'e'); cv.px(cx - 1.5, 22 + by, 'e'); cv.px(cx - 5.5, 20 + by, 'e')
    elif d == 'E':
        cv.disc(cx - 5, 23 + by, 3.6, 5.0, 'T', 't', 'Q')
        cv.rect(cx - 6, 22 + by, cx - 6, 24 + by, 'E'); cv.px(cx - 7, 21 + by, 'e')
    elif d == 'SE':
        cv.shade_rect(cx - 7, t0 + 1, cx - 6, t0 + 8, 'T', 't', 'Q')

    # ---------------- ramiona: naramienniki, rękawy, karwasze, dłonie
    sw = -stride
    if side < 1:
        for sgn in (-1, 1):
            ax = cx + sgn * (tw + 1.3)
            ay = sw * sgn * 0.9
            lit = sgn < 0
            cv.rect(ax - 1, t0 + 2 + ay * 0.4, ax + 1, t0 + 6 + ay * 0.7, 'L' if lit else 'l')
            cv.px(ax + (1 if lit else -1), t0 + 3 + ay * 0.4, 'n')
            cv.rect(ax - 1, t0 + 7 + ay * 0.8, ax + 1, t0 + 9 + ay, 'V' if lit else 'v')    # karwasz
            cv.px(ax, t0 + 8 + ay, 'M')                                                   # ćwiek
            cv.rect(ax - 1, t0 + 10 + ay, ax + 1, t0 + 11 + ay, 'S' if lit else 's')
            cv.rect(ax - 1.5, t0, ax + 1.5, t0 + 1, 'V' if lit else 'v')                  # naramiennik
            cv.px(ax, t0, 'M')
    else:
        ax = cx + 1 + sw * 1.6
        cv.rect(ax - 1, t0 + 2, ax + 1, t0 + 6, 'L'); cv.px(ax + 1, t0 + 4, 'l')
        cv.rect(ax - 1, t0 + 7, ax + 1, t0 + 9, 'V'); cv.px(ax, t0 + 8, 'M')
        cv.rect(ax - 1, t0 + 10, ax + 1, t0 + 11, 'S'); cv.px(ax + 1, t0 + 11, 's')
        cv.rect(ax - 2, t0, ax + 2, t0 + 1, 'V'); cv.px(ax, t0, 'M')

    # ---------------- szal (z węzłem i fałdami)
    cv.rect(cx - tw + 0.5, 16 + by, cx + tw - 0.5, 17 + by, 'R')
    cv.rect(cx + tw - 2.5, 16 + by, cx + tw - 0.5, 17 + by, 'r')
    cv.px(cx - 1, 17 + by, 'r'); cv.px(cx + 2, 16 + by, 'x')
    if not back:
        kx = cx - 3 + side * 2
        cv.rect(kx, 18 + by, kx + 1, 21 + by, 'R'); cv.px(kx + 1, 19 + by, 'r'); cv.px(kx, 21 + by, 'x'); cv.px(kx + 1, 22 + by, 'r')
    else:
        cv.rect(cx + 2, 18 + by, cx + 3, 21 + by, 'r'); cv.px(cx + 3, 22 + by, 'x')

    # ---------------- głowa
    hy = 10 + by
    if back:
        cv.disc(hx, hy, 5.6, 6.0, 'H', 'h', 'g')
        for k_ in range(-4, 5, 2):          # pasma włosów
            cv.line(hx + k_ * 0.8, hy - 4, hx + k_, hy + 4, 'h')
        cv.px(hx - 2, hy - 4, 'H'); cv.px(hx - 3, hy - 3, 'H')
        cv.rect(hx - 4, hy + 5, hx + 4, hy + 5, 'g')
        if d == 'NE':
            cv.rect(hx + 4.5, hy, hx + 5.5, hy + 3, 's'); cv.px(hx + 5.5, hy + 1, 'z')   # policzek/ucho
            cv.px(hx + 5, hy + 4, 'h')
    else:
        cv.disc(hx, hy - 0.5, 5.6, 6.0, 'H', 'h', 'g')
        # twarz
        if d == 'S':
            fx0, fx1 = hx - 3, hx + 3
        elif d == 'SE':
            fx0, fx1 = hx - 2, hx + 4
        else:
            fx0, fx1 = hx, hx + 5
        cv.rect(fx0, hy - 1, fx1, hy + 4, 'S')
        cv.rect(fx1 - 1, hy - 1, fx1, hy + 3, 's')
        cv.rect(fx0, hy + 4, fx1, hy + 4, 's')
        # grzywka
        for xx in range(int(fx0), int(fx1) + 1):
            cv.px(xx, hy - 2, 'H' if xx % 2 else 'h')
        cv.px(fx0 + 1, hy - 1, 'h'); cv.px(fx1 - 1, hy - 1, 'g')
        if d == 'S':
            cv.px(hx - 2, hy, 'y'); cv.px(hx - 1, hy, 'y'); cv.px(hx + 1, hy, 'y'); cv.px(hx + 2, hy, 'y')      # brwi
            cv.px(hx - 2, hy + 1, 'w'); cv.px(hx - 1, hy + 1, 'i'); cv.px(hx + 1, hy + 1, 'i'); cv.px(hx + 2, hy + 1, 'w')
            cv.px(hx, hy + 2, 's'); cv.px(hx, hy + 1, 'S')                                                       # nos
            cv.rect(hx - 2, hy + 3, hx + 2, hy + 5, 'h'); cv.px(hx - 3, hy + 3, 'g'); cv.px(hx + 3, hy + 3, 'g')  # broda
            cv.rect(hx - 1, hy + 3, hx + 1, hy + 3, 'm'); cv.px(hx, hy + 3, 'z')                                # usta
            cv.rect(hx - 1, hy + 6, hx + 1, hy + 6, 'g')
        elif d == 'SE':
            cv.px(hx - 1, hy, 'y'); cv.px(hx + 2, hy, 'y'); cv.px(hx + 3, hy, 'y')
            cv.px(hx - 1, hy + 1, 'i'); cv.px(hx + 2, hy + 1, 'w'); cv.px(hx + 3, hy + 1, 'i')
            cv.px(hx + 4, hy + 2, 's'); cv.px(hx + 1, hy + 2, 's')
            cv.rect(hx - 1, hy + 3, hx + 3, hy + 5, 'h'); cv.px(hx + 4, hy + 3, 'g')
            cv.rect(hx, hy + 3, hx + 2, hy + 3, 'm')
            cv.rect(hx, hy + 6, hx + 2, hy + 6, 'g')
            cv.px(hx - 2, hy + 1, 'z')   # ucho
        else:  # E profil
            cv.px(hx + 3, hy, 'y'); cv.px(hx + 4, hy, 'y')
            cv.px(hx + 3, hy + 1, 'w'); cv.px(hx + 4, hy + 1, 'i')
            cv.px(hx + 6, hy + 2, 'S'); cv.px(hx + 6, hy + 1, 's')   # nos
            cv.rect(hx + 2, hy + 3, hx + 5, hy + 5, 'h'); cv.px(hx + 5, hy + 3, 'm'); cv.px(hx + 4, hy + 3, 'm')
            cv.px(hx + 1, hy + 1, 'z'); cv.px(hx + 1, hy + 2, 's')   # ucho
            cv.rect(hx - 4, hy - 1, hx - 1, hy + 5, 'h'); cv.rect(hx - 4, hy + 3, hx - 2, hy + 5, 'g')  # tył włosów
    if back:
        do_staff()
    # ---------------- kontur (ciemny, z jaśniejszym od strony światła)
    a = cv.a
    m = a[..., 3] > 0
    out = ndi.binary_dilation(m) & ~m
    a[out, :3] = (22, 15, 18); a[out, 3] = 255
    return a


def portrait():
    """Portret 34x34 do ramki HUD: twarz w 3/4, więcej detalu niż sprite."""
    Pp = dict(PAL)
    im = np.zeros((34, 34, 4), np.uint8)
    yy, xx = np.mgrid[0:34, 0:34]

    def put(mask, c):
        im[mask, :3] = COL[c]; im[mask, 3] = 255
    # tło: szal i ramiona
    put((yy > 26) & (np.abs(xx - 17) < 15), 'B')
    put((yy > 26) & (xx > 24) & (np.abs(xx - 17) < 15), 'b')
    put((yy > 23) & (yy < 29) & (np.abs(xx - 17) < 11), 'R')
    put((yy > 25) & (yy < 29) & (xx > 21) & (np.abs(xx - 17) < 11), 'r')
    put((yy >= 29) & (np.abs(xx - 12) < 2), 'D')
    # włosy
    hair = ((xx - 17) / 11.5) ** 2 + ((yy - 13) / 12.5) ** 2 < 1
    put(hair, 'h')
    put(hair & ((xx + yy) < 26), 'H')
    put(hair & ((xx - yy) > 12), 'g')
    # twarz
    face = ((xx - 18) / 7.2) ** 2 + ((yy - 15) / 8.6) ** 2 < 1
    put(face, 'S')
    put(face & (xx > 21), 's')
    put(face & (xx > 24), 'z')
    for x0 in range(10, 26, 2):
        put((yy == 8 + (x0 % 4) // 2) & (xx == x0), 'H')       # grzywka
    put((yy <= 9) & face, 'h')
    # brwi, oczy
    put((yy == 12) & ((xx == 14) | (xx == 15) | (xx == 19) | (xx == 20) | (xx == 21)), 'y')
    put((yy == 13) & (xx == 14), 'w'); put((yy == 13) & (xx == 15), 'i'); put((yy == 14) & (xx == 15), 'o')
    put((yy == 13) & (xx == 19), 'w'); put((yy == 13) & (xx == 20), 'i'); put((yy == 14) & (xx == 20), 'o')
    put((yy == 14) & (xx == 14), 's'); put((yy == 14) & (xx == 21), 's')
    # nos
    put((yy >= 14) & (yy <= 17) & (xx == 17), 's'); put((yy == 18) & ((xx == 16) | (xx == 18)), 'z')
    # broda + wąsy + usta
    beard = ((xx - 18) / 6.6) ** 2 + ((yy - 21.5) / 4.2) ** 2 < 1
    put(beard & (yy >= 19), 'h'); put(beard & (yy >= 19) & (xx > 21), 'g'); put(beard & (yy >= 22) & ((xx + yy) % 3 == 0), 'H')
    put((yy == 19) & (xx >= 15) & (xx <= 21), 'h')
    put((yy == 20) & (xx >= 16) & (xx <= 20), 'm'); put((yy == 20) & (xx == 18), 'z')
    # zmarszczka
    put((yy == 16) & (xx == 22), 'z')
    m = im[..., 3] > 0
    out = ndi.binary_dilation(m) & ~m
    im[out, :3] = (22, 15, 18); im[out, 3] = 255
    return im


def all_frames():
    fr = {}
    for d in ('S', 'SE', 'E', 'NE', 'N'):
        for k_ in range(4):
            fr[f'hero_{d}_walk{k_}'] = hero(d, k_, breath=(k_ % 2), walking=True)
        fr[f'hero_{d}_idle0'] = hero(d, 0, 0, walking=False)
        fr[f'hero_{d}_idle1'] = hero(d, 0, 1, walking=False)
    return fr


if __name__ == '__main__':
    from PIL import Image
    fr = all_frames()
    sc = 4
    sheet = Image.new('RGBA', (6 * (W_ + 2) * sc + 40 * sc, 5 * (H_ + 2) * sc), (90, 150, 70, 255))
    for r_, d in enumerate(('S', 'SE', 'E', 'NE', 'N')):
        for c_, nm in enumerate([f'walk{k_}' for k_ in range(4)] + ['idle0', 'idle1']):
            im = Image.fromarray(fr[f'hero_{d}_{nm}']).resize((W_ * sc, H_ * sc), Image.NEAREST)
            sheet.alpha_composite(im, (c_ * (W_ + 2) * sc, r_ * (H_ + 2) * sc))
    pt = Image.fromarray(portrait()).resize((34 * sc * 2, 34 * sc * 2), Image.NEAREST)
    sheet.alpha_composite(pt.crop((0, 0, 40 * sc, 34 * sc * 2)), (6 * (W_ + 2) * sc, 0))
    sheet.save(str(ROOT / 'docs' / 'hero9_arkusz.png'))
    Image.fromarray(portrait()).resize((34 * 8, 34 * 8), Image.NEAREST).save(str(ROOT / 'docs' / 'portret.png'))
