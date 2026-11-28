import { describe, expect, it } from 'vitest';
import { findPath, nearestWalkable } from '../src/logic/pathfinding';

/** siatka z tekstu: '.' = teren (wysokość 1), '#' = przeszkoda, cyfra = wysokość */
const gridFrom = (rows: string[]) => {
  const size = rows.length;
  const cellH = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= size || j >= size) return 0;
    const c = rows[j][i];
    return c === '#' ? 0 : c === '.' ? 1 : Number(c);
  };
  return { size, cellH };
};

describe('findPath', () => {
  it('idzie prosto po skosie na pustej siatce', () => {
    const { size, cellH } = gridFrom(['....', '....', '....', '....']);
    expect(findPath(cellH, 0, 0, 3, 3, { size })).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
  });

  it('omija ścianę i nie ścina narożników', () => {
    const { size, cellH } = gridFrom(['.....', '.###.', '.#...', '.#.#.', '.....']);
    const p = findPath(cellH, 0, 0, 2, 2, { size })!;
    expect(p[0]).toEqual([0, 0]);
    expect(p.at(-1)).toEqual([2, 2]);
    for (let k = 1; k < p.length; k++) {
      const [i0, j0] = p[k - 1], [i1, j1] = p[k];
      expect(cellH(i1, j1)).toBeGreaterThan(0);
      if (i0 !== i1 && j0 !== j1) {
        expect(cellH(i1, j0)).toBeGreaterThan(0);
        expect(cellH(i0, j1)).toBeGreaterThan(0);
      }
    }
  });

  it('nie wchodzi na zbyt wysoki stopień', () => {
    const { size, cellH } = gridFrom(['1#9', '1#9', '119']);
    expect(findPath(cellH, 0, 0, 2, 0, { size, maxStep: 3 })).toBeNull();
    expect(findPath(cellH, 0, 0, 2, 0, { size, maxStep: 8 })).not.toBeNull();
  });

  it('zwraca null, gdy cel jest odcięty', () => {
    const { size, cellH } = gridFrom(['..#.', '..#.', '###.', '....']);
    expect(findPath(cellH, 0, 0, 3, 0, { size })).toBeNull();
  });
});

describe('nearestWalkable', () => {
  it('znajduje najbliższą przechodnią komórkę', () => {
    const { cellH } = gridFrom(['###', '###', '##.']);
    expect(nearestWalkable(cellH, 0, 0)).toEqual([2, 2]);
    expect(nearestWalkable(cellH, 0, 0, 2)).toBeNull();
  });
});

describe('smoothPath', () => {
  it('na otwartym terenie zostaje start i cel (bez zygzaków)', async () => {
    const { smoothPath } = await import('../src/logic/pathfinding');
    const { size, cellH } = gridFrom(['......', '......', '......', '......', '......', '......']);
    const p = findPath(cellH, 0, 0, 5, 2, { size })!;
    expect(smoothPath(cellH, p)).toEqual([[0, 0], [5, 2]]);
  });
  it('nie przechodzi przez ścianę ani nie ścina narożnika', async () => {
    const { smoothPath } = await import('../src/logic/pathfinding');
    const { size, cellH } = gridFrom(['......', '.####.', '......', '......']);
    const p = smoothPath(cellH, findPath(cellH, 0, 0, 3, 2, { size })!);
    for (let k = 1; k < p.length; k++) {
      const [i0, j0] = p[k - 1], [i1, j1] = p[k];
      for (let s = 0; s <= 20; s++) {
        const x = i0 + 0.5 + ((i1 - i0) * s) / 20, y = j0 + 0.5 + ((j1 - j0) * s) / 20;
        expect(cellH(Math.floor(x), Math.floor(y))).toBeGreaterThan(0);
      }
    }
    expect(p.length).toBeLessThan(5);
  });
});
