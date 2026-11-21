export const IDS = {
  org: '0198a0a0-0000-7000-8000-000000000001',
  entry: '0198b000-0000-7000-8000-000000000001',
  entryTwo: '0198b000-0000-7000-8000-000000000002',
  entryThree: '0198b000-0000-7000-8000-000000000003',
  member: '0198a0a0-0000-7000-8000-0000000000a1',
  lease: '0198c000-0000-7000-8000-000000000001',
  party: '0198c000-0000-7000-8000-000000000002',
  task: '0198c000-0000-7000-8000-000000000003',
  unknownSubject: '0198c000-0000-7000-8000-000000000004',
} as const;

const actor = { kind: 'member', id: IDS.member, name: 'Camille Martin', active: true };

export const row = {
  id: IDS.entry,
  occurred_at: '2026-03-14T09:30:00+00:00',
  type: 'paiement',
  label: 'Enregistrement d\'un paiement de loyer',
  action: 'rent.payment.recorded',
  actor,
  subject: { type: 'lease', id: IDS.lease },
  ip: '203.0.113.0/24',
  device: 'Chrome sur macOS',
};

export const rowSystem = {
  id: IDS.entryTwo,
  occurred_at: '2026-03-29T01:30:00+00:00',
  type: 'autre',
  label: 'Rappels recalculés après un changement de fuseau',
  action: 'planning.reminders.recomputed',
  actor: { kind: 'system', id: null, name: null, active: null },
  subject: null,
  ip: null,
  device: null,
};

export const rowDeletedAuthor = {
  id: IDS.entryThree,
  occurred_at: '2026-03-10T08:00:00+00:00',
  type: 'droits',
  label: 'Modification d\'un membre de l\'équipe',
  action: 'organization_member.updated',
  actor: { kind: 'member', id: IDS.member, name: 'Alex Dupont', active: false },
  subject: { type: 'organization_member', id: IDS.unknownSubject },
  ip: '2001:db8:1::/48',
  device: 'Application mobile',
};

export const historyRow = {
  id: IDS.entry,
  occurred_at: '2026-03-14T09:30:00+00:00',
  type: 'autre',
  label: 'Modification de bail',
  actor,
  subject: { type: 'lease', id: IDS.lease },
};

export const detail = {
  ...row,
  reference: 'REQ-4242',
  changes: { status: { old: 'draft', new: 'sent' }, amount: { old: 12000, new: null }, '<b>champ</b>': { old: '<script>alert(1)</script>', new: ['a', 'b'] } },
  metadata: { rows: 12, from: '2026-01-01', dry_run: false },
};

export const detailEmpty = { ...rowSystem, ip: null, device: null, reference: null, changes: {}, metadata: {} };

export const page = (rows: readonly object[], next: string | null = null) => ({ data: rows, meta: { has_more: next !== null, next_cursor: next } });
