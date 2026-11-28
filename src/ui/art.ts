// Grafiki malowane (np. przysłane przez autora) w assets/art/. Lista dostępnych plików w manifest.json –
// dzięki niej gra nie pyta o brakujące pliki (brak błędów 404 w konsoli). Gdy grafiki nie ma, zostaje wersja rysowana kodem.
import { assetUrl } from '../assets';

let files = new Set<string>();

export async function loadArtManifest(): Promise<void> {
  try {
    const r = await fetch(assetUrl('art/manifest.json'));
    if (r.ok) {
      const m = (await r.json()) as { assets?: { path: string }[] };
      files = new Set((m.assets ?? []).map((a) => a.path.replace(/^assets\/art\//, '')));
    }
  } catch { /* brak listy – tylko grafiki z kodu */ }
}

/** adres grafiki, jeśli jest w assets/art/, inaczej null */
export const artUrl = (name: string): string | null => (files.has(name) ? assetUrl('art/' + name) : null);
/** awatar rasy, klasy i płci w natywnej siatce 96×96: avatars/<rasa>_<klasa>_<płeć>_96.png (np. avatars/elf_hunter_female_96.png) */
export const portraitArt = (race: string, cls: string, gender = 'male'): string | null => artUrl(`avatars/${race}_${cls}_${gender}_96.png`);
