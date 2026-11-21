export function itemPath<K extends string>(index: number, key: K): `items.${number}.${K}` {
  return `items.${String(index)}.${key}` as `items.${number}.${K}`;
}

export function sourcePath<K extends string>(index: number, source: number, key: K): `items.${number}.sources.${number}.${K}` {
  return `items.${String(index)}.sources.${String(source)}.${key}` as `items.${number}.sources.${number}.${K}`;
}

export function consumptionPath<K extends string>(index: number, row: number, key: K): `items.${number}.consumptions.${number}.${K}` {
  return `items.${String(index)}.consumptions.${String(row)}.${key}` as `items.${number}.consumptions.${number}.${K}`;
}

export function weightPath(index: number): `weights.${number}.weight` {
  return `weights.${String(index)}.weight` as `weights.${number}.weight`;
}
