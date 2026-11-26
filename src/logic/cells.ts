// Siatka komórek świata (3×3): przejścia przez krawędzie. Czysta logika, bez grafiki.

export interface CellStep { dx: number; dy: number }

/**
 * Czy punkt (u, v) w lokalnych współrzędnych komórki wyszedł poza nią, i w którą stronę.
 * Zwraca przesunięcie do sąsiada (dx, dy ∈ {-1, 0, 1}) albo null, gdy punkt jest w komórce
 * lub sąsiad leżałby poza światem.
 */
export function cellStep(cx: number, cy: number, u: number, v: number, size: number, grid: number): CellStep | null {
  const dx = u < 0 ? -1 : u >= size ? 1 : 0;
  const dy = v < 0 ? -1 : v >= size ? 1 : 0;
  if (!dx && !dy) return null;
  const nx = cx + dx, ny = cy + dy;
  if (nx < 0 || ny < 0 || nx >= grid || ny >= grid) return null;
  return { dx, dy };
}

/** Przeliczenie lokalnych współrzędnych na komórkę sąsiada. */
export function toNeighbor(u: number, v: number, step: CellStep, size: number): [number, number] {
  return [u - step.dx * size, v - step.dy * size];
}

/** Pozycja na minimapie: globalne (0..grid) z komórki i lokalnych współrzędnych. */
export function globalPos(cx: number, cy: number, u: number, v: number, size: number): [number, number] {
  return [cx + u / size, cy + v / size];
}
