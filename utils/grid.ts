export type GridCell = [row: number, col: number];

// murmur3 32-bit finalizer: a small change in id flips about half the output
// bits, including the low ones used for the modulo below.
function hashId(id: number): number {
  let h = id | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Assigns every item a unique grid cell, derived only from its id.
 *
 * Items are placed in ascending id order. Each starts at the cell given by a
 * hash of its id and, if that cell is taken, moves on to the next free one.
 * The result is pure (identical on server and client, so no hydration
 * mismatch), looks scattered, and an existing item's cell never changes when
 * newer items are added. Items beyond rows * cols are left without a cell.
 */
export function assignGridCells(
  ids: number[],
  rows: number,
  cols: number,
): Map<number, GridCell> {
  const totalCells = rows * cols;
  const taken = new Array<boolean>(totalCells).fill(false);
  const cells = new Map<number, GridCell>();

  const sortedIds = [...ids].sort((a, b) => a - b);
  for (const id of sortedIds) {
    if (cells.size >= totalCells) break;

    let index = hashId(id) % totalCells;
    while (taken[index]) {
      index = (index + 1) % totalCells;
    }
    taken[index] = true;
    cells.set(id, [Math.floor(index / cols), index % cols]);
  }

  return cells;
}
