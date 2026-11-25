export function newClientId(): string {
  return globalThis.crypto.randomUUID();
}
