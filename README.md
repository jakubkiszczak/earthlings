# Earthlings (nazwa robocza) – kooperacyjne web MMORPG (prototyp)

Prototyp przeglądarkowej gry RPG w izometrii pixel art: jedna sekcja świata, postać w 8 kierunkach, ruch kliknięciem lub przytrzymaniem myszy, animowana woda i roślinność, pełny HUD (kule HP i many, umiejętności, ekwipunek, czat).

Plan prototypu: [`docs/PLAN_PROTOTYPU.md`](docs/PLAN_PROTOTYPU.md).

## Struktura

| Folder | Zawartość |
| --- | --- |
| `src/` | klient gry (TypeScript + PixiJS 8): `main.ts` (start i pętla), `assets.ts`, `camera.ts`, `input.ts`, `world/` (siatka, teren), `render/` (atlas, woda, chmury, efekty), `entities/` (postacie), `logic/` (czysta logika gry, np. wyszukiwanie drogi), `ui/` (HUD) |
| `tests/` | testy logiki (Vitest) |
| `e2e/` | test w przeglądarce (Playwright) |
| `tools/` | generatory grafiki w Pythonie: świat 3×3 (`worldgen.py` + renderer terenu `terrain.py`, sprite'y `props.py`, narzędzia `pixelkit.py`), postać (`hero9.py`), grafiki interfejsu (`ui2.py`) |
| `assets/` | pliki kopiowane do gry bez zmian: `generated/world/` (świat: `world.json`, `sprites.png` i katalog na każdą komórkę `cXY/`), `generated/ui2/` (HUD), `legacy_ui/` (ikony 14×14), `fonts/` (Jersey 15) |
| `docs/` | plan prototypu, kadr testowy (GDD w Wordzie trzymany tylko lokalnie) |
| `.github/workflows/` | testy i publikacja na GitHub Pages po każdym pushu do `main` |

## Wymagania

- Node.js 20+ (gra, testy, budowanie)
- Python 3.11+ i pakiety z `tools/requirements.txt` (tylko do generowania grafik)

## Uruchomienie

```bash
npm install
npm run dev          # gra na http://localhost:5173 z przeładowaniem na żywo
npm test             # testy logiki
npm run build        # gotowa strona w dist/
npm run test:e2e     # test w przeglądarce (najpierw: npx playwright install chromium)
```

Ponowne wygenerowanie grafik (opcjonalnie):

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
.venv/bin/python tools/ui2.py          # grafiki HUD → assets/generated/ui2/
.venv/bin/python tools/worldgen.py     # świat 3×3 → assets/generated/world/ (ok. 5 min)
.venv/bin/python tools/worldgen.py 1,1 # tylko wybrana komórka (miasto)
```

Sterowanie: przytrzymaj lub kliknij mysz, aby iść · 1–8 umiejętności · I ekwipunek · C czat · Enter pisanie · kółko myszy przybliżenie. Wyjście za krawędź komórki przenosi do sąsiedniej (minimapa w prawym górnym rogu).

## Licencje i źródła

- Teren, rośliny, woda, wieża, interfejs i postać: wygenerowane kodem w tym repozytorium.
- Font Jersey 15: SIL Open Font License (`assets/fonts/OFL-Jersey15.txt`).
- PixiJS: licencja MIT (pakiet npm `pixi.js`).
