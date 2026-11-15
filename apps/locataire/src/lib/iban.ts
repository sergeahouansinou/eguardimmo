const LENGTHS: Readonly<Record<string, number>> = {
  FR: 27,
  BE: 16,
  DE: 22,
  ES: 24,
  IT: 27,
  CH: 21,
  LU: 20,
  PT: 25,
  NL: 18,
  BJ: 28,
  CI: 28,
  SN: 28,
  TG: 28,
  ML: 28,
  BF: 28,
};

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

function mod97(iban: string): number {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const char of rearranged) {
    const digits = String(Number.parseInt(char, 36));
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expected = LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return false;
  return mod97(iban) === 1;
}

export function ibanLast4(value: string): string {
  return normalizeIban(value).slice(-4);
}

export function maskIban(last4: string): string {
  return `•••• ${last4}`;
}
