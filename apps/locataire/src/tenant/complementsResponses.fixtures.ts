import { LEASE_ID, ORG_PORT } from './responses.fixtures';

export { LEASE_ID, ORG_PORT };

export const ID = {
  submission: '0193a5e4-0000-7000-8000-000000000001',
  submission2: '0193a5e4-0000-7000-8000-000000000002',
  document: '0193a5e5-0000-7000-8000-000000000001',
  notice: '0193a5e6-0000-7000-8000-000000000001',
  inspectionEntry: '0193a5e7-0000-7000-8000-000000000001',
  inspectionExit: '0193a5e7-0000-7000-8000-000000000002',
  remark: '0193a5e8-0000-7000-8000-000000000001',
  photo: '0193a5e8-0000-7000-8000-0000000000a1',
  installment1: '0193a5e9-0000-7000-8000-000000000001',
  installment2: '0193a5e9-0000-7000-8000-000000000002',
  payment: '0193a5ea-0000-7000-8000-000000000001',
  contactUpdate: '0193a5eb-0000-7000-8000-000000000001',
} as const;

export function page(items: unknown[], nextCursor: string | null = null) {
  return { data: items, links: { first: null, last: null, prev: null, next: null }, meta: { path: 'http://localhost/x', per_page: 25, next_cursor: nextCursor, prev_cursor: null } };
}

export function submission(overrides: Record<string, unknown> = {}) {
  return {
    id: ID.submission,
    status: 'pending',
    insurer: 'Mutuelle Horizon',
    policy_number: 'HAB-2027-48213',
    starts_on: '2026-11-01',
    ends_on: '2027-10-31',
    rejection_reason: null,
    note: null,
    created_at: '2026-11-10T09:30:00+00:00',
    decided_at: null,
    ...overrides,
  };
}

export function insurance(state: 'valid' | 'expiring' | 'missing', submissions: unknown[] = [], endsOn: string | null = null) {
  return { data: { coverage: { state, ends_on: endsOn }, submissions } };
}

export function leaseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: ID.document,
    kind: 'diagnostic',
    shared_at: '2026-01-05T10:00:00+00:00',
    file: { name: 'Diagnostic énergétique.pdf', mime_type: 'application/pdf', size_bytes: 204800 },
    ...overrides,
  };
}

export function noticeOptions(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      available: true,
      unavailable_reason: null,
      reasons: [
        { key: 'standard', label: 'Préavis standard', months: 3, proof_required: false, earliest_departure_on: '2027-02-20' },
        { key: 'job_loss', label: 'Perte d’emploi', months: 1, proof_required: true, earliest_departure_on: '2026-12-20' },
      ],
      consent: { version: '2026-11-v1', text: 'Je demande à mon agence de prendre acte de mon congé et d’en accuser réception.' },
      legal_notice: 'Le préavis court du jour de la réception ou de la remise du congé.',
      to_confirm: true,
      ...overrides,
    },
  };
}

export function noticeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: ID.notice,
    lease_id: LEASE_ID,
    status: 'submitted',
    reason_key: 'standard',
    requested_departure_on: '2027-02-28',
    earliest_departure_on: '2027-02-20',
    departure_is_indicative: true,
    received_on: null,
    has_proof: false,
    has_letter: true,
    forwarding_address: null,
    acknowledgement_overdue: false,
    closed_outcome: null,
    created_at: '2026-11-20T10:00:00+00:00',
    acknowledged_at: null,
    withdrawn_at: null,
    closed_at: null,
    ...overrides,
  };
}

export function inspection(overrides: Record<string, unknown> = {}) {
  return {
    id: ID.inspectionEntry,
    lease_id: LEASE_ID,
    kind: 'entry',
    performed_on: '2026-01-02',
    performed_by: 'agent',
    signatories: [{ name: 'Awa Koné', capacity: 'Locataire', date: '2026-01-02' }],
    exit_matches_entry: null,
    open_remark_kinds: ['heating', 'comment'],
    published_at: '2026-01-03T08:00:00+00:00',
    ...overrides,
  };
}

export function remark(overrides: Record<string, unknown> = {}) {
  return {
    id: ID.remark,
    inspection_id: ID.inspectionEntry,
    kind: 'heating',
    body: 'Le radiateur du salon ne chauffe pas.',
    status: 'open',
    answer: null,
    photos: [{ id: ID.photo, position: 0 }],
    created_at: '2026-11-18T14:00:00+00:00',
    ...overrides,
  };
}

export function paymentOptions(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      available: true,
      unavailable_reason: null,
      methods: ['card'],
      installments: [
        { id: ID.installment1, due_date: '2026-10-05', remaining: { amount: 65000, currency: 'EUR' } },
        { id: ID.installment2, due_date: '2026-11-05', remaining: { amount: 35000, currency: 'EUR' } },
      ],
      total: { amount: 100000, currency: 'EUR' },
      ...overrides,
    },
  };
}

export function onlinePayment(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: ID.payment,
      lease_id: LEASE_ID,
      status: 'pending',
      method: 'card',
      amount: { amount: 100000, currency: 'EUR' },
      installment_ids: [ID.installment1, ID.installment2],
      redirect_url: `https://pay.fake.invalid/checkout/${ID.payment}`,
      failure_code: null,
      created_at: '2026-11-20T10:00:00+00:00',
      confirmed_at: null,
      ...overrides,
    },
  };
}

export function profile(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: '0193a5e3-0000-7000-8000-000000000001',
      name: 'Awa Koné',
      email: 'awa.kone@example.test',
      email_verified_at: '2026-01-02T08:00:00+00:00',
      phone: '+33612345678',
      last_login_at: null,
      previous_login_at: null,
      ...overrides,
    },
  };
}

export function contactUpdate(overrides: Record<string, unknown> = {}) {
  return {
    id: ID.contactUpdate,
    organization_id: ORG_PORT.id,
    status: 'pending',
    created_at: '2026-11-19T09:00:00+00:00',
    decided_at: null,
    ...overrides,
  };
}

export function problem(status: number, code: string, detail: string) {
  return { type: `https://eguardimmo.test/problems/${code}`, title: detail, status, code, detail };
}
