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
| ciało bez włosów | human_base_{DIR}_anim_nohair.png | pełna klatka |
| włosy | human_hair_{DIR}.png | pełna klatka (zawsze widoczne, także pod hełmem) |
| buty | boots_leather_{DIR}.png | pełna klatka |
| hełm | helmet_spangen_{DIR}.png | przypinany do `head`, pivot (15,8), obracany o head.angle |
| tarcza | shield_round_{DIR}.png | przypinana do `hand_l` przez `center_offset_from_hand_l`, bez obrotu |
| miecz | sword_short.png (jeden plik dla wszystkich kierunków) | przypinany do `hand_r`, pivot (4,3), obracany o hand_r.angle |
| podgląd | human_base_{DIR}_anim.png | ciało, buty i włosy złożone razem (tylko do podglądu) |

## Kolejność rysowania (w każdej klatce)
Zasada: **miecz jest zawsze widoczny przed tarczą.**
1. tarcza, jeśli `z.shield == "behind"`
2. miecz, jeśli `z.weapon == "behind"`
3. ciało bez włosów → buty → włosy
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
- Pliki: `human_female_{DIR}_anim_nohair.png` + `human_female_{DIR}_anchors.json` (rejestr: `items.json` → `body_female`).
- Te same klatki, animacje, przedmioty i kolejność rysowania co u mężczyzny; punkty zaczepienia czytaj z pliku kobiety (różnią się o 1–5 px).
- Krótka czapka włosów jest wpieczona w ciało (brak osobnej warstwy włosów — fryzury damskie dojdą jako nakładki).
- Podgląd: `docs/preview/female_8dir_equipped.png`, `docs/preview/female_walk_8dir.gif`.
