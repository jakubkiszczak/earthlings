# Instrukcje dla Claude Code – Earthlings (nazwa robocza)

## O projekcie
Kooperacyjne MMORPG w przeglądarce, izometria pixel art. Pełny opis gry: `docs/GDD_*.docx` (tylko lokalnie, poza repozytorium; wersja online w claude.ai). Rozmawiamy po polsku.

## Zasady grafiki (nie łamać)
- Jedna siatka pikseli: kafel 64×32 (izometria 2:1), poziom terenu co 24 px, postać 28×42 z kotwicą w środku stóp (14, 41), ikony 14×14.
- Skalowanie tylko całkowite (x2, x3, x4), filtrowanie nearest, `roundPixels`.
- Paleta i światło z lewej-góry jak w `tools/scene.py` i `tools/ui2.py`. Teksty w interfejsie pisane kodem (font Jersey 15), nigdy wtopione w grafiki.
- Nie kopiujemy cudzej szaty graficznej (np. Diablo, ArcoMage) – tylko ogólne wzorce układu.

## Potok budowania
- Klient: TypeScript + Vite + PixiJS 8 (`src/`). Grafiki z `assets/` serwowane jako osobne pliki (publicDir), ścieżki przez `assetUrl()`.
- `npm run dev` – podgląd na żywo; `npm run build` – `dist/` (sprawdza typy); `npm test` – Vitest (`tests/`); `npm run test:e2e` – Playwright (`e2e/`).
- Grafiki (Python, środowisko `.venv`): `.venv/bin/python tools/ui2.py` → `assets/generated/ui2/`; `.venv/bin/python tools/worldgen.py [cx,cy ...]` → `assets/generated/world/` (świat 3×3, komórka 40×40 kafli + margines 128 tekseli; miasto w 1,1).
- Świat w grze: w pamięci tylko bieżąca komórka (`src/world/world.ts`), przejście przez krawędź wczytuje sąsiada (`src/logic/cells.ts`). Teren = `ground.webp` pod wszystkim + `bands.webp` (pasma głębi tylko dla murów, klifów i dachów).
- Publikacja: push do `main` → GitHub Actions (`.github/workflows/pages.yml`) testuje i wystawia GitHub Pages.
- Node i gh są w `~/.local` (ścieżka w `~/.zprofile`).
Po każdej zmianie: `npm run build`, `npm test`, `npm run test:e2e` (zrzut w `test-results/smoke.png`, brak błędów w konsoli).

## Najbliższe zadania: prototyp v0.1
Zakres, liczby i etapy: `docs/PLAN_PROTOTYPU.md` (gra solo, zapis w `localStorage`, link na GitHub Pages).
Logika gry w `src/logic/` bez zależności od grafiki – w etapie 2 przenosimy ją na serwer (Node.js + Colyseus, PostgreSQL, Redis; patrz GDD).

## Skille
Zainstalowane z `gamedev-skills/awesome-gamedev-agent-skills`: używaj ich przy assetach, PixiJS, systemach RPG, shaderach, kamerze i projektowaniu poziomów.
