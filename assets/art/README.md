# Glastemia – paczka grafik (ekran wczytywania + awatary)

Rozpakuj do katalogu głównego projektu gry (tego samego co `wieza-online`), tak aby powstał folder `assets/art/`.

## Zawartość

| Ścieżka | Co to jest | Rozmiar |
|---|---|---|
| `assets/art/loading/loading_dragon_480x270.png` | Ekran wczytywania w natywnej siatce gry, z herbem B | 480×270 |
| `assets/art/loading/loading_dragon_1920x1080.png` | To samo ×4 (nearest) | 1920×1080 |
| `assets/art/avatars/<postać>_96.png` | Awatar w natywnej siatce | 96×96 |
| `assets/art/avatars/<postać>_96x4.png` | Awatar ×4 (nearest) do UI | 384×384 |
| `assets/art/source/*_ai_original.png` | Oryginały z generatora (do ponownej obróbki) | 2048 / 2560 |
| `assets/art/manifest.json` | Rola, rozmiar, źródło, skrót sha256 każdego pliku | – |

Postacie: `elf_warrior`, `elf_hunter`, `human_warrior`, `human_hunter`.

## Zasady użycia w silniku (PixiJS)

- Skalowanie tylko całkowite i `scaleMode: 'nearest'` (`TextureStyle.defaultOptions.scaleMode = 'nearest'` przed ładowaniem), `roundPixels: true`.
- W grze ładuj pliki natywne (`_96`, `_480x270`) i skaluj ×2/×3/×4 kodem; pliki `x4` są do podglądu i stron WWW.
- Napis GLASTEMIA, pasek wczytywania i wskazówki rysuj kodem (font Jersey 15), nie wypiekaj w grafice.

## Pochodzenie i licencja

Ilustracje wygenerowane przez AI (CellCog, cellcog.ai) na podstawie opisu użytkownika, następnie przeskalowane do siatki pikseli gry; herb na ekranie wczytywania narysowany kodem. Przy publikacji (np. Steam Content Survey) zaznacz treści wygenerowane przez AI – `source.kind` w `manifest.json`. Sprawdź warunki CellCog dotyczące komercyjnego użycia wygenerowanych obrazów.

## Wklej do CLAUDE.md projektu

```
## Grafika 2D
- Gotowe grafiki: assets/art/ (opis w assets/art/README.md, metadane w manifest.json).
- Pixel art: tylko skalowanie całkowite, nearest, roundPixels. Natywne: ekran wczytywania 480x270, awatary 96x96.
- Teksty UI zawsze kodem (Jersey 15), nigdy w bitmapach.
- Nowe assety dopisuj do manifest.json (path, role, size, source.kind, sha256).
```
