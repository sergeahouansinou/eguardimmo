import { IDS } from '../testing/fixtures';

export const SUBMISSION_IDS = {
  pending: '01934f6e-0000-7000-8000-000000000501',
  rejected: '01934f6e-0000-7000-8000-000000000502',
  accepted: '01934f6e-0000-7000-8000-000000000503',
  file: '01934f6e-0000-7000-8000-000000000511',
  certificate: '01934f6e-0000-7000-8000-000000000521',
} as const;

export const submissionPending = {
  id: SUBMISSION_IDS.pending,
  lease_id: IDS.lease,
  party_id: IDS.partyAwa,
  stored_file_id: SUBMISSION_IDS.file,
  insurer: 'MAIF',
  policy_number: 'POL-884201',
  starts_on: '2026-11-01',
  ends_on: '2027-10-31',
  status: 'pending',
  rejection_reason: null,
  note: null,
  decided_by_user_id: null,
  decided_at: null,
  certificate_id: null,
  created_at: '2026-11-16T09:30:00+00:00',
};

export const submissionRejected = {
  ...submissionPending,
  id: SUBMISSION_IDS.rejected,
  party_id: IDS.partyMarc,
  status: 'rejected',
  rejection_reason: 'unreadable',
  note: 'La page 2 est coupée.',
  decided_by_user_id: IDS.user,
  decided_at: '2026-11-17T10:00:00+00:00',
};

export const submissionAccepted = {
  ...submissionPending,
  id: SUBMISSION_IDS.accepted,
  status: 'accepted',
  decided_by_user_id: IDS.user,
  decided_at: '2026-11-17T10:00:00+00:00',
  certificate_id: SUBMISSION_IDS.certificate,
};

export const overview = {
  coverage: { state: 'expiring', ends_on: '2026-12-15' },
  submissions: [submissionPending, submissionRejected],
};
