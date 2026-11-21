import type { ActivityDetail, ActivityEntry } from '../model';
import type { ApiEntryDetail, ApiEntryRow } from './schemas';

export const EMPTY_VALUE = 'vide';

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  if (typeof value === 'string') return value === '' ? EMPTY_VALUE : value;
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

export function toEntry(row: ApiEntryRow): ActivityEntry {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    type: row.type,
    label: row.label,
    actor: row.actor,
    subject: row.subject,
    action: row.action ?? null,
    ip: row.ip ?? null,
    device: row.device ?? null,
  };
}

export function toDetail(detail: ApiEntryDetail): ActivityDetail {
  return {
    ...toEntry(detail),
    action: detail.action,
    reference: detail.reference,
    changes: Object.entries(detail.changes).map(([field, change]) => ({ field, before: displayValue(change.old), after: displayValue(change.new) })),
    metadata: Object.entries(detail.metadata).map(([key, value]) => ({ key, value: displayValue(value) })),
  };
}
