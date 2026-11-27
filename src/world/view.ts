// Obrót widoku co 90° (Q/E). Logika gry liczy w układzie świata (u, v); tylko rzut na ekran, kolejność rysowania
// i kierunek patrzenia postaci przechodzą przez obrót. Obraz każdej komórki jest wygenerowany z 4 stron (meta_rN.json).
export const VIEW = { r: 0, C: 1280 };

/** wektor świata → wektor w układzie widoku (p, q) */
export function rotVec(du: number, dv: number, r = VIEW.r): [number, number] {
  for (let i = 0; i < r; i++) [du, dv] = [dv, -du];
  return [du, dv];
}

/** wektor w układzie widoku → wektor świata */
export const unrotVec = (dp: number, dq: number, r = VIEW.r): [number, number] => rotVec(dp, dq, (4 - r) % 4);

/** lokalne (u, v) komórki o boku C → lokalne (p, q) obróconego obrazu tej komórki (zgodnie z generatorem) */
export function rotLocal(u: number, v: number, C: number, r = VIEW.r): [number, number] {
  switch (r) {
    case 1: return [v, C - 1 - u];
    case 2: return [C - 1 - u, C - 1 - v];
    case 3: return [C - 1 - v, u];
    default: return [u, v];
  }
}

/** indeks komórki (cx, cy) w siatce GRID×GRID → indeks w obróconym widoku */
export function rotCell(cx: number, cy: number, grid: number, r = VIEW.r): [number, number] {
  switch (r) {
    case 1: return [cy, grid - 1 - cx];
    case 2: return [grid - 1 - cx, grid - 1 - cy];
    case 3: return [grid - 1 - cy, cx];
    default: return [cx, cy];
  }
}

/** głębia (z) punktu lokalnego bieżącej komórki – do zIndex postaci i obiektów */
export const depthOf = (u: number, v: number): number => { const [p, q] = rotLocal(u, v, VIEW.C); return p + q; };

/** kierunek ekranowy (do wyboru klatki postaci) z wektora świata: [sdx, sdy] */
export function screenDir(du: number, dv: number): [number, number] {
  const [p, q] = rotVec(du, dv);
  return [p - q, (p + q) / 2];
}
