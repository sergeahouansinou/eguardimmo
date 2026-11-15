'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { locatairesKeys } from '../locataires/hooks';
import { useClientQuery } from '../locataires/kit/query';
import { useLocatairesSource } from '../locataires/source';
import {
  attestationSchema,
  edlSchema,
  edlTemplateSchema,
  exitSchema,
  installmentSchema,
  leaseExtrasSchema,
  leaseSchema,
  reservationSchema,
} from './schemas';
import type { EdlInput, EdlStatus, ExitStep, LeaseInput, NoticeInput, ReservationInput, SurveyRoom } from './schemas';
import type { LeaseImportRow } from './leaseImportSchema';
import { useBauxSource } from './source';
import type { ReturnContext } from './source';

export const bauxKeys = {
  all: ['gestion', 'baux'] as const,
  leases: ['gestion', 'baux', 'leases'] as const,
  installments: (id: string) => ['gestion', 'baux', 'installments', id] as const,
  extras: (id: string) => ['gestion', 'baux', 'extras', id] as const,
  exits: ['gestion', 'baux', 'exits'] as const,
  edls: ['gestion', 'baux', 'edls'] as const,
  edlTemplates: ['gestion', 'baux', 'edl-templates'] as const,
  reservations: ['gestion', 'baux', 'reservations'] as const,
  attestations: ['gestion', 'baux', 'attestations'] as const,
};

export function useLeases() {
  const source = useBauxSource();
  return useClientQuery(bauxKeys.leases, () => source.leases(), z.array(leaseSchema));
}

export function useInstallments(leaseId: string) {
  const source = useBauxSource();
  return useClientQuery(bauxKeys.installments(leaseId), () => source.installments(leaseId), z.array(installmentSchema));
}

export function useLeaseExtras(leaseId: string) {
  const source = useBauxSource();
  return useClientQuery(bauxKeys.extras(leaseId), () => source.extras(leaseId), leaseExtrasSchema);
}

export function useExits() {
  const source = useBauxSource();
  return useClientQuery(bauxKeys.exits, () => source.exits(), z.array(exitSchema));
}

export function useEdls() {
  const source = useBauxSource();
  return useClientQuery(bauxKeys.edls, () => source.edls(), z.array(edlSchema));
}

export function useEdlTemplates() {
  const source = useBauxSource();
  return useClientQuery(bauxKeys.edlTemplates, () => source.edlTemplates(), z.array(edlTemplateSchema));
}

export function useReservations() {
  const source = useBauxSource();
  return useClientQuery(bauxKeys.reservations, () => source.reservations(), z.array(reservationSchema));
}

export function useAttestations() {
  const source = useBauxSource();
  return useClientQuery(bauxKeys.attestations, () => source.attestations(), z.array(attestationSchema));
}

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: bauxKeys.all });
}

export function useCreateLease() {
  const source = useBauxSource();
  const tenants = useLocatairesSource();
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: LeaseInput) => {
      const lease = leaseSchema.parse(await source.createLease(input));
      if (lease.status !== 'brouillon') await tenants.assignTenantUnit(lease.tenantIds, lease.unitId);
      return lease;
    },
    onSuccess: async () => {
      await invalidate();
      await client.invalidateQueries({ queryKey: locatairesKeys.all });
    },
  });
}

export function useUpdateLease(id: string) {
  const source = useBauxSource();
  const tenants = useLocatairesSource();
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: LeaseInput) => {
      const lease = leaseSchema.parse(await source.updateLease(id, input));
      if (lease.status !== 'brouillon') await tenants.assignTenantUnit(lease.tenantIds, lease.unitId);
      return lease;
    },
    onSuccess: async () => {
      await invalidate();
      await client.invalidateQueries({ queryKey: locatairesKeys.all });
    },
  });
}

export function useDuplicateLease() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => leaseSchema.parse(await source.duplicateLease(id)),
    onSuccess: invalidate,
  });
}

export function useDeleteLease() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => source.deleteLease(id), onSuccess: invalidate });
}

export function useArchiveLease() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => leaseSchema.parse(await source.setLeaseArchived(id, archived)),
    onSuccess: invalidate,
  });
}

export function useImportLeases() {
  const source = useBauxSource();
  const tenants = useLocatairesSource();
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (inputs: readonly LeaseImportRow[]) => {
      const created = z.array(leaseSchema).parse(await source.importLeases(inputs));
      for (const lease of created) {
        if (lease.status === 'en_cours' || lease.status === 'a_venir') await tenants.assignTenantUnit(lease.tenantIds, lease.unitId);
      }
      return created;
    },
    onSuccess: async () => {
      await invalidate();
      await client.invalidateQueries({ queryKey: locatairesKeys.all });
    },
  });
}

export function useRecordNotice(leaseId: string) {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: NoticeInput) => exitSchema.parse(await source.recordNotice(leaseId, input)),
    onSuccess: invalidate,
  });
}

export function useSetExitStep(leaseId: string) {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ stepId, status }: { stepId: string; status: ExitStep['status'] }) =>
      exitSchema.parse(await source.setExitStep(leaseId, stepId, status)),
    onSuccess: invalidate,
  });
}

export function useMarkReturned(leaseId: string) {
  const source = useBauxSource();
  const tenants = useLocatairesSource();
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (context: ReturnContext) => {
      const attestation = attestationSchema.parse(await source.markReturned(leaseId, context));
      const all = z.array(leaseSchema).parse(await source.leases());
      const closed = all.find((lease) => lease.id === leaseId);
      if (closed) {
        const otherLeaseOf = (tenantId: string) =>
          all.find((lease) => lease.id !== leaseId && lease.tenantIds.includes(tenantId) && (lease.status === 'en_cours' || lease.status === 'preavis' || lease.status === 'a_venir'));
        await tenants.releaseUnit(closed.unitId, closed.tenantIds.filter((tenantId) => !otherLeaseOf(tenantId)));
        for (const tenantId of closed.tenantIds) {
          const other = otherLeaseOf(tenantId);
          if (other) await tenants.assignTenantUnit([tenantId], other.unitId);
        }
      }
      return attestation;
    },
    onSuccess: async () => {
      await invalidate();
      await client.invalidateQueries({ queryKey: locatairesKeys.all });
    },
  });
}

export function useCreateEdl() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ input, asDraft }: { input: EdlInput; asDraft: boolean }) => edlSchema.parse(await source.createEdl(input, asDraft)),
    onSuccess: invalidate,
  });
}

export function useUpdateEdl(id: string) {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: EdlInput) => edlSchema.parse(await source.updateEdl(id, input)),
    onSuccess: invalidate,
  });
}

export function useSetEdlStatus() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EdlStatus }) => edlSchema.parse(await source.setEdlStatus(id, status)),
    onSuccess: invalidate,
  });
}

export function useArchiveEdl() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => edlSchema.parse(await source.setEdlArchived(id, archived)),
    onSuccess: invalidate,
  });
}

export function useDeleteEdl() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => source.deleteEdl(id), onSuccess: invalidate });
}

export function useCreateReservation() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (input: ReservationInput) => reservationSchema.parse(await source.createReservation(input)), onSuccess: invalidate });
}

export function useUpdateReservation(id: string) {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (input: ReservationInput) => reservationSchema.parse(await source.updateReservation(id, input)), onSuccess: invalidate });
}

export function useImportReservations() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (inputs: readonly ReservationInput[]) => z.array(reservationSchema).parse(await source.importReservations(inputs)),
    onSuccess: invalidate,
  });
}

export function useReservationMail() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: 'confirmation' | 'rappel' }) =>
      reservationSchema.parse(kind === 'confirmation' ? await source.sendReservationConfirmation(id) : await source.remindReservation(id)),
    onSuccess: invalidate,
  });
}

export function useReviseRent() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ leaseId, rent }: { leaseId: string; rent: string }) => leaseSchema.parse(await source.reviseRent(leaseId, rent)),
    onSuccess: invalidate,
  });
}

export function useSaveEdlSurvey(id: string) {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (survey: SurveyRoom[]) => edlSchema.parse(await source.saveEdlSurvey(id, survey)), onSuccess: invalidate });
}

export function usePrepareExitEdl() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => edlSchema.parse(await source.prepareExitEdl(id)), onSuccess: invalidate });
}

export function useReservationAction() {
  const source = useBauxSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'confirm' | 'cancel' | 'duplicate' }) => {
      const result =
        action === 'confirm' ? await source.confirmReservation(id) : action === 'cancel' ? await source.cancelReservation(id) : await source.duplicateReservation(id);
      return reservationSchema.parse(result);
    },
    onSuccess: invalidate,
  });
}
