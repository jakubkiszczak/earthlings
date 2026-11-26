# Postacie do Glastemii – wymagania i prompt dla generatora grafiki

## Wymagania techniczne (muszą się zgadzać z grą)
| Co | Wartość |
|---|---|
| Klatka | **42×63 px**, kotwica: środek stóp w (21, 62) – stopy dotykają dolnej krawędzi |
| Wysokość postaci | 54–60 px (głowa ok. 14–16 px – proporcje „chibi”, ok. 1 : 3,5) |
| Widok | izometria 3/4 z góry (kamera ok. 30°), pasuje do kafli 64×32 (2:1) |
| Kierunki | S, SE, E, NE, N (W, SW, NW gra robi lustrem – broń zmienia rękę, to akceptujemy) |
| Animacje | idle 2 klatki, chód 4, atak 2, siedzenie 2, śmierć 1 (leżąca) |
| Arkusz | wiersze = kierunki (S, SE, E, NE, N), kolumny = klatki; komórki 42×63 bez odstępów |
| Tło | przezroczyste PNG, **bez półprzezroczystych pikseli**, bez cienia na ziemi (gra dodaje własny), bez poświaty |
| Kontur | 1 px, ciemny #161012 wokół całej sylwetki; wewnątrz ciemniejszy odcień materiału zamiast czerni |
| Światło | z lewej-góry; 3–4 tony na materiał (blask, światło, cień, głęboki cień) |
| Paleta | 16–24 kolory na postać, nasycone, ciepłe; metal chłodny szaroniebieski, skóra brzoskwiniowa |
| Czytelność | sylwetka rozpoznawalna w 42×63 przy zoomie ×2; duże dłonie/broń, wyraźna twarz (oczy 1–2 px) |
| Portret do UI | osobno 96×96, popiersie 3/4, to samo ubranie i kolory (jak `assets/art/avatars/`) |
| Zakazy | tekst, logo, ramki, rozmycie, antyaliasing, gradienty, styl konkretnej cudzej gry |

## Prompt (EN – generatory lepiej go rozumieją)
```
Pixel art character sprite sheet for an isometric fantasy RPG, 3/4 top-down view (camera ~30°),
chibi proportions (head ~1/3.5 of height), chunky readable silhouette, crisp hard pixels, no anti-aliasing,
1-pixel dark outline (#161012), light source from the upper left, 3-4 shading tones per material,
limited warm saturated palette (max 24 colors), transparent background, no ground shadow, no text.
Character: [OPIS POSTACI].
Layout: 5 rows = facing directions south, south-east, east, north-east, north;
columns = idle (2 frames), walk cycle (4 frames), attack (2 frames).
Each cell exactly 42x63 pixels, feet centered at the bottom edge, same scale and same pixel grid in every cell,
consistent design across all directions.
```
Wersja „koncepcyjna” (jedna poza, do akceptacji wyglądu przed arkuszem):
```
Single pixel art character, isometric 3/4 view facing south-east, idle pose, full body,
chibi proportions, 1-pixel dark outline, light from upper left, limited warm palette,
transparent background, 42x63 pixel grid upscaled 8x with nearest neighbor. Character: [OPIS POSTACI].
```

## Opisy postaci do wstawienia w [OPIS POSTACI]
- **Człowiek – wojownik:** young man, short brown hair, steel breastplate over red tunic, red cape, round wooden shield with iron rim, short sword.
- **Człowiek – łowca:** bearded man, brown leather jerkin with fur collar, hooded green cloak, longbow, quiver on the back.
- **Elf – wojownik:** slender elf, long blond hair, pointed ears, ornate gold-trimmed green-and-silver armor, leaf-shaped blade.
- **Elf – łowca:** red-haired elf woman with a braid, pointed ears, green hooded cloak, leather armor, recurve bow, quiver.
- **Kupiec (NPC):** stout merchant with a mustache, green vest over cream shirt, leather apron, coin purse, satchel of potions.
- **Liwia (NPC):** young townswoman, brown hair, white headscarf, brown dress with apron, basket of bread.
- **Dziadek Ostromir (NPC):** old man, long white beard, worn grey-brown robes, wooden staff.
- **Strażnik miejski (NPC):** guard in kettle helmet and chainmail, blue tabard, tall spear, kite shield.
- **Kowal (NPC):** bald muscular man, red beard, leather apron, hammer.
- **Kapłanka (NPC):** priestess in white and green robes, golden staff with sun symbol.
- **Szkielet / zombie:** undead skeleton with rusty sword and round shield / rotting green-skinned zombie in torn rags.

## Jak to przerobić na grafikę do gry
1. Najpierw wersja koncepcyjna jednej postaci → akceptacja wyglądu.
2. Arkusz robić po jednej postaci, z obrazem koncepcyjnym jako referencją (spójność kierunków).
3. Generator rzadko trzyma dokładną siatkę: generować w ×8 (336×504 na klatkę), potem zmniejszyć (box/nearest),
   zredukować paletę do ≤24 kolorów, usunąć półprzezroczyste piksele, dodać kontur 1 px – zrobię to skryptem.
4. Pliki: `assets/art/sprites/<postać>.png` + wpis w `assets/art/manifest.json` (`source.kind: ai-generated`).
5. Jeśli kierunki/klatki wyjdą niespójne, bierzemy z AI tylko wygląd (kolory, ubiór) i odtwarzamy go w `chargen.ts`.
