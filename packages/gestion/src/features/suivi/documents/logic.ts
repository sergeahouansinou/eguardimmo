import { bienShort } from '../shared/biens';
import { compareText } from '../shared/text';
import type { DocumentRecord } from './schemas';

export type SortKey = 'fileName' | 'bien' | 'size' | 'date';

export function compareDocuments(key: SortKey, a: DocumentRecord, b: DocumentRecord): number {
  switch (key) {
    case 'fileName':
      return compareText(a.fileName, b.fileName);
    case 'bien':
      return compareText(a.bienId ? bienShort(a.bienId) : '', b.bienId ? bienShort(b.bienId) : '');
    case 'size':
      return a.sizeBytes - b.sizeBytes;
    case 'date':
      return a.date.localeCompare(b.date);
  }
}
