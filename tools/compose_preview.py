"""Reference compositor: the ground truth for the in-game CharacterSprite.
Usage: python tools/compose_preview.py [--female] [--no-helmet]
  -> docs/preview/compose_check.png (or compose_check_female.png)

Draw order per frame (rule: the sword is ALWAYS drawn over the shield):
  1. shield  if z.shield == behind
  2. weapon  if z.weapon == behind
  3. body_nohair -> boots -> hair -> helmet (helmet hidden in frame 14)
  4. shield  if z.shield == front
  5. weapon  if z.weapon == front
  6. if weapon is behind and shield is front: draw the weapon again,
     clipped to the shield's pixels (so it shows over the shield but stays behind the body)
"""
import json, sys
from PIL import Image, ImageChops
S = 'assets/art/sprites/'
reg = json.load(open(S + 'items.json'))
D = reg['directions']
helm = '--no-helmet' not in sys.argv
female = '--female' in sys.argv
body_key = 'body_female' if female else 'body'
def rot(spr, pv, ang):
    W = max(spr.size) * 3
    c = Image.new('RGBA', (W, W), (0, 0, 0, 0)); c.alpha_composite(spr, (W // 2 - pv[0], W // 2 - pv[1]))
    return c.rotate(-ang, resample=Image.NEAREST, center=(W // 2, W // 2)), (W // 2, W // 2)
def layer(img, pos, size=(82, 93)):
    l = Image.new('RGBA', size, (0, 0, 0, 0)); l.alpha_composite(img, pos) if pos[0] >= 0 and pos[1] >= 0 else l.paste(img, pos, img); return l
sword = Image.open(S + 'sword_short.png')
def frame(d, i):
    B = reg[body_key]
    A = json.load(open(S + B['anchors'][d]))
    items = json.load(open(S + f'human_base_{d}_anchors.json'))['items']
    f = A['frames'][i]; sh_off = items[f'shield_round_{d}.png']['center_offset_from_hand_l']
    parts = [Image.open(S + B['nohair'][d]), Image.open(S + f'boots_leather_{d}.png')]
    if B.get('hair'): parts.append(Image.open(S + B['hair'][d]))
    shield = Image.open(S + f'shield_round_{d}.png'); helmet = Image.open(S + f'helmet_spangen_{d}.png')
    c = Image.new('RGBA', (82, 93), (0, 0, 0, 0)); ox, oy = 20, 20
    sw, pv = rot(sword, (4, 3), f['hand_r']['angle'])
    W = layer(sw, (f['hand_r']['x'] + ox - pv[0], f['hand_r']['y'] + oy - pv[1]))
    SH = layer(shield, (f['hand_l']['x'] + ox + sh_off[0] - shield.width // 2, f['hand_l']['y'] + oy + sh_off[1] - shield.height // 2))
    zw, zs = f['z']['weapon'], f['z']['shield']
    if zs == 'behind': c.alpha_composite(SH)
    if zw == 'behind': c.alpha_composite(W)
    for p in parts: c.alpha_composite(p.crop((42 * i, 0, 42 * i + 42, 63)), (ox, oy))
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
out = 'docs/preview/compose_check' + ('_female' if female else '') + '.png'
G.save(out); print(out)
