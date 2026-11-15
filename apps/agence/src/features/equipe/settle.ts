export function settle<T>(run: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      resolve(run());
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
