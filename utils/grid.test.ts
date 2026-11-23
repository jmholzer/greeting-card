import { describe, expect, it } from 'vitest';
import { assignGridCells } from '@/utils/grid';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('assignGridCells', () => {
  it('gives every id its own cell inside the grid', () => {
    const cells = assignGridCells(range(1, 10), 4, 4);
    expect(cells.size).toBe(10);
    const keys = [...cells.values()].map(([row, col]) => `${row},${col}`);
    expect(new Set(keys).size).toBe(10);
    for (const [row, col] of cells.values()) {
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(4);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(4);
    }
  });

  it('is deterministic and ignores input order', () => {
    expect(assignGridCells([3, 1, 2], 4, 4)).toEqual(assignGridCells([1, 2, 3], 4, 4));
  });

  it('keeps the cells of existing ids when newer ids are added', () => {
    const before = assignGridCells(range(1, 8), 4, 4);
    const after = assignGridCells(range(1, 14), 4, 4);
    for (const [id, cell] of before) expect(after.get(id)).toEqual(cell);
  });

  it('leaves ids beyond the grid size without a cell, oldest first', () => {
    const cells = assignGridCells(range(1, 20), 4, 4);
    expect(cells.size).toBe(16);
    expect([...cells.keys()].sort((a, b) => a - b)).toEqual(range(1, 16));
  });
});
