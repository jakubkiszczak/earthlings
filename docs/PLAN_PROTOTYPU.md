# Earthlings – plan budowy prototypu v0.1

Cel: grywalny prototyp w przeglądarce, udostępniany testerom jednym linkiem (GitHub Pages), bez logowania. Każdy tester gra solo, postać zapisuje się w jego przeglądarce.

Wartości liczbowe oznaczone *(do strojenia)* to propozycje startowe. Wszystkie trafią do jednego pliku konfiguracji (`src/data/balance.ts`), żeby balans zmieniać bez ruszania kodu.

---

## 1. Zakres prototypu (co jest, czego nie ma)

**Jest:**
- Świat 3×3 komórki, miasto w centrum (strefa bezpieczna), 8 komórek z mobami.
- Ekran startowy → Graj → wybór postaci → kreator postaci → gra.
- 2 rasy (człowiek, elf), 2 klasy (wojownik, łowca), 4 atrybuty.
- Wygląd: 5 opcji włosów, 3 budowy ciała, 3 opcje brody.
- 3 typy mobów, po 30 na komórkę, respawn 15 s.
- Auto-atak + 2 umiejętności na klasę, mana, cooldowny.
- Złoto, potiony HP i many, 20 przedmiotów, ekwipunek, sklep w mieście.
- Doświadczenie i poziomy 1–5.
- Minimapa 3×3, dźwięki.
- Zapis postaci w `localStorage`, do 3 postaci.

**Nie ma (świadomie):** logowania, serwera, innych graczy w świecie, czatu sieciowego, handlu między graczami, zadań, telefonów i dotyku, formularza uwag, statystyk.

---

## 2. Przebieg gracza

1. **Ekran startowy:** logo Earthlings, przycisk „Graj”, ustawienia dźwięku.
2. **Wybór postaci:** lista do 3 zapisanych postaci (nazwa, rasa, klasa, poziom). Przyciski „Wejdź do gry”, „Nowa postać”, „Usuń”.
3. **Kreator postaci** (podgląd postaci na żywo, obracany w 8 kierunkach):
   - nazwa (3–16 znaków, litery, cyfry, spacja),
   - rasa: człowiek / elf,
   - klasa: wojownik / łowca,
   - atrybuty: rozdzielenie 10 punktów,
   - wygląd: włosy (czarne, białe, blond, brązowe, łysy), budowa (chudy, normalny, krępy), broda (krótka, długa, wąsy) – tylko człowiek, elf nie ma brody.
4. **Gra:** start w mieście przy sklepie.

---

## 3. Postać

### Atrybuty

| Atrybut | Wpływ |
| --- | --- |
| Siła | obrażenia wręcz: broń + Siła/2 |
| Zręczność | obrażenia z łuku: broń + Zręczność/2; szansa uniku 0,5% za punkt (maks. 25%) |
| Witalność | HP = 100 + 10 × Witalność |
| Szczęście | tylko z przedmiotów (Pierścień); każdy punkt: +2% złota i +2% szansy na przedmiot *(do strojenia)* |
| Energia | mana = 20 + 5 × Energia; regeneracja many 1 + Energia/20 na sekundę |

**Wartości bazowe** *(do strojenia)*:

| | Siła | Zręczność | Witalność | Energia |
| --- | --- | --- | --- | --- |
| Wojownik | 20 | 10 | 20 | 10 |
| Łowca | 10 | 20 | 15 | 15 |
| Człowiek (bonus) | +2 | – | +2 | – |
| Elf (bonus) | – | +2 | – | +2 |

Plus 10 punktów do rozdzielenia na starcie i 5 punktów za każdy awans. Awans przywraca pełne HP i manę.

Przykład: wojownik-człowiek z 5 pkt w Witalności ma 370 HP i 70 many.

### Poziomy

| Awans | Potrzebny exp | Łącznie |
| --- | --- | --- |
| 1 → 2 | 1000 | 1000 |
| 2 → 3 | 1300 | 2300 |
| 3 → 4 | 1800 | 4100 |
| 4 → 5 | 2500 | 6600 |

Poziom 5 to maksimum: pasek exp zatrzymuje się, exp z mobów przestaje się naliczać.

### Śmierć

Postać odradza się w mieście z pełnym HP i maną, traci 10% złota. Exp i przedmioty zostają.

---

## 4. Walka

- **Auto-atak:** kliknięcie moba → wojownik podchodzi i atakuje wręcz (zasięg 1 kafel), łowca strzela z dystansu (zasięg 8 kafli). Atak trwa do śmierci celu albo kliknięcia gdzie indziej. Tempo: 1 atak na sekundę *(do strojenia)*.
- **Strzały:** łowca zużywa 1 strzałę na strzał. Start z 200 strzałami. Bez strzał łowca nie strzela (komunikat „Brak strzał”).
- **Pancerz:** otrzymane obrażenia × 100 / (100 + pancerz).
- Klawisze: 1 i 2 – umiejętności, Q – potion HP, E – potion many (cooldown potionów 1 s).

### Umiejętności

| Klasa | Umiejętność | Efekt | Mana | Cooldown |
| --- | --- | --- | --- | --- |
| Wojownik | Super uderzenie | cios za podwójne obrażenia | 10 | 5 s |
| Wojownik | Powalenie | cel powalony na 3 s (nie rusza się, nie atakuje) | 15 | 10 s |
| Łowca | Podwójny strzał | 2 strzały, każda z pełnymi obrażeniami; zużywa 2 strzały | 10 | 5 s |
| Łowca | Odpychająca strzała | trafienie + odrzut celu o 10 kafli (zatrzymuje się na przeszkodzie) | 15 | 10 s |

### Moby

| Mob | HP | Obrażenia | Exp | Zachowanie *(do strojenia)* |
| --- | --- | --- | --- | --- |
| Wilk | 80 | 30 | 50 | szybki, atak co 1,2 s, zauważa gracza z 6 kafli |
| Szkielet | 100 | 50 | 100 | średni, atak co 1,8 s, zauważa z 5 kafli |
| Zombie | 150 | 70 | 150 | wolny, atak co 2,2 s, zauważa z 4 kafli |

- 30 mobów na każdą z 8 komórek (240 w świecie), żadnych w mieście.
- Mob ściga gracza najwyżej 12 kafli od swojego punktu, potem wraca i się leczy.
- Respawn 15 s po zabiciu, w punkcie startowym.
- **Rozkład trudności:** komórki stykające się bokiem z miastem (N, S, E, W) – głównie wilki z kilkoma szkieletami; komórki narożne – szkielety i zombie.

---

## 5. Łup i ekonomia

**Z każdego moba:**
- złoto: zawsze, losowo 1–20,
- potion HP (przywraca 15% maks. HP): szansa 20% *(do strojenia)*,
- potion many (przywraca 15% maks. many): szansa 15% *(do strojenia)*,
- przedmiot: wilk 2%, szkielet 4%, zombie 6% *(do strojenia)*; lepsze przedmioty częściej z silniejszych mobów.

Łup leży na ziemi, zbiera się go kliknięciem. Złoto i potiony podnoszą się też automatycznie po wejściu na nie.

### Przedmioty (20)

| Typ | Przedmioty (poziom wymagany) | Skąd |
| --- | --- | --- |
| Miecze (3) | Krótki miecz (1), Miecz żołnierski (3), Ostrze Świtu (5) | drop |
| Łuki (3) | Krótki łuk (1), Łuk myśliwski (3), Łuk elficki (5) | drop |
| Tarcze (3) | Drewniana tarcza (1), Okuta tarcza (3), Tarcza Wieży (5) | drop |
| Hełmy (3) | Skórzany kaptur (1), Żelazny hełm (3), Hełm Świtu (5) | drop |
| Zbroje (3) | Skórznia (1), Kolczuga (3), Zbroja płytowa (5) | drop |
| Buty (2) | Skórzane buty (1), Buty wędrowca (3) | sklep i drop |
| Pierścień (1) | Pierścień Fortuny (2): +5 Szczęście | drop |
| Rękawice (1) | Rękawice łucznika (2): +5 Zręczność | drop |
| Amulet (1) | Amulet Wieży (4): +10% maks. HP | drop |

Razem 20 przedmiotów.

- Start: wojownik ma Krótki miecz, łowca Krótki łuk i 200 strzał.
- Wojownik: miecz + tarcza. Łowca: łuk (oburęczny, bez tarczy). Hełmy, zbroje i buty dla obu klas.
- Statystyki przedmiotów *(do strojenia)*: broń 8–12 / 14–20 / 22–30 obrażeń; pancerz zbroi 15 / 35 / 60; hełmu i tarczy 5 / 12 / 20; buty: pancerz 5 i +5% szybkości ruchu / pancerz 10 i +10% szybkości.
- Ekwipunek: 8 slotów założonych (broń, tarcza, hełm, zbroja, rękawice, buty, pierścień, amulet) + plecak 4×6. Potiony i strzały jako stosy.

### Sklep w mieście

Jeden kupiec (NPC), okno otwierane kliknięciem. Kupiec skupuje przedmioty i potiony za 25% ich wartości *(do strojenia)*. Sprzedaje:
- strzały: 100 sztuk za 10 złota *(do strojenia)*,
- Skórzane buty: 50 złota, Buty wędrowca: 250 złota *(do strojenia)*.

---

## 6. Świat 3×3

- Każda komórka: 40 × 40 kafli (kafel 64×32, izometria 2:1), wygenerowana w Pythonie (`tools/worldgen.py`) – osobny zestaw danych na komórkę, ok. 2 MB.
- Przejście między komórkami na krawędzi jest płynne: w pamięci jest bieżąca komórka i jej sąsiedzi, brakujący sąsiedzi doczytują się w tle (wygaszenie tylko przy skoku, np. zwój powrotu).
- Miasto (środek): mur lub palisada z bramami na 4 strony, kupiec, kilka budynków dekoracyjnych, punkt odrodzenia.
- Pozostałe komórki: różny charakter – las, polana z rzeką, ruiny, cmentarz.
- **Minimapa 3×3** w rogu: komórki, obecna komórka podświetlona, pozycja gracza, miasto.

---

## 7. Grafika (zasady z CLAUDE.md bez zmian)

Postać składana z warstw w czasie gry, 8 kierunków, animacje: stanie, chód, cios, strzał, trafienie, śmierć.

| Warstwa | Warianty |
| --- | --- |
| Ciało | 2 rasy × 3 budowy |
| Włosy | 5 (w tym łysy) |
| Broda | 3 (tylko człowiek) |
| Zbroja i hełm | 3 poziomy (kolor i prosty kształt) |
| Broń i tarcza | osobne sprite'y: miecz, łuk, tarcza (3 poziomy) |

Moby: 3 typy × (chód, atak, śmierć) × 8 kierunków. Efekty: strzała, trafienie, powalenie (gwiazdki), odrzut, liczby obrażeń, poziom w górę. Ikony 14×14 dla 20 przedmiotów, 4 umiejętności, potionów i strzał.

Wszystko generowane kodem w `tools/` (rozszerzenie `hero9.py` i `ui2.py`).

---

## 8. Technologia

- **Klient:** TypeScript + Vite + PixiJS 8; grafiki jako osobne pliki (koniec z base64 w jednym HTML).
- **Moduły:** `render`, `world` (komórki, przejścia), `entities` (gracz, moby, łup), `combat` (formuły, umiejętności), `ai`, `input`, `camera`, `ui` (HUD, kreator, sklep, ekwipunek, minimapa), `audio`, `save`.
- **Logika gry bez zależności od grafiki** (`src/logic/`): walka, łup, exp, AI – czyste funkcje i stan, żeby w etapie 2 przenieść je na serwer (Colyseus) bez przepisywania.
- **Zapis:** `localStorage`, wersjonowany format (pole `version`) z migracją przy zmianach; autozapis co 10 s i przy wyjściu.
- **Dźwięki:** proste efekty generowane lub z licencją CC0 (cios, strzał, trafienie, śmierć moba, poziom, zakup, podniesienie złota), suwak głośności.
- **Testy:** Vitest dla logiki (formuły, exp, łup, cooldowny); Playwright – test „przejdź od ekranu startowego do zabicia moba” + zrzut ekranu + brak błędów w konsoli.
- **Publikacja:** repozytorium na GitHubie, GitHub Actions buduje i publikuje na GitHub Pages po każdym pushu do `main`. Link w stylu `https://<konto>.github.io/earthlings/`. Wersja gry widoczna na ekranie startowym.

---

## 9. Etapy (każdy kończy się działającym linkiem)

| # | Etap | Wynik | Stan |
| --- | --- | --- | --- |
| 0 | Fundament | TypeScript + Vite, rozbicie `game.js` na moduły, repo na GitHubie, automatyczna publikacja. Obecna scena działa pod linkiem. | gotowe |
| 1 | Świat 3×3 | Generator 9 komórek, miasto, przejścia, kolizje, minimapa. | gotowe |
| 2 | Postać | Ekran startowy, wybór i kreator postaci, warstwowe sprite'y, zapis do 3 postaci. |  |
| 3 | Walka | Moby z AI, auto-atak, 4 umiejętności, mana, cooldowny, śmierć i respawn mobów oraz gracza. |  |
| 4 | Progresja i łup | Exp i poziomy, punkty atrybutów, złoto, potiony, 20 przedmiotów, ekwipunek, widoczna broń i zbroja. |  |
| 5 | Miasto i sklep | Kupiec, strzały, buty, okno sklepu. |  |
| 6 | Dźwięk, balans, wydanie | Efekty dźwiękowe, strojenie wartości, testy, wersja v0.1 dla testerów. |  |

**Kryterium ukończenia v0.1:** nowy tester otwiera link, tworzy postać, dochodzi do poziomu 5 dowolną klasą, kupuje buty i strzały, ginie i odradza się, a po odświeżeniu strony postać jest zapisana. Brak błędów w konsoli w Chrome, Firefox, Safari i Edge.

---

## 10. Ustalenia (odpowiedzi na pytania otwarte)

1. Brakujące 3 przedmioty: pierścień (+5 Szczęście), rękawice (+5 Zręczność), amulet (+10% HP).
2. Sklep skupuje przedmioty od gracza.
3. Elf nie może mieć brody; człowiek wybiera jedną z 3 bród.
4. Odpychająca strzała odrzuca o 10 kafli mapy.
5. Na poziomie 5 exp przestaje się naliczać.
