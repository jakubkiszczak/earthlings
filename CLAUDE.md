# Instrukcje dla Claude Code – Earthlings (nazwa robocza)

## O projekcie
Kooperacyjne MMORPG w przeglądarce, izometria pixel art. Pełny opis gry: `docs/GDD_*.docx` (wersja online w claude.ai). Rozmawiamy po polsku.

## Zasady grafiki (nie łamać)
- Jedna siatka pikseli: kafel 64×32 (izometria 2:1), poziom terenu co 24 px, postać 28×42 z kotwicą w środku stóp (14, 41), ikony 14×14.
- Skalowanie tylko całkowite (x2, x3, x4), filtrowanie nearest, `roundPixels`.
- Paleta i światło z lewej-góry jak w `tools/scene.py` i `tools/ui2.py`. Teksty w interfejsie pisane kodem (font Jersey 15), nigdy wtopione w grafiki.
- Nie kopiujemy cudzej szaty graficznej (np. Diablo, ArcoMage) – tylko ogólne wzorce układu.

## Potok budowania
1. `python tools/ui2.py` – grafiki HUD → `assets/generated/ui2/`
2. `python tools/export_live.py` – świat → `assets/generated/` (pasma głębi terenu, atlas, pick map, walk grid, woda)
3. `python tools/build.py` – składa `dist/index.html`
Po każdej zmianie: zbuduj, uruchom test w przeglądarce (Playwright), sprawdź zrzut ekranu i brak błędów w konsoli.

## Najbliższe zadania (etap 1 → MVP)
1. Przenieść klienta na TypeScript + Vite; grafiki ładowane jako osobne pliki zamiast osadzonych base64.
2. Rozbić `game.js` na moduły: renderer, świat, postać, kamera, wejście, HUD.
3. Potwory i walka (serwer autorytatywny później – na razie logika w osobnym module, łatwa do przeniesienia).
4. Portale i kolejne sekcje mapy 3×3, miasto z karczmą i warsztatem.
5. Serwer: Node.js + Colyseus, PostgreSQL, Redis (patrz GDD: Technologia, Infrastruktura, Bezpieczeństwo).

## Skille
Zainstalowane z `gamedev-skills/awesome-gamedev-agent-skills`: używaj ich przy assetach, PixiJS, systemach RPG, shaderach, kamerze i projektowaniu poziomów.
