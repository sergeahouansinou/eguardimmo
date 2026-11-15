import type { Receipt } from './schemas';

type Sealable = Pick<Receipt, 'number' | 'tenantId' | 'month' | 'rent' | 'charges' | 'issuedOn'>;

export function receiptCanonical(receipt: Sealable): string {
  return JSON.stringify([receipt.number, receipt.tenantId, receipt.month, receipt.rent, receipt.charges, receipt.issuedOn]);
}

export async function receiptFingerprint(receipt: Sealable): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(receiptCanonical(receipt)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyReceiptFingerprint(receipt: Receipt): Promise<boolean> {
  if (receipt.fingerprint === null || receipt.number === null) return false;
  return (await receiptFingerprint(receipt)) === receipt.fingerprint;
}

export const shortFingerprint = (hash: string): string => `${hash.slice(0, 4)}…${hash.slice(-4)}`;
