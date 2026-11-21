'use client';

import { useGuardedQuery, useScopedMutation } from '../shared/hooks';
import type { InsuranceQuery, RejectionReason } from './model';
import { useInsuranceSource } from './source';

export function useInsuranceSubmissions(query: InsuranceQuery) {
  const source = useInsuranceSource();
  return useGuardedQuery(['insurance', query], () => source.list(query));
}

export function useLeaseInsurance(leaseId: string, enabled = true) {
  const source = useInsuranceSource();
  return useGuardedQuery(['insurance-lease', leaseId], () => source.overview(leaseId), { enabled });
}

export function useAttestation(submissionId: string) {
  const source = useInsuranceSource();
  return useGuardedQuery(['attestation', submissionId], () => source.downloadAttestation(submissionId));
}

export function useAcceptInsurance() {
  const source = useInsuranceSource();
  return useScopedMutation((id: string) => source.accept(id));
}

export function useRejectInsurance() {
  const source = useInsuranceSource();
  return useScopedMutation(({ id, reason, note }: { id: string; reason: RejectionReason; note: string | null }) => source.reject(id, reason, note));
}

export function useRemindLease() {
  const source = useInsuranceSource();
  return useScopedMutation((leaseId: string) => source.remind(leaseId));
}
