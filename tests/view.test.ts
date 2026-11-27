import { describe, expect, it } from 'vitest';
import { rotCell, rotLocal, rotVec, unrotVec } from '../src/world/view';

// Obrót widoku musi zgadzać się z generatorem (tools/worldgen.py: rot_pt): punkt globalny g = komórka·C + lokalny.
const C = 1280, GRID = 3, G1 = GRID * C - 1;
const rotPt = (u: number, v: number, r: number): [number, number] => [[u, v], [v, G1 - u], [G1 - u, G1 - v], [G1 - v, u]][r] as [number, number];

describe('obrót widoku', () => {
  it('lokalny obrót komórki = obrót globalny minus początek obróconej komórki', () => {
    for (let r = 0; r < 4; r++) for (const [cx, cy] of [[0, 0], [1, 2], [2, 1]]) for (const [u, v] of [[0, 0], [10, 900], [1279, 5]]) {
      const [P, Q] = rotPt(cx * C + u, cy * C + v, r);
      const [rcx, rcy] = rotCell(cx, cy, GRID, r);
      expect(rotLocal(u, v, C, r)).toEqual([P - rcx * C, Q - rcy * C]);
    }
  });
  it('wektor: obrót i powrót, zgodność z różnicą punktów', () => {
    for (let r = 0; r < 4; r++) {
      expect(unrotVec(...rotVec(3, -7, r), r)).toEqual([3, -7]);
      const a = rotPt(100, 200, r), b = rotPt(103, 193, r);
      expect(rotVec(3, -7, r)).toEqual([b[0] - a[0], b[1] - a[1]]);
    }
  });
});
