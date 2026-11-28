# Prompt dla Claude Code: podmiana postaci gracza w grze Glastemia

Wklej cały blok poniżej do Claude Code, uruchomionego w katalogu głównym repozytorium gry, po rozpakowaniu paczki.

```
Zadanie: podmień obecną postać gracza w grze Glastemia na nową postać pixel-art z wymiennym wyposażeniem (paper doll), w wersji męskiej i kobiecej. Gra: TypeScript + PixiJS v8.

KROK 0. Rozpoznanie, przed jakimkolwiek kodem
- Przeczytaj START_HERE.md, docs/CHARACTER_SPEC.md i assets/art/sprites/items.json. To jedyne źródło prawdy o klatkach, warstwach, punktach zaczepienia i kolejności rysowania.
- Znajdź w repo, jak dziś rysowana jest postać gracza: klasę lub moduł sprite'a, ładowanie tekstur, kierunki, animacje i miejsca, które je wywołują (ruch, atak, siadanie, śmierć, umiejętności). Pokaż mi krótki plan podmiany: które pliki zmienisz, co usuniesz, co zostaje. Potem działaj.
- Sprawdź, czy gra używa układu izometrycznego i jakiej skali świata. Dopasuj do nich nową postać.

KROK 1. CharacterSprite (Container)
- Warstwy i kolejność rysowania dokładnie wg docs/CHARACTER_SPEC.md:
  tarcza(za) → miecz(za) → ciało → buty → włosy → hełm → tarcza(przed) → miecz(przed).
- Zasada: miecz zawsze widoczny przed tarczą. Gdy z.weapon == "behind" i z.shield == "front", dodaj drugą kopię miecza z mask = sprite tarczy, rysowaną po tarczy.
- Warstwy pełnoklatkowe (ciało, buty, włosy) synchronizuj po indeksie klatki. Sprite'y przypinane:
  - miecz: pivot (4,3) w punkcie hand_r, obrót o hand_r.angle;
  - tarcza: środek = hand_l + center_offset_from_hand_l (z pliku punktów zaczepienia danego kierunku), bez obrotu;
  - hełm: pivot (15,8) w punkcie head, obrót o head.angle, ukryty w klatce 14.
- Przeliczaj pozycje i kolejność przy każdej zmianie klatki i kierunku.
- Płeć: setBody('male' | 'female').
  - Mężczyzna: items.json → body, pliki human_base_*, z warstwą włosów.
  - Kobieta: items.json → body_female, pliki human_female_*, bez osobnej warstwy włosów.
  - Każda płeć ma własne punkty zaczepienia (pliki *_anchors.json).
  - Jeśli postać gracza w grze ma już pole płci lub rasy, podepnij je. Jeśli nie, dodaj pole z domyślną wartością 'male'.

KROK 2. Kierunki i animacje
- 8 kierunków (S, SE, E, NE, N, NW, W, SW), każdy z osobnych plików. Nigdy nie odbijaj sprite'ów (scale.x = -1), bo tarcza musi zostać w lewej ręce.
- dirFromVector(dx, dy) daje 8 sektorów po 45° w układzie ekranu (S = w dół ekranu). Jeśli ruch liczony jest w izometrii, najpierw przelicz wektor na ekran.
- Animacje, fps i pętle bierz z items.json.
  - idle, walk i sit są w pętli.
  - attack i power_strike po zakończeniu wracają do idle.
  - death zatrzymuje się na klatce 14.
  Podepnij je pod istniejące akcje gry: ruch → walk, atak → attack, mocne uderzenie → power_strike, siadanie → sit, śmierć → death.

KROK 3. API i wyposażenie
- setEquipment({ weapon, shield, helmet, boots }). null oznacza brak przedmiotu, a id pochodzi z items.json.
- Rejestr przedmiotów czytaj z items.json. Nowy przedmiot ma wymagać tylko nowego wpisu i plików, bez zmian w kodzie.
- Jeśli gra ma już ekwipunek, mapuj jego sloty na te cztery. Brak odpowiednika oznacza null.

KROK 4. Pixel art
- Przed ładowaniem tekstur ustaw TextureStyle.defaultOptions.scaleMode = 'nearest'.
- Włącz roundPixels.
- Używaj skali całkowitej (taka jak skala świata gry, domyślnie x3).
- Obracaj bez wygładzania i zaokrąglaj pozycje do pełnych pikseli.
- Punkt (0,0) postaci wypada w stopach (21,62). Sortowanie głębi (zIndex) licz według stóp.

KROK 5. Strona testowa dev/character-test.html
- Siatka 8 kierunków × 15 klatek w skali x2, w tym samym układzie co docs/preview/character_8dir_equipped.png.
- Przełączniki: płeć, każdy slot wyposażenia, animacja.
- Jedna postać x4 sterowana strzałkami lub WASD.
- Przełącznik kropek punktów zaczepienia: czerwona hand_r, niebieska hand_l, zielona head.

KROK 6. Testy (vitest)
- Każdy plik *_anchors.json ma 15 klatek, a wszystkie punkty mieszczą się w 42×63.
- Każdy plik wskazany w items.json istnieje.
- setEquipment z null usuwa warstwę.
- Gdy z.weapon == "behind", miecz jest pod ciałem.
- Gdy miecz jest za ciałem, a tarcza przed nim, istnieje kopia miecza z maską.
- dirFromVector zwraca 8 poprawnych kierunków.

KROK 7. Zgodność wizualna
- Zrób zrzut siatki ze strony testowej w skali 1, bez tła, dla obu płci.
- Porównaj zrzuty z wynikiem `python tools/compose_preview.py`, który zapisuje docs/preview/compose_check.png. Z flagą `--female` zapisuje compose_check_female.png.
- Obraz ma być identyczny co do piksela. Jeśli nie jest, opisz w raporcie różnice: kierunek i numer klatki.

KROK 8. Sprzątanie i raport
- Usuń z gry stare grafiki i kod starej postaci, jeśli nie są już używane. Zostaw assets/art/legacy/ i assets/art/variants_draft/ bez zmian.
- Uruchom build, testy i grę, sprawdź konsolę.
- Krótki raport:
  - co działa;
  - zrzuty postaci w grze: mężczyzna i kobieta, z hełmem i bez;
  - lista zmienionych plików;
  - lista ewentualnych rozbieżności.

Nie zmieniaj grafik ani wartości w plikach JSON z assets/art/. Jeśli coś wygląda źle, zgłoś to zamiast poprawiać.
```
