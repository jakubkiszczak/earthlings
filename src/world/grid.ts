// Siatka chodzenia (walk.png), mapa wyboru (pick.png) i przeliczanie świat ↔ ekran.
import { readPixels } from '../assets';
import { findPath, nearestWalkable, smoothPath } from '../logic/pathfinding';
import type { CellMeta } from '../types';
import { rotLocal } from './view';

export class WorldGrid {
  private readonly walk: Uint8ClampedArray;
  private readonly pick: Uint8ClampedArray;

  constructor(private readonly M: CellMeta, walkImg: HTMLImageElement, pickImg: HTMLImageElement) {
    this.walk = readPixels(walkImg);
    this.pick = readPixels(pickImg);
  }

  /** wysokość komórki + 1; 0 = nieprzechodnia */
  cellH = (ci: number, cj: number): number => {
    const NC = this.M.NC;
    return ci < 0 || cj < 0 || ci >= NC || cj >= NC ? 0 : this.walk[(cj * NC + ci) * 4];
  };

  cellOf(u: number, v: number): [number, number] {
    const { OFF, CELL } = this.M;
    return [Math.floor((u + OFF) / CELL), Math.floor((v + OFF) / CELL)];
  }

  cellCenter(i: number, j: number): [number, number] {
    const { OFF, CELL } = this.M;
    return [i * CELL + CELL / 2 - OFF, j * CELL + CELL / 2 - OFF];
  }

  heightAt(u: number, v: number): number {
    const h = this.cellH(...this.cellOf(u, v));
    return h ? h - 1 : 0;
  }

  /** współrzędne świata (u, v) → piksele obrazu świata */
  toScreen(u: number, v: number, exact = false): [number, number] {
    return this.toScreenAt(u, v, this.heightAt(u, v), exact);
  }

  /** jak toScreen, ale z podaną wysokością (dla punktów poza siatką chodzenia) */
  toScreenAt(u: number, v: number, h: number, exact = false): [number, number] {
    const [p, q] = rotLocal(u, v, this.M.size, this.M.rot ?? 0);      // obraz komórki w bieżącym widoku
    const y = (p + q) / 2;
    return [p - q + this.M.X0, (exact ? y : Math.floor(y)) - h + this.M.Y0];
  }

  /** piksel obrazu świata → punkt (u, v) z mapy wyboru, albo null (puste tło) */
  pickAt(wx: number, wy: number): [number, number] | null {
    const { W, H, OFF } = this.M;
    if (wx < 0 || wy < 0 || wx >= W || wy >= H) return null;
    const o = (wy * W + wx) * 4;
    const val = (this.pick[o] << 16) | (this.pick[o + 1] << 8) | this.pick[o + 2];
    if (val === 0xffffff) return null;
    return [(val >> 11) - OFF, (val & 2047) - OFF];
  }

  /** ścieżka (w punktach świata, bez punktu startu) z (u, v) do celu (tu, tv) */
  pathTo(u: number, v: number, tu: number, tv: number): [number, number][] | null {
    const target = nearestWalkable(this.cellH, ...this.cellOf(tu, tv));
    if (!target) return null;
    // start z najbliższej przechodniej komórki (np. postać zapisana w miejscu, gdzie teraz stoi donica)
    const start = nearestWalkable(this.cellH, ...this.cellOf(u, v));
    if (!start) return null;
    const p = findPath(this.cellH, start[0], start[1], target[0], target[1], { size: this.M.NC });
    return p ? smoothPath(this.cellH, p).slice(1).map(([i, j]) => this.cellCenter(i, j)) : null;
  }
}
