# Earthlings (nazwa robocza) – kooperacyjne web MMORPG (prototyp)

Prototyp przeglądarkowej gry RPG w izometrii pixel art: jedna sekcja świata, postać w 8 kierunkach, ruch kliknięciem lub przytrzymaniem myszy, animowana woda i roślinność, pełny HUD (kule HP i many, umiejętności, ekwipunek, czat).

Dokumentacja gry (GDD) jest w `docs/` oraz online: https://claude.ai/artifact/APXQzj8QDGDQaEECgXk1Dn

## Struktura

| Folder | Zawartość |
| --- | --- |
| `src/` | kod gry w przeglądarce: `game.js` (silnik PixiJS 8: teren, postać, kamera, woda), `hud2.js` i `hud2.css` (interfejs) |
| `tools/` | generatory w Pythonie: świat (`scene.py`, `compose.py`), eksport do gry (`export_live.py`), postać (`hero9.py`), grafiki interfejsu (`ui2.py`), składanie strony (`build.py`) |
| `assets/generated/` | wygenerowane dane gry: pasma terenu, atlas sprite'ów, mapa kliknięć, siatka chodzenia, dane wody, grafiki HUD (`ui2/`) |
| `assets/legacy_ui/` | ikony 14×14 i ramki z wcześniejszego generatora (używane przez HUD) |
| `assets/fonts/` | font Jersey 15 (licencja SIL OFL) |
| `vendor/` | PixiJS 8.23 (`pixi.min.js`) |
| `dist/` | gotowa, grywalna strona `index.html` (jeden plik) |
| `docs/` | dokumentacja (Word), kadr testowy, arkusz postaci |

## Wymagania

- Python 3.11+ i pakiety z `tools/requirements.txt`
- Do testów automatycznych: Node.js 20+ (opcjonalnie)

## Uruchomienie

```bash
python -m pip install -r tools/requirements.txt

# 1. (opcjonalnie) wygeneruj grafiki interfejsu
python tools/ui2.py
# 2. wygeneruj świat i dane gry (ok. 30–60 s)
python tools/export_live.py
# 3. złóż grywalną stronę
python tools/build.py
# 4. otwórz dist/index.html w przeglądarce
```

Sterowanie: przytrzymaj lub kliknij mysz, aby iść · 1–8 umiejętności · I ekwipunek · C czat · Enter pisanie · kółko myszy przybliżenie.

## Licencje i źródła

- Teren, rośliny, woda, wieża, interfejs i postać: wygenerowane kodem w tym repozytorium.
- Font Jersey 15: SIL Open Font License (`assets/fonts/OFL-Jersey15.txt`).
- PixiJS: licencja MIT.
