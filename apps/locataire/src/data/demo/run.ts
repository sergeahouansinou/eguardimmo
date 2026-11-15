export function run<T>(task: () => T): Promise<T> {
  try {
    return Promise.resolve(structuredClone(task()));
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error('Erreur inconnue'));
  }
}

export function pad4(value: number): string {
  return String(value).padStart(4, '0');
}
