export function allocate(total: number, weights: readonly number[]): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) return weights.map((_, index) => (index === 0 ? total : 0));
  const exact = weights.map((weight) => (total * weight) / sum);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    remainder -= 1;
  }
  return floors;
}

export function fitTotal(values: readonly number[], target: number): number[] {
  const result = [...values];
  if (result.length === 0) return result;
  let gap = target - result.reduce((acc, value) => acc + value, 0);
  const step = gap > 0 ? 1 : -1;
  for (let cursor = 0; gap !== 0; cursor = (cursor + 1) % result.length) {
    result[cursor] = (result[cursor] ?? 0) + step;
    gap -= step;
  }
  return result;
}
