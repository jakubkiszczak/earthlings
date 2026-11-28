// A* na siatce komórek (8 kierunków). Czysta logika bez grafiki – do przeniesienia na serwer.

/** Wysokość komórki; 0 = nieprzechodnia (lub poza mapą). */
export type CellHeight = (i: number, j: number) => number;

export interface PathOptions {
  /** rozmiar siatki (NC × NC) */
  size: number;
  /** maksymalna różnica wysokości między sąsiednimi komórkami */
  maxStep?: number;
}

/** Zwraca listę komórek [i, j] od startu do celu (włącznie) albo null, gdy nie ma drogi. */
export function findPath(
  cellH: CellHeight, si: number, sj: number, ti: number, tj: number, { size, maxStep = 8 }: PathOptions,
): [number, number][] | null {
  const NC = size;
  const key = (i: number, j: number) => j * NC + i;
  const g = new Float32Array(NC * NC).fill(1e9);
  const from = new Int32Array(NC * NC).fill(-1);
  const closed = new Uint8Array(NC * NC);
  const heap: [number, number][] = [];
  const push = (f: number, k: number) => {
    heap.push([f, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const hfn = (i: number, j: number) => {
    const dx = Math.abs(i - ti), dy = Math.abs(j - tj);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  if (!cellH(si, sj) || !cellH(ti, tj)) return null;
  const s0 = key(si, sj);
  g[s0] = 0;
  push(hfn(si, sj), s0);
  while (heap.length) {
    const [, k] = pop();
    if (closed[k]) continue;
    closed[k] = 1;
    const i = k % NC, j = (k / NC) | 0;
    if (i === ti && j === tj) {
      const path: [number, number][] = [];
      let c = k;
      while (c !== -1) { path.push([c % NC, (c / NC) | 0]); c = from[c]; }
      return path.reverse();
    }
    const h0 = cellH(i, j);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj, h1 = cellH(ni, nj);
      if (!h1 || Math.abs(h1 - h0) > maxStep) continue;
      // bez ścinania narożników przy ruchu po skosie
      if (di && dj && (!cellH(i + di, j) || !cellH(i, j + dj))) continue;
      const nk = key(ni, nj), ng = g[k] + (di && dj ? Math.SQRT2 : 1);
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + hfn(ni, nj), nk); }
    }
  }
  return null;
}

/** Najbliższa przechodnia komórka w promieniu maxR (szukanie pierścieniami), albo null. */
export function nearestWalkable(cellH: CellHeight, i: number, j: number, maxR = 8): [number, number] | null {
  if (cellH(i, j)) return [i, j];
  for (let r = 1; r < maxR; r++)
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++)
      if (cellH(i + di, j + dj)) return [i + di, j + dj];
  return null;
}

/** Wygładzenie ścieżki (naciąganie sznurka): z każdego punktu skok do najdalszej komórki widocznej w linii prostej,
 *  gdy cały odcinek (z marginesem 0,35 komórki na boki) prowadzi przez przechodnie komórki, a sąsiednie próbki
 *  nie różnią się wysokością o więcej niż maxStep. Mniej zakrętów → postać idzie prosto, bez zygzaków po siatce. */
export function smoothPath(cellH: CellHeight, path: [number, number][], maxStep = 8): [number, number][] {
  if (path.length <= 2) return path;
  const clear = ([i0, j0]: [number, number], [i1, j1]: [number, number]) => {
    const n = Math.ceil(Math.hypot(i1 - i0, j1 - j0) * 4);
    let prev = cellH(i0, j0);
    for (let s = 1; s <= n; s++) {
      const x = i0 + 0.5 + ((i1 - i0) * s) / n, y = j0 + 0.5 + ((j1 - j0) * s) / n;
      const h = cellH(Math.floor(x), Math.floor(y));
      if (!h || Math.abs(h - prev) > maxStep) return false;
      for (const [ox, oy] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) {
        const hc = cellH(Math.floor(x + ox), Math.floor(y + oy));
        if (!hc || Math.abs(hc - h) > maxStep) return false;
      }
      prev = h;
    }
    return true;
  };
  const out: [number, number][] = [path[0]];
  let a = 0;
  while (a < path.length - 1) {
    let b = path.length - 1;
    while (b > a + 1 && !clear(path[a], path[b])) b--;
    out.push(path[b]);
    a = b;
  }
  return out;
}
