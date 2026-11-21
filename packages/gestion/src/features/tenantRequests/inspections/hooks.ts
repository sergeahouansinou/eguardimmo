'use client';

import { useGuardedQuery, useScopedMutation } from '../shared/hooks';
import type { InspectionChanges, InspectionInput, RemarkAnswer } from './model';
import { useInspectionsSource } from './source';

export function useInspections(leaseId: string | null, cursor: string | null) {
  const source = useInspectionsSource();
  return useGuardedQuery(['inspections', leaseId ?? '', cursor], () => source.list(leaseId ?? '', cursor), { enabled: leaseId !== null && leaseId !== '' });
}

export function useInspection(id: string) {
  const source = useInspectionsSource();
  return useGuardedQuery(['inspection', id], () => source.get(id));
}

export function useInspectionRemarks(id: string, cursor: string | null) {
  const source = useInspectionsSource();
  return useGuardedQuery(['inspection-remarks', id, cursor], () => source.remarks(id, cursor));
}

export function useRemarkPhoto(fileId: string) {
  const source = useInspectionsSource();
  return useGuardedQuery(['inspection-photo', fileId], () => source.downloadPhoto(fileId));
}

export function useCreateInspection() {
  const source = useInspectionsSource();
  return useScopedMutation(({ leaseId, input }: { leaseId: string; input: InspectionInput }) => source.create(leaseId, input));
}

export function useUpdateInspection() {
  const source = useInspectionsSource();
  return useScopedMutation(({ id, lockVersion, changes }: { id: string; lockVersion: number; changes: InspectionChanges }) => source.update(id, lockVersion, changes));
}

export function usePublishInspection() {
  const source = useInspectionsSource();
  return useScopedMutation((id: string) => source.publish(id));
}

export function useAnswerRemark() {
  const source = useInspectionsSource();
  return useScopedMutation(({ remarkId, answer, body }: { remarkId: string; answer: RemarkAnswer; body: string }) => source.answer(remarkId, answer, body));
}
