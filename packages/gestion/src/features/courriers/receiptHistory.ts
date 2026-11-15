import { CURRENT_AUTHOR } from './author';
import type { ReceiptEvent } from './schemas';

export function emissionHistory(issuedOn: string | null, sentOn: string | null): ReceiptEvent[] {
  return [
    ...(issuedOn ? [{ type: 'emise' as const, on: issuedOn, by: CURRENT_AUTHOR, note: null }] : []),
    ...(sentOn ? [{ type: 'envoyee' as const, on: sentOn, by: CURRENT_AUTHOR, note: null }] : []),
  ];
}
