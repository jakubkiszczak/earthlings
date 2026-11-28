# Glastemia – specyfikacja postaci (paper doll)

## Siatka i układ
- Klatka **42×63 px**, kotwica stóp **(21,62)**. Wyjątek: klatka 11 (skok w mocnym uderzeniu) jest uniesiona o 9 px celowo.
- Każdy arkusz ma 630×63 px (15 klatek w jednym wierszu). Kierunki: **S, SE, E, NE, N, NW, W, SW**, wszystkie narysowane osobno. **Bez odbić lustrzanych**, bo tarcza zawsze jest na lewej ręce, a miecz w prawej.
- Kąty to stopnie ekranowe: 0 = w prawo, 90 = w dół, zgodnie z ruchem wskazówek zegara.

## Animacje (indeksy klatek)
| animacja | klatki | fps | pętla |
|---|---|---|---|
| idle | 0–1 | 2 | tak |
| walk | 2–5 | 8 | tak |
| attack | 6–7 | 10 | nie → idle |
| sit | 8–9 | 2 | tak |
| power_strike | 10–13 | 10 | nie → idle |
| death | 14 | – | nie (hełm ukryty) |

## Warstwy (assets/art/sprites)
| warstwa | plik | typ |
|---|---|---|
| włosy z tyłu | appearance/hair/{gender}_{style}_{DIR}_anim_back.png | pełna klatka, kolor z palety |
| ciało (łyse) | appearance/body/{human\|elf}_{gender}_{DIR}_anim.png | pełna klatka |
| broda | appearance/beard/male_{style}_{DIR}_anim.png | pełna klatka, kolor z palety, tylko człowiek-mężczyzna |
| włosy z przodu | appearance/hair/{gender}_{style}_{DIR}_anim_front.png | pełna klatka, kolor z palety (widoczne także pod hełmem) |
| uszy elfa | appearance/body/elf_{gender}_{DIR}_anim_ears.png | pełna klatka, tylko elf |
| buty | boots_leather_{DIR}.png | pełna klatka |
| hełm | helmet_spangen_{DIR}.png | przypinany do `head`, pivot (15,8), obracany o head.angle |
| tarcza | shield_round_{DIR}.png | przypinana do `hand_l` przez `center_offset_from_hand_l`, bez obrotu |
| miecz | sword_short.png (jeden plik dla wszystkich kierunków) | przypinany do `hand_r`, pivot (4,3), obracany o hand_r.angle |

## Kolejność rysowania (w każdej klatce)
Zasada: **miecz jest zawsze widoczny przed tarczą.**
0. włosy z tyłu (`hair_back`)
1. tarcza, jeśli `z.shield == "behind"`
2. miecz, jeśli `z.weapon == "behind"`
3. ciało (człowiek albo elf) → buty → broda → włosy z przodu (`hair_front`) → uszy elfa
4. hełm (oprócz klatki 14)
5. tarcza, jeśli `z.shield == "front"`
6. miecz, jeśli `z.weapon == "front"`
7. jeśli miecz jest za ciałem, a tarcza przed nim: miecz rysowany jeszcze raz, przycięty do pikseli tarczy (w PixiJS: kopia sprite'a miecza z `mask` = sprite tarczy). Dzięki temu miecz jest nad tarczą, ale nadal za ciałem.

## Pozycjonowanie (w układzie klatki, origin lewy górny róg)
- Miecz: lewy górny róg = hand_r − pivot po obrocie wokół pivota.
- Tarcza: środek = hand_l + center_offset_from_hand_l (lewy górny róg = środek − rozmiar//2).
- Hełm: pivot (15,8) trafia w punkt head, potem obrót o head.angle.
- W silniku przesuń wszystko o −(21,62), żeby (0,0) wypadło w stopach.

## Rejestr przedmiotów
`assets/art/sprites/items.json`: sloty, punkty zaczepienia, pivoty, pliki dla każdego kierunku oraz tabela animacji. Nowy przedmiot = nowy wpis i 8 plików.

## Weryfikacja
`python tools/compose_preview.py` składa wszystkie 8 kierunków × 15 klatek dokładnie tak, jak zostały zatwierdzone (`docs/preview/compose_check.png` = `docs/preview/character_8dir_equipped.png` w skali 1). Gra ma dawać identyczny obraz.

## Pochodzenie
Ciało, włosy i buty wygenerował model obrazów (CellCog), a potem zostały dopasowane do siatki. Tarcze i hełmy narysowano kodem. W N/NE/NW klatki 6, 7, 10 i 11 są odbite w poziomie (poprawka strony ręki). Grafiki z AI trzeba zgłosić przy publikacji (np. Steam Content Survey).

## Postać kobieca
- Pliki: `appearance/body/{human|elf}_female_{DIR}_anim.png` + `human_female_{DIR}_anchors.json` (rejestr: `items.json` → `body_female`).
- Te same klatki, animacje, przedmioty i kolejność rysowania co u mężczyzny; punkty zaczepienia czytaj z pliku kobiety (różnią się o 1–5 px).
- Podgląd: `docs/preview/female_8dir_equipped.png`, `docs/preview/female_walk_8dir.gif`.

## Łuk i animacja strzału
- Osobne arkusze 168×63 (4 klatki): te same warstwy wyglądu z `_shoot` zamiast `_anim` w nazwie (`appearance/body/{race}_{gender}_{DIR}_shoot.png`, `appearance/hair/..._shoot_back|front.png`, `appearance/beard/..._shoot.png`, `..._shoot_ears.png`); punkty: `*_{DIR}_shoot_anchors.json`.
- Klatki: 0 gotowość, 1 naciąganie, 2 pełny naciąg, 3 puszczenie. 8 fps, bez pętli, potem idle. Używana zamiast `attack`, gdy w slocie broni jest łuk.
- Łuk `bow_short.png`: zawsze w lewej ręce (`hand_l`), pivot (3,11), obrót o `hand_l.angle` (linia celowania = od ręki z cięciwą do uchwytu). Końce łuku w układzie sprite'a: (1,0) i (1,22).
- Cięciwa: linia od obu końców łuku do `hand_r` w klatkach 1–2, do uchwytu w klatkach 0 i 3 (rysowana kodem, kolor #E6E1D2, 1 px).
- Strzała `arrow.png`: pivot (0,1) w `hand_r`, obrót o ten sam kąt, widoczna w klatkach 0–2 (w klatce 0 nasadka 12 px za uchwytem na linii celowania).
- Kolejność: łuk+cięciwa+strzała przed ciałem, gdy `z.bow == "front"`, inaczej za ciałem. Łuk jest dwuręczny – wyłącza tarczę.
- Podgląd: `docs/preview/shoot_8dir_male_female.png`.

## Portrety (96×96, x4 do UI)
`assets/art/avatars/{human|elf}_{warrior|hunter}_{male|female}_96(.png|x4.png)` – komplet 8 postaci, przegląd: `docs/preview/portraits_8.png`.

## Wygląd: rasa, fryzura, broda, kolory
Wszystko w `assets/art/sprites/appearance/`, rejestr: `items.json` → `appearance`. Te same punkty zaczepienia co ciało danej płci (elf używa punktów człowieka).
- **Rasa:** `human` albo `elf`. Elf = jasna skóra, zielona koszula i osobna warstwa uszu (`elf_{gender}_{DIR}_{sheet}_ears.png`). Ciała są łyse, skóra głowy ma kolory skóry, więc żadne brązowe włosy nie prześwitują spod jasnych fryzur.
- **Fryzury:** mężczyzna `short`, `buzz`, `long`, `ponytail`; kobieta `long`, `ponytail`, `bob`, `bun`. Każda ma dwie warstwy: `_back` (za ciałem) i `_front` (na ciele). Jedna z nich może być pusta w danym kierunku.
- **Brody** (tylko człowiek-mężczyzna): `none`, `stubble`, `medium`, `long`, `mustache`. W N, NE, NW pliki są puste (twarzy nie widać). Zarost ma półprzezroczyste piksele, alfę trzeba zachować.
- **Kolory:** `brown`, `black`, `blond`, `red`, `platinum`, `gray`, osobno dla włosów i brody. Pliki włosów i brody zawierają tylko 6 kolorów bazowych z `palettes.json` → `base` (5 tonów od ciemnego + kontur). Przy ładowaniu podmień `base[k]` na `palettes[kolor][k]` (dokładne dopasowanie RGB, alfa bez zmian) i zapamiętaj teksturę dla pary (plik, kolor). Pozostałe kolory w plikach (np. kontur ciała) zostają bez zmian.
- **Domyślnie:** mężczyzna człowiek `short` `brown` bez brody; kobieta człowiek `long` `brown`.
- **Hełm** rysuj nad włosami z przodu. Długie włosy, kucyk i broda zostają widoczne spod hełmu.
- Podglądy: `docs/preview/appearance_*.png`. Wzorzec: `python tools/compose_preview.py --race elf --hair long --hair-color platinum` albo `--beard medium --beard-color red` (opcje w nagłówku skryptu).
