# Glastemia: paczka grafik i podmiana postaci

## Jak użyć
1. Rozpakuj `glastemia_art.zip` do katalogu głównego repozytorium gry. Powstaną foldery `assets/art/`, `docs/` i `tools/` oraz ten plik.
2. Fragment z sekcji „Wklej do CLAUDE.md” (na dole tego pliku) dopisz do pliku `CLAUDE.md` projektu.
3. Uruchom Claude Code w katalogu repozytorium i wklej prompt z `docs/CLAUDE_CODE_PROMPT.md`, czyli cały blok kodu.
4. Claude Code najpierw pokaże plan podmiany, a potem wdroży nową postać, stronę testową i testy.

## Co jest w paczce
| Ścieżka | Zawartość |
|---|---|
| `assets/art/sprites/` | Postać gracza: mężczyzna (`human_base_*`, `human_hair_*`) i kobieta (`human_female_*`), 8 kierunków × 15 klatek; wyposażenie: `sword_short.png`, `shield_round_*`, `helmet_spangen_*`, `boots_leather_*`; rejestr przedmiotów `items.json`; punkty zaczepienia `*_anchors.json` |
| `docs/CHARACTER_SPEC.md` | Specyfikacja: siatka, animacje, warstwy, kolejność rysowania, zasada „miecz przed tarczą” |
| `docs/CLAUDE_CODE_PROMPT.md` | Gotowy prompt do Claude Code |
| `docs/preview/` | Zatwierdzone podglądy: siatki 8×15 dla mężczyzny i kobiety, animacje chodu, wzorce do porównania |
| `tools/compose_preview.py` | Wzorzec składania postaci (`python tools/compose_preview.py [--female]`); wynik w grze ma być identyczny |
| `assets/art/logo/` | Logo: herb, układ poziomy i pionowy (natywnie, x4, x8) |
| `assets/art/marketing/` | Logo 1024×1024 (awatar, napis, herb), baner Patreon 2560×640 |
| `assets/art/loading/` | Ekran wczytywania (480×270 natywnie, 1920×1080) |
| `assets/art/avatars/` | Awatary 96×96 i x4 |
| `assets/art/variants_draft/` | Próby tylko dla mężczyzny w kierunku SE: krótkie włosy, elf (uszy, włosy, ciało). Jeszcze nie do wdrożenia |
| `assets/art/legacy/`, `assets/art/source/` | Stare wersje i oryginały z generatora. Nie używać w grze |
| `assets/art/manifest.json` | Metadane każdego pliku: rola, rozmiar, źródło, skrót sha256 |

## Zasady
- Pixel art: tylko skala całkowita, filtr `nearest`, `roundPixels`.
- Nie odbijać sprite'ów lustrzanie, bo tarcza zawsze jest w lewej ręce.
- Teksty w interfejsie zawsze rysować kodem, nigdy w bitmapach.
- Część grafik pochodzi z AI (CellCog), co widać w `source.kind` w `manifest.json`. Trzeba to zgłosić przy publikacji, np. w Steam Content Survey.

## Wklej do CLAUDE.md
```
## Grafika 2D
- Grafiki: assets/art/ (start: START_HERE.md, metadane: assets/art/manifest.json).
- Postać gracza: docs/CHARACTER_SPEC.md + assets/art/sprites/items.json. Wzorzec: tools/compose_preview.py.
- Pixel art: skala całkowita, nearest, roundPixels. Nie odbijać sprite'ów (tarcza zawsze w lewej ręce).
- Miecz zawsze rysowany przed tarczą (kopia miecza z maską tarczy, gdy miecz jest za ciałem).
- Nie zmieniać grafik ani JSON-ów w assets/art/ bez zgody. Nowe assety dopisywać do manifest.json.
- Teksty UI zawsze kodem (Jersey 15), nigdy w bitmapach.
```
