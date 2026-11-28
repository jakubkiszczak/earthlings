# Instrukcje dla Claude Code – Glastemia

## O projekcie
Kooperacyjne MMORPG w przeglądarce, izometria pixel art. Pełny opis gry: `docs/GDD_*.docx` (tylko lokalnie, poza repozytorium; wersja online w claude.ai). Rozmawiamy po polsku.

## Zasady grafiki (nie łamać)
- Jedna siatka pikseli: kafel 64×32 (izometria 2:1), poziom terenu co 24 px, postać 42×63 (rysowana w skali 1,5 względem dawnych 28×42, twarz i detale w pełnej rozdzielczości) z kotwicą w środku stóp (21, 62), ikony 14×14.
- Skalowanie tylko całkowite (x2, x3, x4), filtrowanie nearest, `roundPixels`.
- Paleta i światło z lewej-góry jak w `tools/scene.py` i `tools/ui2.py`. Teksty w interfejsie pisane kodem (font Jersey 15), nigdy wtopione w grafiki.
- Nie kopiujemy cudzej szaty graficznej (np. Diablo, ArcoMage) – tylko ogólne wzorce układu.

## Potok budowania
- Klient: TypeScript + Vite + PixiJS 8 (`src/`). Grafiki z `assets/` serwowane jako osobne pliki (publicDir), ścieżki przez `assetUrl()`.
- `npm run dev` – podgląd na żywo; `npm run build` – `dist/` (sprawdza typy); `npm test` – Vitest (`tests/`); `npm run test:e2e` – Playwright (`e2e/`).
- Grafiki (Python, środowisko `.venv`): `.venv/bin/python tools/ui2.py` → `assets/generated/ui2/`; `.venv/bin/python tools/worldgen.py [cx,cy ...]` → `assets/generated/world/` (świat 3×3, komórka 40×40 kafli + margines 128 tekseli; miasto w 1,1).
- Obrót widoku co 90° (klawisze `,` `.`): generator rysuje każdą komórkę z 4 stron (`ground_rN.webp`, `bands_rN`, `pick_rN`, `water_*_rN`, `meta_rN.json`; `walk.png` wspólny). Logika gry zawsze w układzie świata (u, v); rzut, zIndex i kierunek postaci przez `src/world/view.ts` (zgodny z `rot_pt` w `tools/worldgen.py`, test `tests/view.test.ts`). Mapa wyboru zawsze w układzie świata. Wnętrza tylko widok 0. Obiekty kierunkowe (stragany, szyldy, most) mają warianty na każdy widok.
- Budynki miasta w skali postaci 42×63: wysokości ×1,5 (`BLD_HS`, drzwi `DOOR_H`, okna, piętro muru pruskiego co 60) w `tools/worldgen.py` / `tools/terrain.py`; `MAXH` = zapas wysokości obrazu.
- Przejścia: wejście do budynku odkłada komórki świata (ukryte, nie zwalniane) – wyjście bez wczytywania; przejście do wczytanego sąsiada bez ekranu wczytywania; obrót widoku – przenikanie zdjęcia starego widoku, pozostałe widoki bieżącej komórki pobierane w tle (`World.prefetchViews`). Ekran wczytywania tylko, gdy cel nie jest w pamięci.
- Świat w grze: w pamięci tylko bieżąca komórka (`src/world/world.ts`), przejście przez krawędź wczytuje sąsiada (`src/logic/cells.ts`). Teren = `ground.webp` pod wszystkim + `bands.webp` (pasma głębi tylko dla murów, klifów i dachów).
- Publikacja: push do `main` → GitHub Actions (`.github/workflows/pages.yml`) testuje i wystawia GitHub Pages.
- Node i gh są w `~/.local` (ścieżka w `~/.zprofile`).
Po każdej zmianie: `npm run build`, `npm test`, `npm run test:e2e` (zrzut w `test-results/smoke.png`, brak błędów w konsoli).

## Postacie i menu
- Postać gracza: paper doll z paczki grafik (`src/chars/paperdoll.ts` – składanie klatek identyczne co do piksela z `tools/compose_preview.py`, także rasa, fryzura, broda i kolory z palet; `src/chars/doll.ts` – wczytanie (wspólne pliki na starcie, warstwy wyglądu przez `prepareLook`) i arkusz `PlayerSheet`, 8 kierunków bez odbić). Wygląd w `Look` (`src/logic/character.ts`): płeć, kolor skóry (`warm` = tony człowieka, `fair` = tony elfa; zamiana tylko w miejscach skóry wg ciała elfa), fryzura, kolor włosów, broda (tylko człowiek-mężczyzna), kolor brody; stare zapisy migruje `normalizeLook`. Łuk: dwuręczny, klatki `hero_<DIR>_shoot0..3` z arkuszy `*_shoot`, poza strzałem przewieszony przez plecy. Strona testowa: `dev/character-test.html` (`npm run dev`).
- Wygląd NPC i potworów rysowany w przeglądarce: `src/chars/chargen.ts` (rasa, klasa, budowa, włosy, broda; 5 kierunków + lustro) → `CharSheet` (`src/chars/sheet.ts`). NPC (kupiec, mieszkańcy, strażnicy) też z generatora; obiekty świata z atlasu `sprites.png`.
- Grafiki malowane (AI, opis w `assets/art/README.md`): `assets/art/` + `assets/art/manifest.json` (`assets[].path`, czyta `src/ui/art.ts`). `avatars/<rasa>_<klasa>_<płeć>_96.png` zastępuje portret z kodu w HUD, wyborze postaci i kreatorze; `loading/loading_dragon_480x270.png` – ekran wczytywania. Oryginały i wersje ×4 tylko lokalnie w `art_source/` (poza repo). Nowy plik dopisz do manifestu.
- Menu (`src/ui/menu.ts`): start → wybór (do 3 postaci) → kreator. Logika i zapis: `src/logic/character.ts`, `src/logic/save.ts` (localStorage `earthlings.saves`, wersja 1).
- Testy w przeglądarce wchodzą do gry przez `enterGame()` z `e2e/helpers.ts`.

## Walka
- Logika: `src/logic/combat.ts` (statystyki potworów, AI, obrażenia, umiejętności, exp) – czysta, testy w `tests/combat.test.ts`.
- Gra: `src/game/mobs.ts` (30 potworów na komórkę poza miastem, deterministyczne rozmieszczenie, widoki), `src/game/combat.ts` (cel, auto-atak, strzały, umiejętności, śmierć).
- Start: wojownik – Krótki miecz (+10 obrażeń), łowca – Krótki łuk (+10) i 200 strzał. Łowca strzela (atak i umiejętności) tylko z łukiem; bez łuku walczy wręcz pięściami (`Combat.ranged`). Po najechaniu na potwora: nazwa, HP liczbowo i pasek.
- Współrzędne potworów są globalne (teksele świata); `World.toScreenGlobal/walkableGlobal` przeliczają na bieżącą komórkę.
- Grafika potworów: szkielet i zombie z `chargen.ts` (`kind`), wilk z `wolfgen.ts`.

## Przedmioty i ekwipunek
- Logika: `src/logic/items.ts` (20 przedmiotów, łup, statystyki z ekwipunku) – testy `tests/items.test.ts`.
- Gra: `src/game/inventory.ts` (ekwipunek, punkty, mikstury → widok panelu HUD), `src/game/loot.ts` (łup na ziemi).
- Widoczny ekwipunek: `Gear` w `chargen.ts` (zbroja, hełm, tarcza, broń, buty, rękawice); po zmianie ekwipunku powstaje nowy `CharSheet`.

## Sklep
- Logika: `src/logic/shop.ts` (oferta, kupno, skup 25%) – testy `tests/shop.test.ts`; okno: `src/ui/shop.ts`; kupiec: kliknięcie NPC we wnętrzu sklepu (`src/main.ts`).

## Najbliższe zadania: prototyp v0.1
Zakres, liczby i etapy: `docs/PLAN_PROTOTYPU.md` (gra solo, zapis w `localStorage`, link na GitHub Pages).
Logika gry w `src/logic/` bez zależności od grafiki – w etapie 2 przenosimy ją na serwer (Node.js + Colyseus, PostgreSQL, Redis; patrz GDD).

## Skille
Zainstalowane z `gamedev-skills/awesome-gamedev-agent-skills`: używaj ich przy assetach, PixiJS, systemach RPG, shaderach, kamerze i projektowaniu poziomów.

## Grafika 2D
- Grafiki: assets/art/ (start: START_HERE.md, metadane: assets/art/manifest.json).
- Postać gracza: docs/CHARACTER_SPEC.md + assets/art/sprites/items.json. Wzorzec: tools/compose_preview.py.
- Pixel art: skala całkowita, nearest, roundPixels. Nie odbijać sprite'ów (tarcza zawsze w lewej ręce).
- Miecz zawsze rysowany przed tarczą (kopia miecza z maską tarczy, gdy miecz jest za ciałem).
- Wygląd (rasa, fryzura, broda, kolory): items.json → appearance; kolory włosów i brody przez zamianę palety przy ładowaniu.
- Nie zmieniać grafik ani JSON-ów w assets/art/ bez zgody. Nowe assety dopisywać do manifest.json.
- Teksty UI zawsze kodem (Jersey 15), nigdy w bitmapach.
