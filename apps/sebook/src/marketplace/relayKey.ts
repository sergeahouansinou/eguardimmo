const MIN_LENGTH = 32;

export function relayKey(source: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const key = source.SEBOOK_RELAY_KEY ?? "";
  if (key.length >= MIN_LENGTH) return key;
  if (key === "" && source.NODE_ENV !== "production") return null;
  throw new Error(`SEBOOK_RELAY_KEY doit faire au moins ${String(MIN_LENGTH)} caractères (obligatoire en production).`);
}
