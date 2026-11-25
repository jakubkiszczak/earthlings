"""Interfejs v2 (oryginalny projekt): kamienno-brązowa obudowa ekranu z bluszczem i latarniami, kule HP/many,
taca umiejętności, panel ekwipunku z sylwetką postaci. Wszystko w pikselach natywnych (skalowane x2/x3 w CSS)."""
from pathlib import Path as _P
ROOT = _P(__file__).resolve().parent.parent
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import sys
sys.path.insert(0, str(ROOT / 'tools'))
import hero9

OUT = str(ROOT / 'assets' / 'generated' / 'ui2')
os.makedirs(OUT, exist_ok=True)


def hexs(l):
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in l], np.float32)


ST = hexs(['#110e14', '#1d1a22', '#2b2731', '#3b3641', '#4c4652', '#5f5864', '#756d78', '#8e8690'])
BR = hexs(['#24160c', '#432914', '#6c4320', '#98642c', '#c48e3e', '#e8bc5e', '#fde9a6'])
IV = hexs(['#0e2614', '#163a1c', '#205024', '#2e6a2c', '#438634', '#62a43e', '#8cc44e'])
RD = hexs(['#1e0608', '#3e0c10', '#64161a', '#8e2226', '#c03a34', '#e8684e'])
LT = hexs(['#120d0a', '#1c1510', '#271d16', '#33271d', '#413226', '#54412f'])
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32) / 16 - 0.47
rng = np.random.default_rng(7)


def ramp(pal, f, ys, xs):
    f = f + BAY[ys % 4, xs % 4]
    return pal[np.clip(np.floor(f + 0.5), 0, len(pal) - 1).astype(int)]


def hsh(*a):
    h = np.full(np.broadcast(*a).shape, 2166136261, np.uint64)
    for x in a:
        h = ((h ^ (np.asarray(x).astype(np.int64) & 0xffffffff).astype(np.uint64)) * np.uint64(16777619)) & np.uint64(0xffffffff)
    h ^= h >> np.uint64(13); h = (h * np.uint64(0x5bd1e995)) & np.uint64(0xffffffff); h ^= h >> np.uint64(15)
    return (h & np.uint64(0xffff)).astype(np.float32) / 65535.0


class Img:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.c = np.zeros((h, w, 3), np.float32); self.a = np.zeros((h, w), bool)
        self.yy, self.xx = np.mgrid[0:h, 0:w]

    def put(self, m, col):
        if col.ndim == 1:
            self.c[m] = col
        else:
            self.c[m] = col[m]
        self.a |= m

    def save(self, name):
        out = np.zeros((self.h, self.w, 4), np.uint8)
        out[..., :3] = np.clip(self.c, 0, 255); out[..., 3] = self.a * 255
        Image.fromarray(out).save(f'{OUT}/{name}.png')
        return out


def stone(im, m, seed=0, rowh=6, bw=11, base=3.2, ox=0, oy=0):
    yy, xx = im.yy + oy, im.xx + ox
    row = yy // rowh
    off = (hsh(row, seed) * bw).astype(int)
    col = (xx + off) // bw
    ly, lx = (yy % rowh) / rowh, ((xx + off) % bw) / bw
    b = hsh(row, col, seed + 1)
    f = base + 1.6 * (b - 0.5) + 1.0 * (ly < 0.25) - 0.9 * (ly > 0.75) + 0.4 * (lx < 0.15) - 0.4 * (lx > 0.9)
    f -= 0.8 * (hsh(xx // 2, yy // 2, seed + 2) > 0.88)
    joint = ((yy % rowh) == 0) | (((xx + off) % bw) == 0)
    f = np.where(joint, 0.6, f)
    im.put(m, ramp(ST, f, im.yy, im.xx))


def bronze_band(im, m, vertical=False, lit=True):
    """pasek brązu z fazowaniem (jasna krawędź u góry/z lewej)"""
    ys, xs = np.nonzero(m)
    if not len(ys):
        return
    if vertical:
        t = (im.xx - xs.min()) / max(1, xs.max() - xs.min())
    else:
        t = (im.yy - ys.min()) / max(1, ys.max() - ys.min())
    f = 4.6 - 3.2 * t + 0.6 * (hsh(im.xx // 3, im.yy // 3, 9) - 0.5)
    im.put(m, ramp(BR, f, im.yy, im.xx))


def rivet(im, x, y):
    for (dx, dy, k) in [(0, 0, 6), (1, 0, 4), (0, 1, 4), (1, 1, 2), (-1, 0, 3), (0, -1, 5), (-1, 1, 1), (1, -1, 3)]:
        if 0 <= x + dx < im.w and 0 <= y + dy < im.h:
            im.c[y + dy, x + dx] = BR[k]; im.a[y + dy, x + dx] = True


def ivy(im, pts, seed=0):
    """pnącze bluszczu wzdłuż łamanej + liście"""
    r = np.random.default_rng(seed)
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n + 1):
            t = k / max(n, 1)
            x, y = int(round(x0 + (x1 - x0) * t + np.sin(k * 0.7 + seed) * 0.8)), int(round(y0 + (y1 - y0) * t))
            if 0 <= x < im.w and 0 <= y < im.h:
                im.c[y, x] = IV[1]; im.a[y, x] = True
            if r.random() < 0.35:
                leaf(im, x + r.integers(-2, 3), y + r.integers(-2, 3), r)


def leaf(im, x, y, r):
    shape = [(0, 0, 5), (1, 0, 4), (-1, 0, 4), (0, -1, 6), (0, 1, 3), (1, 1, 2), (-1, -1, 5)]
    for (dx, dy, k) in shape:
        if r.random() < 0.85 and 0 <= x + dx < im.w and 0 <= y + dy < im.h:
            im.c[y + dy, x + dx] = IV[k]; im.a[y + dy, x + dx] = True


def outline(im, col=(10, 8, 10)):
    out = ndi.binary_dilation(im.a) & ~im.a
    im.c[out] = col; im.a |= out


meta = {}

# ================================================================== obudowa ekranu
# górna listwa (kafel 16x8) i boczna (8x16)
im = Img(16, 8)
stone(im, im.yy < 6, seed=1, rowh=6, bw=8)
bronze_band(im, im.yy >= 6)
rivet(im, 8, 6)
im.save('edge_top')
im = Img(8, 16)
stone(im, im.xx < 6, seed=2, rowh=8, bw=6)
bronze_band(im, im.xx >= 6, vertical=True)
im.save('edge_left')
im2 = Image.open(f'{OUT}/edge_left.png').transpose(Image.FLIP_LEFT_RIGHT); im2.save(f'{OUT}/edge_right.png')

# narożnik lewy-górny z medalionem na portret (48x48)
im = Img(48, 48)
m = (im.yy < 8) | (im.xx < 8)
stone(im, m, seed=3)
cx, cy, R = 22, 22, 19
d = np.hypot(im.xx - cx, im.yy - cy)
stone(im, d < R + 1, seed=4, base=3.6)
ring = (d >= R - 3) & (d < R)
f = 4.4 - 2.4 * ((im.xx - cx + im.yy - cy) / (2 * R) + 0.5)
im.put(ring, ramp(BR, f, im.yy, im.xx))
inner = d < R - 3
im.put(inner, ST[0])
for ang in np.linspace(0, 2 * np.pi, 9)[:-1]:
    rivet(im, int(cx + np.cos(ang) * (R - 1.5)), int(cy + np.sin(ang) * (R - 1.5)))
bronze_band(im, (im.yy >= 6) & (im.yy < 8) & (im.xx > 36))
bronze_band(im, (im.xx >= 6) & (im.xx < 8) & (im.yy > 36), vertical=True)
ivy(im, [(2, 46), (4, 34), (8, 30), (12, 40)], 1)
ivy(im, [(46, 2), (36, 4), (30, 8)], 2)
im.a &= ~(inner & False)
im.save('corner_tl')
meta['portrait'] = dict(cx=cx, cy=cy, r=R - 3)
Image.open(f'{OUT}/corner_tl.png').transpose(Image.FLIP_LEFT_RIGHT).save(f'{OUT}/corner_tr_base.png')
# prawy-górny: zwykły narożnik z okuciem (24x24)
im = Img(24, 24)
m = (im.yy < 8) | (im.xx >= 16)
stone(im, m, seed=5)
bronze_band(im, (im.yy >= 6) & (im.yy < 8) & (im.xx < 18))
bronze_band(im, (im.xx >= 16) & (im.xx < 18) & (im.yy > 6), vertical=True)
for (x, y) in [(20, 3), (12, 3), (20, 12)]:
    rivet(im, x, y)
ivy(im, [(23, 22), (20, 14), (21, 6), (12, 2)], 3)
im.save('corner_tr')
# herb na środku górnej listwy (44x16)
im = Img(44, 16)
sh = (np.abs(im.xx - 21.5) / 22 + im.yy / 16) < 1.05
stone(im, sh & (im.yy < 12), seed=6, base=3.8)
bronze_band(im, sh & (im.yy >= 10) & (im.yy < 12))
d = np.hypot(im.xx - 21.5, im.yy - 6)
im.put(d < 6, ramp(BR, 4.6 - (im.xx - 16) / 12 * 2.5, im.yy, im.xx))
im.put(d < 3.5, ST[1])
tower = (np.abs(im.xx - 21.5) < 1.6) & (im.yy >= 4) & (im.yy <= 8)   # emblemat wieży
im.put(tower, BR[6]); im.put((np.abs(im.xx - 21.5) < 2.6) & (im.yy == 4) & ((im.xx % 2) == 0), BR[6])
for x in (8, 35):
    rivet(im, x, 6)
outline(im)
im.save('crest')

# ================================================================== konsola dolna
CH = 46     # wysokość konsoli
# wypełnienie (kafel 16 x CH)
im = Img(16, CH)
stone(im, im.yy >= 4, seed=10, rowh=7, bw=9, base=2.8)
bronze_band(im, (im.yy >= 2) & (im.yy < 5))
im.put(im.yy < 2, ST[0])
rivet(im, 8, 3)
im.save('console_fill')

# zakończenie z kulą (lewe) 92 x (CH+18): kula wystaje 18 px ponad konsolę
OW = 92
OH = CH + 18
OR = 21
def orb_cap(name, seed, lantern_left=True):
    im = Img(OW, OH)
    top = OH - CH
    stone(im, im.yy >= top + 4, seed=seed, rowh=7, bw=9, base=2.8, oy=-(top % 7))
    bronze_band(im, (im.yy >= top + 2) & (im.yy < top + 5))
    im.put((im.yy >= top) & (im.yy < top + 2), ST[0])
    ocx, ocy = 50, top + 22
    d = np.hypot(im.xx - ocx, im.yy - ocy)
    # kamienna misa pod kulą
    stone(im, (d < OR + 7) & (im.yy > ocy - 6), seed=seed + 1, base=3.6, rowh=5, bw=7)
    ring = (d >= OR) & (d < OR + 4)
    f = 4.8 - 3.0 * ((im.xx - ocx + im.yy - ocy) / (2 * (OR + 4)) + 0.5)
    im.put(ring, ramp(BR, f, im.yy, im.xx))
    im.put(d < OR, ST[0])
    for ang in np.linspace(0, 2 * np.pi, 13)[:-1]:
        rivet(im, int(round(ocx + np.cos(ang) * (OR + 2))), int(round(ocy + np.sin(ang) * (OR + 2))))
    # latarnia na zewnętrznym końcu
    lx = 12
    post = (np.abs(im.xx - lx) < 1.5) & (im.yy > top - 4) & (im.yy < top + 6)
    im.put(post, BR[2])
    cage = (np.abs(im.xx - lx) <= 5) & (im.yy >= top - 16) & (im.yy <= top - 4)
    glass = (np.abs(im.xx - lx) <= 3) & (im.yy >= top - 14) & (im.yy <= top - 6)
    im.put(cage, BR[1]); im.put(glass, hexs(['#ffcf6a'])[0])
    im.put(glass & (im.yy > top - 9), hexs(['#ffe9a0'])[0])
    im.put((np.abs(im.xx - lx) <= 6) & (im.yy == top - 17), BR[3])
    im.put((np.abs(im.xx - lx) <= 1) & (im.yy == top - 18), BR[4])
    for yb in (top - 10,):
        im.put((np.abs(im.xx - lx) <= 3) & (im.yy == yb), BR[1])
    ivy(im, [(2, OH - 1), (6, top + 10), (14, top + 2), (24, top + 6), (28, top - 1)], seed)
    ivy(im, [(OW - 1, top + 6), (80, top + 9), (72, top + 4)], seed + 5)
    outline(im)
    out = im.save(name)
    return dict(ocx=ocx, ocy=ocy, r=OR, lx=lx, ly=top - 15, top=top)
meta['orb'] = orb_cap('cap_left', 20)
Image.open(f'{OUT}/cap_left.png').transpose(Image.FLIP_LEFT_RIGHT).save(f'{OUT}/cap_right.png')
meta['console'] = dict(h=CH, ow=OW, oh=OH)

# szkło kuli (nakładka 42x42): odblaski + ciemniejsza krawędź
G = 2 * OR
im = Img(G, G)
d = np.hypot(im.xx - OR + 0.5, im.yy - OR + 0.5)
edge = (d < OR) & (d > OR - 3)
c = np.zeros((G, G, 4), np.uint8)
c[edge] = (0, 0, 0, 90)
hl = (np.hypot(im.xx - OR * 0.62, im.yy - OR * 0.52) < OR * 0.28) & (d < OR - 2)
c[hl] = (255, 255, 255, 70)
hl2 = (np.hypot(im.xx - OR * 0.55, im.yy - OR * 0.45) < OR * 0.12)
c[hl2] = (255, 255, 255, 170)
rim = (d < OR - 2) & (d > OR - 4) & (im.xx + im.yy > 2.4 * OR)
c[rim] = (255, 255, 255, 50)
Image.fromarray(c).save(f'{OUT}/orb_glass.png')

# taca umiejętności (środek konsoli), 8 gniazd 20x20, wysunięta 6 px
NS = 8
SS = 20
TW = NS * (SS + 2) + 14
TH = CH + 6
im = Img(TW, TH)
stone(im, im.yy >= 6, seed=30, rowh=7, bw=9, base=3.1, oy=-6)
shape = (im.yy >= 0) & (im.xx >= 3 + np.maximum(0, 6 - im.yy)) & (im.xx < TW - 3 - np.maximum(0, 6 - im.yy))
stone(im, shape & (im.yy < 8), seed=31, base=3.4)
bronze_band(im, shape & (im.yy >= 2) & (im.yy < 5))
im.put(shape & (im.yy < 2), ST[0])
slots = []
sy0 = 12
for k in range(NS):
    x0 = 7 + k * (SS + 2)
    sl = (im.xx >= x0) & (im.xx < x0 + SS) & (im.yy >= sy0) & (im.yy < sy0 + SS)
    bez = sl & ~((im.xx >= x0 + 2) & (im.xx < x0 + SS - 2) & (im.yy >= sy0 + 2) & (im.yy < sy0 + SS - 2))
    f = 4.6 - 3.0 * (((im.xx - x0) + (im.yy - sy0)) / (2 * SS))
    im.put(bez, ramp(BR, f, im.yy, im.xx))
    inn = sl & ~bez
    im.put(inn, ST[0])
    im.put(inn & ((im.xx == x0 + 2) | (im.yy == sy0 + 2)), np.array([6, 5, 8], np.float32))
    slots.append([x0 + 2, sy0 + 2, SS - 4])
# podstawki z numerami: drobne kamienne tabliczki pod gniazdami
for k in range(NS):
    x0 = 7 + k * (SS + 2)
    plate = (im.xx >= x0 + 6) & (im.xx < x0 + SS - 6) & (im.yy >= sy0 + SS + 1) & (im.yy < sy0 + SS + 8)
    im.put(plate, ST[1])
rivet(im, 4, 9); rivet(im, TW - 5, 9)
outline(im)
im.save('tray')
meta['tray'] = dict(w=TW, h=TH, slots=slots, numy=sy0 + SS + 1)

# okrągły przycisk menu 22x22 (normal / hover)
for nm, lift in (('rbtn', 0), ('rbtn_h', 1)):
    im = Img(22, 22)
    d = np.hypot(im.xx - 10.5, im.yy - 10.5)
    f = 4.4 - 2.8 * ((im.xx + im.yy) / 22) + lift
    im.put(d < 11, ramp(BR, f, im.yy, im.xx))
    im.put(d < 8.5, ST[1 + lift])
    im.put((d < 8.5) & (d > 7.5) & (im.xx + im.yy < 21), ST[3])
    outline(im)
    im.save(nm)

# ================================================================== panel 9-slice (czat, podpowiedzi): kamień + brąz
im = Img(24, 24)
stone(im, np.ones((24, 24), bool), seed=40, base=2.4)
bord = (im.xx < 3) | (im.yy < 3) | (im.xx > 20) | (im.yy > 20)
f = np.where((im.xx < 3) | (im.yy < 3), 5.0, 2.6) - 0.6 * ((im.xx == 0) | (im.yy == 0) | (im.xx == 23) | (im.yy == 23)) * 4
im.put(bord, ramp(BR, f, im.yy, im.xx))
inner = (im.xx >= 4) & (im.yy >= 4) & (im.xx <= 19) & (im.yy <= 19)
c_in = ST[1] * 0.9
im.put(inner, np.broadcast_to(c_in, (24, 24, 3)).copy())
for (x, y) in [(1, 1), (21, 1), (1, 21), (21, 21)]:
    rivet(im, x + 0, y + 0)
im.save('panel9')

# ================================================================== panel ekwipunku 156 x 246
PW, PH = 156, 243
im = Img(PW, PH)
stone(im, np.ones((PH, PW), bool), seed=50, base=2.6)
# nagłówek: ostrołuk z czerwonym witrażem i maswerkiem
arch_top = 4
hdr = (im.yy >= arch_top) & (im.yy < 34) & (im.xx >= 6) & (im.xx < PW - 6)
glass = hdr & (im.yy >= 8) & (im.yy < 30) & (im.xx >= 10) & (im.xx < PW - 10)
gl = 3.0 - 1.6 * np.abs(im.xx - PW / 2) / (PW / 2) - 0.8 * (im.yy - 8) / 22 + 0.7 * (hsh(im.xx // 4, im.yy // 4, 51) - 0.5)
im.put(glass, ramp(RD, gl, im.yy, im.xx))
trac = glass & (((np.abs(np.sin((im.xx - PW / 2) / 9.0 + im.yy / 12.0)) < 0.12)) | ((np.abs(np.sin((im.xx - PW / 2) / 9.0 - im.yy / 12.0)) < 0.12)))
im.put(trac, ramp(BR, np.full((PH, PW), 2.2), im.yy, im.xx))
frm = hdr & ~glass
bronze_band(im, frm & (im.yy < 8)); bronze_band(im, frm & (im.yy >= 30))
im.put(frm & (im.yy >= 8) & (im.yy < 30), ramp(BR, np.full((PH, PW), 2.6), im.yy, im.xx))
# medalion z sakwą
mx, my, mr = PW // 2, 18, 13
d = np.hypot(im.xx - mx, im.yy - my)
im.put(d < mr, ramp(BR, 4.6 - 3.0 * ((im.xx - mx + im.yy - my) / (2 * mr) + 0.5), im.yy, im.xx))
im.put(d < mr - 3, ramp(hexs(['#0a1430', '#122458', '#1c3a86', '#2a58b8']), 2.4 - (im.yy - my) / 8, im.yy, im.xx))
bag = Image.open(str(ROOT / 'assets' / 'legacy_ui' / 'icon_chest.png'))   # ikona z rodziny ikon gry
ba = np.array(bag)
for y in range(14):
    for x in range(14):
        if ba[y, x, 3] > 0:
            im.c[my - 7 + y, mx - 7 + x] = ba[y, x, :3]; im.a[my - 7 + y, mx - 7 + x] = True
for ang in np.linspace(0, 2 * np.pi, 9)[:-1]:
    rivet(im, int(round(mx + np.cos(ang) * (mr - 1.5))), int(round(my + np.sin(ang) * (mr - 1.5))))
# pas tytułowy
ttl = (im.yy >= 34) & (im.yy < 44) & (im.xx >= 6) & (im.xx < PW - 6)
im.put(ttl, ramp(RD, np.full((PH, PW), 1.2), im.yy, im.xx))
bronze_band(im, ttl & ((im.yy == 34) | (im.yy == 43)))
# pole sylwetki: ciemna skóra z rzeźbionym krzyżem
DY0, DY1 = 47, 158
doll = (im.yy >= DY0) & (im.yy < DY1) & (im.xx >= 8) & (im.xx < PW - 8)
im.put(doll, ramp(LT, 2.2 + 1.2 * (hsh(im.xx // 3, im.yy // 3, 52) - 0.5) - 1.6 * (np.abs(im.xx - PW / 2) / (PW / 2)) ** 2, im.yy, im.xx))
cross = doll & (((np.abs(im.xx - PW / 2) < 26)) | ((im.yy > 78) & (im.yy < 124) & (np.abs(im.xx - PW / 2) < 62)))
im.put(cross, ramp(LT, np.full((PH, PW), 3.4) + 0.6 * (hsh(im.xx // 3, im.yy // 3, 53) - 0.5), im.yy, im.xx))
cedge = cross & ~ndi.binary_erosion(cross)
im.put(cedge, LT[5] * 1.0)
bronze_band(im, doll & ~ndi.binary_erosion(doll, iterations=2))
# sylwetka postaci (z klatki S x2, wypełnienie ciemne)
hs = hero9.hero('S', 0, 0, walking=False)
hsil = np.array(Image.fromarray(hs).resize((28 * 2, 42 * 2), Image.NEAREST))[..., 3] > 0
sx0, sy0 = PW // 2 - 28, DY0 + 18
for y in range(84):
    for x in range(56):
        if hsil[y, x] and 0 <= sy0 + y < PH:
            im.c[sy0 + y, sx0 + x] = (14, 11, 10); im.a[sy0 + y, sx0 + x] = True
# gniazda wyposażenia
EQS = {
    'helm': (PW // 2 - 9, DY0 + 4, 18, 18), 'amulet': (PW // 2 + 16, DY0 + 10, 14, 14), 'cape': (PW // 2 - 30, DY0 + 10, 14, 14),
    'chest': (PW // 2 - 11, DY0 + 26, 22, 26), 'belt': (PW // 2 - 11, DY0 + 55, 22, 10), 'legs': (PW // 2 - 9, DY0 + 68, 18, 20),
    'boots': (PW // 2 - 9, DY0 + 90, 18, 18), 'gloves': (PW // 2 - 38, DY0 + 38, 18, 18), 'shoulders': (PW // 2 + 20, DY0 + 30, 18, 18),
    'ring': (PW // 2 - 34, DY0 + 62, 14, 14), 'ring2': (PW // 2 + 20, DY0 + 62, 14, 14),
    'sword': (12, DY0 + 36, 22, 40), 'shield': (PW - 34, DY0 + 36, 22, 40),
}
for k, (x0, y0, w, h) in EQS.items():
    sl = (im.xx >= x0) & (im.xx < x0 + w) & (im.yy >= y0) & (im.yy < y0 + h)
    bez = sl & ~((im.xx > x0) & (im.xx < x0 + w - 1) & (im.yy > y0) & (im.yy < y0 + h - 1))
    im.put(sl, np.array([18, 15, 14], np.float32))
    im.put(bez, ramp(BR, 3.6 - 1.8 * ((im.xx - x0) / w + (im.yy - y0) / h), im.yy, im.xx))
meta['eq'] = EQS
# pasek statystyk (pergamin ciemny)
SY = DY1 + 3
stats = (im.yy >= SY) & (im.yy < SY + 30) & (im.xx >= 8) & (im.xx < PW - 8)
im.put(stats, ramp(LT, np.full((PH, PW), 3.0), im.yy, im.xx))
bronze_band(im, stats & ((im.yy == SY) | (im.yy == SY + 29)))
meta['stats'] = [8, SY, PW - 16, 30]
# plecak: 8x3 gniazd 17px
BY0 = SY + 34
bag_slots = []
for r_ in range(2):
    for c_ in range(8):
        x0, y0 = 10 + c_ * 17, BY0 + r_ * 17
        sl = (im.xx >= x0) & (im.xx < x0 + 16) & (im.yy >= y0) & (im.yy < y0 + 16)
        inn = sl & (im.xx > x0) & (im.yy > y0)
        im.put(sl, ST[3]); im.put(inn, ST[0])
        im.put(inn & ((im.xx == x0 + 1) | (im.yy == y0 + 1)), np.array([4, 3, 6], np.float32))
        bag_slots.append([x0, y0, 16])
meta['bag'] = bag_slots
# pasek złota
GY = BY0 + 2 * 17 + 2
gold = (im.yy >= GY) & (im.yy < GY + 9) & (im.xx >= 8) & (im.xx < PW - 8)
im.put(gold, ST[1]); bronze_band(im, gold & (im.yy == GY))
meta['gold'] = [8, GY, PW - 16, 9]
# rama zewnętrzna z brązu
fr = (im.xx < 3) | (im.yy < 3) | (im.xx >= PW - 3) | (im.yy >= PH - 3)
im.put(fr, ramp(BR, np.where((im.xx < 3) | (im.yy < 3), 4.6, 2.2), im.yy, im.xx))
for (x, y) in [(1, 1), (PW - 3, 1), (1, PH - 3), (PW - 3, PH - 3), (1, PH // 2), (PW - 3, PH // 2)]:
    rivet(im, x, y)
ivy(im, [(0, PH - 1), (3, PH - 30), (8, PH - 40)], 61)
ivy(im, [(PW - 1, 60), (PW - 4, 40), (PW - 10, 36)], 62)
im.save('inv_bg')
meta['inv'] = dict(w=PW, h=PH, title=[6, 34, PW - 12, 10], close=[PW - 14, 3, 11, 11])
# płomień latarni (2 klatki 7x9)
for k in range(2):
    im = Img(7, 9)
    fl = hexs(['#ff7a1a', '#ffb43a', '#ffe48a', '#fff8d8'])
    sh = [(3, 1), (2, 2), (3, 2), (4, 2), (2, 3), (3, 3), (4, 3), (1, 4), (2, 4), (3, 4), (4, 4), (5, 4), (2, 5), (3, 5), (4, 5), (3, 6)]
    for (x, y) in sh:
        x2 = x + (1 if (k and y < 3) else 0)
        lvl = 0 if (x in (1, 5) or y < 2) else (1 if y < 4 else (2 if x != 3 else 3))
        im.c[y + 1, x2] = fl[lvl]; im.a[y + 1, x2] = True
    im.save(f'flame{k}')
json.dump(meta, open(f'{OUT}/ui2.json', 'w'))
Image.fromarray(hero9.portrait()).save(f'{OUT}/portrait.png')
print('ok')
