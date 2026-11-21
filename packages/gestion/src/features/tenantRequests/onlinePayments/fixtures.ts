import { IDS } from '../testing/fixtures';

export const PAYMENT_IDS = {
  succeeded: '01934f6e-0000-7000-8000-000000000601',
  failed: '01934f6e-0000-7000-8000-000000000602',
  pending: '01934f6e-0000-7000-8000-000000000603',
  installment: '01934f6e-0000-7000-8000-000000000611',
} as const;

export const paymentSucceeded = {
  id: PAYMENT_IDS.succeeded,
  lease_id: IDS.lease,
  party_id: IDS.partyAwa,
  status: 'succeeded',
  method: 'card',
  amount: { amount: 85000, currency: 'EUR' },
  installment_ids: [PAYMENT_IDS.installment],
  provider: 'fake',
  provider_reference: 'pi_fake_4821',
  failure_code: null,
  created_by_user_id: IDS.user,
  created_at: '2026-11-16T09:30:00+00:00',
  confirmed_at: '2026-11-16T09:31:12+00:00',
};

export const paymentFailed = {
  ...paymentSucceeded,
  id: PAYMENT_IDS.failed,
  party_id: IDS.partyMarc,
  status: 'failed',
  method: 'direct_debit',
  provider_reference: 'pi_fake_4822',
  failure_code: 'card_declined',
  confirmed_at: null,
};

export const paymentPending = {
  ...paymentSucceeded,
  id: PAYMENT_IDS.pending,
  status: 'pending',
  provider_reference: null,
  confirmed_at: null,
};

export const accountReady = { provider: 'fake', status: 'ready', ready: true, onboarded_at: '2026-10-01T08:00:00+00:00', onboarding_url: null };
export const accountPending = { provider: 'fake', status: 'pending', ready: false, onboarded_at: null, onboarding_url: null };
export const onboardingResult = { ...accountPending, onboarding_url: 'https://connect.example.test/onboarding/abc' };
