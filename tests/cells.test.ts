import { describe, expect, it } from 'vitest';
import { cellStep, globalPos, toNeighbor } from '../src/logic/cells';

const S = 1280;

describe('cellStep', () => {
  it('w środku komórki nie ma przejścia', () => {
    expect(cellStep(1, 1, 0, 0, S, 3)).toBeNull();
    expect(cellStep(1, 1, S - 0.01, 640, S, 3)).toBeNull();
  });

  it('wyjście przez każdą krawędź miasta prowadzi do sąsiada', () => {
    expect(cellStep(1, 1, -1, 500, S, 3)).toEqual({ dx: -1, dy: 0 });
    expect(cellStep(1, 1, S, 500, S, 3)).toEqual({ dx: 1, dy: 0 });
    expect(cellStep(1, 1, 500, -0.5, S, 3)).toEqual({ dx: 0, dy: -1 });
    expect(cellStep(1, 1, 500, S + 3, S, 3)).toEqual({ dx: 0, dy: 1 });
  });

  it('przez róg przechodzi po skosie', () => {
    expect(cellStep(1, 1, -1, -1, S, 3)).toEqual({ dx: -1, dy: -1 });
  });

  it('nie wychodzi poza świat', () => {
    expect(cellStep(0, 0, -1, 100, S, 3)).toBeNull();
    expect(cellStep(2, 2, 100, S, S, 3)).toBeNull();
    expect(cellStep(2, 1, S + 1, 100, S, 3)).toBeNull();
  });
});

describe('toNeighbor / globalPos', () => {
  it('przelicza pozycję tak, że globalnie punkt się nie zmienia', () => {
    const step = cellStep(1, 1, S + 7, 300, S, 3)!;
    const [u, v] = toNeighbor(S + 7, 300, step, S);
    expect([u, v]).toEqual([7, 300]);
    expect(globalPos(2, 1, u, v, S)).toEqual(globalPos(1, 1, S + 7, 300, S));
  });
});
