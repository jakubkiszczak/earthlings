import base64, json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
D = str(ROOT / 'assets' / 'generated')
SRC = str(ROOT / 'src')
pixi = open(ROOT / 'vendor' / 'pixi.min.js').read()
meta = open(f'{D}/meta.json').read()
imgs = {k: 'data:image/png;base64,' + base64.b64encode(open(f'{D}/{k}.png', 'rb').read()).decode()
        for k in ['bands', 'sprites', 'water_a', 'water_b', 'walk', 'pick']}
game = open(f'{SRC}/game.js').read()
hud = open(f'{SRC}/hud2.js').read()
B64 = lambda path, mt='image/png': f'data:{mt};base64,' + base64.b64encode(open(path, 'rb').read()).decode()
UB = str(ROOT / 'assets' / 'legacy_ui')
ui = {k: B64(f'{UB}/ui_{k}.png') for k in ['frame', 'frame_plain', 'slot', 'slot_hi', 'btn', 'btn_hover', 'btn_down']}
import glob, os
for f in glob.glob(f'{UB}/icon_*.png'):
    ui[os.path.basename(f)[:-4]] = B64(f)
ui['portrait'] = B64(f'{D}/portrait.png'); ui['doll'] = B64(f'{D}/doll6.png')
FD = str(ROOT / 'assets' / 'fonts')
fl = f'{FD}/jersey-15-latin-400-normal.woff2'
fe = f'{FD}/jersey-15-latin-ext-400-normal.woff2'
import json as _j
ui2 = {os.path.basename(f)[:-4]: B64(f) for f in glob.glob(f'{D}/ui2/*.png')}
ui2meta = open(f'{D}/ui2/ui2.json').read()
css = open(f'{SRC}/hud2.css').read().replace('URL_PANEL9', ui2['panel9']).replace('URL_FRAME', ui['frame']).replace('URL_PLAIN', ui['frame_plain']).replace('URL_SLOTHI', ui['slot_hi']).replace('URL_SLOT', ui['slot']).replace('URL_BTNH', ui['btn_hover']).replace('URL_BTND', ui['btn_down']).replace('URL_BTN', ui['btn'])
css = css.replace('FONT_LATIN', B64(fl, 'font/woff2')).replace('FONT_EXT', B64(fe, 'font/woff2'))
html = f'''<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Earthlings – prototyp</title>
<style>
html, body {{ margin: 0; height: 100%; background: #0b1a12; overflow: hidden; }}
canvas {{ display: block; image-rendering: pixelated; }}
{css}
#hint {{ position: fixed; left: 50%; transform: translateX(-50%); top: 36px; z-index: 2; font: 600 14px/1.4 system-ui, sans-serif; color: #f2ead8;
  background: rgba(10, 14, 12, .72); padding: 8px 12px; border-radius: 6px; pointer-events: none; }}
</style>
</head>
<body>
<div id="hint">Przytrzymaj mysz, aby iść · 1–8 umiejętności · I ekwipunek · C czat · kółko: przybliżenie</div>
<div id="hud"></div>
<script>{pixi}</script>
<script>
const META = {meta};
const IMG = {json.dumps(imgs)};
const UIIMG = {json.dumps(ui)};
const UI2 = {json.dumps(ui2)};
const UI2META = {ui2meta};
{hud}
{game}
</script>
</body>
</html>'''
open(ROOT / 'dist' / 'index.html', 'w').write(html)
print(len(html) / 1e6, 'MB')
