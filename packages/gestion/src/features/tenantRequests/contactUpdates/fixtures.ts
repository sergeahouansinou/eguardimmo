import { IDS } from '../testing/fixtures';

export const UPDATE_IDS = {
  pending: '01934f6e-0000-7000-8000-000000000701',
  applied: '01934f6e-0000-7000-8000-000000000702',
  dismissed: '01934f6e-0000-7000-8000-000000000703',
} as const;

export const updatePending = {
  id: UPDATE_IDS.pending,
  party_id: IDS.partyAwa,
  status: 'pending',
  email: 'awa.diallo@example.test',
  phone: '+33612345678',
  requested_at: '2026-11-16T09:30:00+00:00',
  decided_at: null,
};

export const updateApplied = { ...updatePending, id: UPDATE_IDS.applied, status: 'applied', email: null, phone: null, decided_at: '2026-11-17T10:00:00+00:00' };
export const updateDismissed = { ...updateApplied, id: UPDATE_IDS.dismissed, status: 'dismissed' };
