# Zadanie: postacie pixel art do gry Glastemia

Tworzę przeglądarkowe RPG „Glastemia” w izometrii, w stylu pixel art (TypeScript + PixiJS). Potrzebuję postaci
w stylu jak na załączonym obrazku (arkusz kilkunastu fantasy postaci chibi: wojownik, czarodziejka, łuczniczka,
kupiec, strażnik, kowal, bard, kapłanka itd.), ale dopasowanych technicznie do mojej gry.
Przygotuj dla mnie: (1) gotowe prompty do generatora grafiki dla każdej postaci z listy poniżej, (2) ewentualne
uwagi, co poprawić w wymaganiach, żeby wyniki dało się użyć w grze bez ręcznego poprawiania.

## Wymagania techniczne (muszą się zgadzać z grą)
- Klatka: **42×63 px**, kotwica w środku stóp (21, 62) – stopy dotykają dolnej krawędzi.
- Wysokość postaci 54–60 px, proporcje „chibi” (głowa ok. 1/3,5 wysokości), czytelna sylwetka.
- Widok: izometria 3/4 z góry (kamera ok. 30°), pasujący do kafli 64×32 (2:1).
- Kierunki: S, SE, E, NE, N. Kierunki W, SW, NW gra robi lustrzanym odbiciem (broń zmienia rękę – akceptowalne).
- Animacje: stanie 2 klatki, chód 4, atak 2, siedzenie 2, śmierć 1 (leżąca).
- Arkusz: wiersze = kierunki (S, SE, E, NE, N), kolumny = klatki; komórki 42×63 bez odstępów.
- Tło przezroczyste, bez półprzezroczystych pikseli, bez cienia na ziemi (gra rysuje własny), bez poświaty.
- Kontur 1 px, ciemny #161012 wokół sylwetki; wewnątrz ciemniejsze odcienie materiału zamiast czerni.
- Światło z lewej-góry; 3–4 odcienie na materiał (blask, światło, cień, głęboki cień).
- Paleta: 16–24 kolory na postać, nasycone i ciepłe; metal chłodny szaroniebieski, skóra brzoskwiniowa.
- Twarz czytelna mimo małego rozmiaru: oczy 1–2 px z jasnym białkiem, brwi, cień pod nosem.
- Do interfejsu osobno portret 96×96 (popiersie 3/4, ciemnozielone tło, to samo ubranie i kolory).
- Zakazy: tekst, logo, ramki, rozmycie, antyaliasing, gradienty, kopiowanie stylu konkretnej istniejącej gry.

## Prompt bazowy (EN)
```
Pixel art character sprite sheet for an isometric fantasy RPG, 3/4 top-down view (camera ~30°),
chibi proportions (head ~1/3.5 of height), chunky readable silhouette, crisp hard pixels, no anti-aliasing,
1-pixel dark outline (#161012), light source from the upper left, 3-4 shading tones per material,
limited warm saturated palette (max 24 colors), transparent background, no ground shadow, no text.
Character: [CHARACTER DESCRIPTION].
Layout: 5 rows = facing directions south, south-east, east, north-east, north;
columns = idle (2 frames), walk cycle (4 frames), attack (2 frames).
Each cell exactly 42x63 pixels, feet centered at the bottom edge, same scale and same pixel grid in every cell,
consistent design across all directions.
```

## Prompt koncepcyjny (jedna poza – najpierw zatwierdzam wygląd)
```
Single pixel art character, isometric 3/4 view facing south-east, idle pose, full body,
chibi proportions, 1-pixel dark outline, light from upper left, limited warm palette,
transparent background, 42x63 pixel grid upscaled 8x with nearest neighbor. Character: [CHARACTER DESCRIPTION].
```

## Prompt portretu 96×96
```
Pixel art bust portrait, 3/4 view, 96x96 pixel grid, dark green textured background, light from upper left,
crisp pixels, no text, no frame. Character: [CHARACTER DESCRIPTION].
```

## Postacie
Postacie gracza (2 rasy × 2 klasy):
- Człowiek – wojownik: young man, short brown hair, steel breastplate over red tunic, red cape, round wooden shield with iron rim, short sword.
- Człowiek – łowca: bearded man, brown leather jerkin with fur collar, hooded green cloak, longbow, quiver on the back.
- Elf – wojownik: slender elf, long blond hair, pointed ears, ornate gold-trimmed green-and-silver armor, leaf-shaped blade.
- Elf – łowca: red-haired elf woman with a braid, pointed ears, green hooded cloak, leather armor, recurve bow, quiver.

NPC w mieście:
- Kupiec: stout merchant with a mustache, green vest over cream shirt, leather apron, coin purse, satchel of potions.
- Liwia: young townswoman, brown hair, white headscarf, brown dress with apron, basket of bread.
- Dziadek Ostromir: old man, long white beard, worn grey-brown robes, wooden staff.
- Strażnik miejski: guard in kettle helmet and chainmail, blue tabard, tall spear, kite shield.
- Kowal: bald muscular man, red beard, leather apron, hammer.
- Kapłanka: priestess in white and green robes, golden staff with sun symbol.

Potwory:
- Szkielet: undead skeleton with rusty sword and round shield.
- Zombie: rotting green-skinned zombie in torn rags, slouched pose.

## Jak będę używać wyników
1. Najpierw wersja koncepcyjna jednej postaci, akceptuję wygląd.
2. Arkusz po jednej postaci, z obrazem koncepcyjnym jako referencją (spójność kierunków).
3. Generator rzadko trzyma dokładną siatkę, więc generuję w ×8 (336×504 na klatkę), potem skrypt zmniejsza obraz,
   redukuje paletę do ≤24 kolorów, usuwa półprzezroczyste piksele i dodaje kontur 1 px.
4. Gdy kierunki lub klatki wyjdą niespójne, z grafiki AI biorę tylko wygląd (kolory, ubiór), a postać rysuje kod gry.
