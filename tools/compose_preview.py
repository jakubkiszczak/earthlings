"""Reference compositor: the ground truth for the in-game CharacterSprite.

Usage:
  python tools/compose_preview.py [--female] [--race human|elf] [--hair STYLE] [--hair-color C]
                                  [--beard STYLE] [--beard-color C] [--no-helmet] [--out FILE]
  default: human male, hair "short", brown, no beard, with helmet
  -> docs/preview/compose_check.png (or compose_check_female.png / --out)

Draw order per frame (items.json -> draw_order; rule: the sword is ALWAYS drawn over the shield):
   1. hair_back
   2. shield  if z.shield == behind
   3. weapon  if z.weapon == behind
   4. body (appearance/body: human or elf, bald) -> boots -> beard -> hair_front -> elf ears
   5. helmet (hidden in frame 14)
   6. shield  if z.shield == front
   7. weapon  if z.weapon == front
   8. if weapon is behind and shield is front: draw the weapon again,
      clipped to the shield's pixels (so it shows over the shield but stays behind the body)
Hair and beard PNGs are recoloured with appearance/palettes.json (exact RGB swap, alpha kept).
"""
import json, sys
from PIL import Image, ImageChops
S = 'assets/art/sprites/'
reg = json.load(open(S + 'items.json'))
D = reg['directions']
AP = reg['appearance']
args = sys.argv[1:]
def opt(name, default):
    return args[args.index(name) + 1] if name in args else default
female = '--female' in args
gender = 'female' if female else 'male'
dflt = AP['defaults'][gender]
race = opt('--race', 'human')
hair = opt('--hair', dflt['hair'])
hair_color = opt('--hair-color', dflt['hair_color'])
beard = opt('--beard', 'none') if gender == 'male' and race == 'human' else 'none'
beard_color = opt('--beard-color', hair_color)
helm = '--no-helmet' not in args
assert hair in AP['hair_styles'][gender], f'hair must be one of {AP["hair_styles"][gender]}'
assert beard in AP['beard_styles'][gender], f'beard must be one of {AP["beard_styles"][gender]}'
body_key = 'body_female' if female else 'body'

PAL = json.load(open(S + AP['palettes']))
hx = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
BASE = [hx(c) for c in PAL['base']]
def recolor(im, name):
    m = {b: hx(c) for b, c in zip(BASE, PAL['palettes'][name])}
    im = im.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and p[:3] in m: px[x, y] = m[p[:3]] + (p[3],)
    return im
F = AP['files']
def path(key, d, **kw):
    return S + F[key].format(race=race, gender=gender, dir=d, sheet='anim', hair=hair, beard=beard, **kw)

def rot(spr, pv, ang):
    W = max(spr.size) * 3
    c = Image.new('RGBA', (W, W), (0, 0, 0, 0)); c.alpha_composite(spr, (W // 2 - pv[0], W // 2 - pv[1]))
    return c.rotate(-ang, resample=Image.NEAREST, center=(W // 2, W // 2)), (W // 2, W // 2)
def layer(img, pos, size=(82, 93)):
    l = Image.new('RGBA', size, (0, 0, 0, 0)); l.alpha_composite(img, pos) if pos[0] >= 0 and pos[1] >= 0 else l.paste(img, pos, img); return l
sword = Image.open(S + 'sword_short.png')
cache = {}
def sheets(d):
    if d not in cache:
        back = recolor(Image.open(path('hair_back', d)), hair_color)
        front = recolor(Image.open(path('hair_front', d)), hair_color)
        mid = [Image.open(path('body', d)).convert('RGBA'), Image.open(S + f'boots_leather_{d}.png').convert('RGBA')]
        if beard != 'none': mid.append(recolor(Image.open(path('beard', d)), beard_color))
        mid.append(front)
        if race == 'elf': mid.append(Image.open(path('elf_ears', d)).convert('RGBA'))
        cache[d] = (back, mid)
    return cache[d]
def frame(d, i):
    B = reg[body_key]
    A = json.load(open(S + B['anchors'][d]))
    items = json.load(open(S + f'human_base_{d}_anchors.json'))['items']
    f = A['frames'][i]; sh_off = items[f'shield_round_{d}.png']['center_offset_from_hand_l']
    back, mid = sheets(d)
    shield = Image.open(S + f'shield_round_{d}.png'); helmet = Image.open(S + f'helmet_spangen_{d}.png')
    c = Image.new('RGBA', (82, 93), (0, 0, 0, 0)); ox, oy = 20, 20
    sw, pv = rot(sword, (4, 3), f['hand_r']['angle'])
    W = layer(sw, (f['hand_r']['x'] + ox - pv[0], f['hand_r']['y'] + oy - pv[1]))
    SH = layer(shield, (f['hand_l']['x'] + ox + sh_off[0] - shield.width // 2, f['hand_l']['y'] + oy + sh_off[1] - shield.height // 2))
    zw, zs = f['z']['weapon'], f['z']['shield']
    c.alpha_composite(back.crop((42 * i, 0, 42 * i + 42, 63)), (ox, oy))
    if zs == 'behind': c.alpha_composite(SH)
    if zw == 'behind': c.alpha_composite(W)
    for p in mid: c.alpha_composite(p.crop((42 * i, 0, 42 * i + 42, 63)), (ox, oy))
    if helm and i != 14:
        hm, hp = rot(helmet, (15, 8), f['head']['angle']); c.alpha_composite(hm, (f['head']['x'] + ox - hp[0], f['head']['y'] + oy - hp[1]))
    if zs == 'front': c.alpha_composite(SH)
    if zw == 'front': c.alpha_composite(W)
    if zw == 'behind' and zs == 'front':   # sword over shield, still behind body
        clip = W.copy(); clip.putalpha(ImageChops.multiply(W.getchannel('A'), SH.getchannel('A')))
        c.alpha_composite(clip)
    return c
G = Image.new('RGBA', (82 * 15, 93 * len(D)), (46, 72, 44, 255))
for r, d in enumerate(D):
    for i in range(15): G.alpha_composite(frame(d, i), (82 * i, 93 * r))
out = opt('--out', 'docs/preview/compose_check' + ('_female' if female else '') + '.png')
G.save(out); print(out, race, gender, hair, hair_color, beard)
