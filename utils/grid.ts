export function randomGridPositions(rows: number, cols: number): [number, number][] {
  const totalPositions = rows * cols;
  const positions = Array.from({ length: totalPositions }, (_, i) => i);

  const shuffled = positions
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
    .slice(0, rows * cols);

  const gridPositions: [number, number][] = shuffled.map(index => [
    Math.floor(index / cols),
    index % cols
  ]);

  return gridPositions;
}