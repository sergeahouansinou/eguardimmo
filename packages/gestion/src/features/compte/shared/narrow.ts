export function narrow<T extends string>(candidates: readonly T[], value: string): T | undefined {
  return candidates.find((candidate): candidate is T => candidate === value);
}
