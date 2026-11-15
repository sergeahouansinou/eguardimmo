import type { AuditEvent, AuditType } from '../schemas/audit';
import type { Clock } from './clock';

export interface Operator {
  id: string;
  name: string;
  role: string;
  origin: string;
  device: string;
}

export const CURRENT_OPERATOR: Operator = {
  id: 'lucas-bernard',
  name: 'Lucas Bernard',
  role: 'Opérateur',
  origin: '81.250.xx.xx',
  device: 'Chrome, macOS',
};

export interface AuditDraft {
  type: AuditType;
  title: string;
  context: string;
  action: string;
  organisationId?: string | null;
  organisationName?: string | null;
  resource?: string | null;
  module?: string | null;
  request?: string | null;
  before?: Record<string, string> | null;
  after?: Record<string, string> | null;
  justified?: boolean;
  actor?: { name: string; role: string };
  origin?: string;
  session?: string;
}

export interface AuditLog {
  events: AuditEvent[];
  record: (draft: AuditDraft) => AuditEvent;
}

function hashText(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b + code, 0x85ebca6b) >>> 0;
    b ^= b >>> 13;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

export function chainHash(previousHash: string, event: Pick<AuditEvent, 'reference' | 'at' | 'actor' | 'type' | 'title' | 'context'>): string {
  return hashText(`${previousHash}|${event.reference}|${event.at}|${event.actor.name}|${event.type}|${event.title}|${event.context}`);
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

export function createAuditLog(seed: AuditEvent[], clock: Clock, operator: Operator = CURRENT_OPERATOR): AuditLog {
  const events = [...seed];
  let sequence = Math.max(204_518, ...events.map((event) => Number(event.reference.slice(-6)))) + 1;
  return {
    events,
    record(draft) {
      const at = clock().toISOString();
      const reference = `EVT-2026-${String(sequence).padStart(6, '0')}`;
      sequence += 1;
      const previous = events.at(-1);
      const previousHash = previous?.hash ?? '0000000000000000';
      const base = {
        reference,
        at,
        actor: draft.actor ?? { name: operator.name, role: operator.role },
        type: draft.type,
        title: draft.title,
        context: draft.context,
      };
      const event: AuditEvent = {
        id: reference.toLowerCase(),
        ...base,
        origin: draft.origin ?? operator.origin,
        organisationId: draft.organisationId ?? null,
        organisationName: draft.organisationName ?? null,
        resource: draft.resource ?? null,
        module: draft.module ?? null,
        request: draft.request ?? null,
        action: draft.action,
        before: draft.before ?? null,
        after: draft.after ?? null,
        device: operator.device,
        session: draft.session ?? 'Double authentification validée',
        justified: draft.justified ?? false,
        hash: chainHash(previousHash, base),
        previousHash,
      };
      events.push(event);
      return event;
    },
  };
}
