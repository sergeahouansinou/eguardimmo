import { IDS } from '../testing/fixtures';

export const NOTICE_IDS = {
  submitted: '01934f6e-0000-7000-8000-000000000401',
  acknowledged: '01934f6e-0000-7000-8000-000000000402',
  closed: '01934f6e-0000-7000-8000-000000000403',
} as const;

export const noticeRow = {
  id: NOTICE_IDS.submitted,
  lease_id: IDS.lease,
  party_id: IDS.partyAwa,
  status: 'submitted',
  reason_key: 'transfer',
  requested_departure_on: '2027-02-28',
  earliest_departure_on: '2027-02-16',
  received_on: null,
  has_proof: true,
  letter_document_id: '01934f6e-0000-7000-8000-000000000411',
  letter_file_id: '01934f6e-0000-7000-8000-000000000412',
  letter_fingerprint: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  forwarding_address: '12 rue des Fleurs, 69003 Lyon',
  consent_version: '2026-11',
  acknowledged_by_user_id: null,
  acknowledged_at: null,
  withdrawn_at: null,
  closed_outcome: null,
  closed_at: null,
  late_flagged_at: null,
  created_at: '2026-11-16T09:30:00+00:00',
};

export const noticeLate = { ...noticeRow, id: NOTICE_IDS.acknowledged, party_id: IDS.partyMarc, late_flagged_at: '2026-11-19T08:00:00+00:00' };

export const noticeAcknowledged = {
  ...noticeRow,
  status: 'acknowledged',
  received_on: '2026-11-17',
  earliest_departure_on: '2027-02-17',
  acknowledged_by_user_id: IDS.user,
  acknowledged_at: '2026-11-17T10:00:00+00:00',
};

export const noticeClosed = { ...noticeAcknowledged, id: NOTICE_IDS.closed, status: 'closed', closed_outcome: 'recorded', closed_at: '2026-11-18T10:00:00+00:00' };
