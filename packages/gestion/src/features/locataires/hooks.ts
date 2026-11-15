'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useClientQuery } from './kit/query';
import { candidateSchema, tenantDetailSchema, tenantSchema, unitSchema } from './schemas';
import type { CandidateInvite, CandidateStatus, TenantInput, TenantInvite } from './schemas';
import { useLocatairesSource } from './source';

export const locatairesKeys = {
  all: ['gestion', 'locataires'] as const,
  units: ['gestion', 'locataires', 'units'] as const,
  tenants: ['gestion', 'locataires', 'tenants'] as const,
  detail: (id: string) => ['gestion', 'locataires', 'detail', id] as const,
  candidates: ['gestion', 'locataires', 'candidates'] as const,
};

export function useUnits() {
  const source = useLocatairesSource();
  return useClientQuery(locatairesKeys.units, () => source.units(), z.array(unitSchema));
}

export function useTenants() {
  const source = useLocatairesSource();
  return useClientQuery(locatairesKeys.tenants, () => source.tenants(), z.array(tenantSchema));
}

export function useTenantDetail(id: string) {
  const source = useLocatairesSource();
  return useClientQuery(locatairesKeys.detail(id), () => source.tenantDetail(id), tenantDetailSchema.nullable());
}

export function useCandidates() {
  const source = useLocatairesSource();
  return useClientQuery(locatairesKeys.candidates, () => source.candidates(), z.array(candidateSchema));
}

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: locatairesKeys.all });
}

export function useCreateTenant() {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: TenantInput) => tenantSchema.parse(await source.createTenant(input)),
    onSuccess: invalidate,
  });
}

export function useUpdateTenant(id: string) {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: TenantInput) => tenantSchema.parse(await source.updateTenant(id, input)),
    onSuccess: invalidate,
  });
}

export function useArchiveTenant() {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      tenantSchema.parse(await source.setTenantArchived(id, archived)),
    onSuccess: invalidate,
  });
}

export function useDeleteTenant() {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => source.deleteTenant(id),
    onSuccess: invalidate,
  });
}

export function useInviteTenant() {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: TenantInvite) => tenantSchema.parse(await source.inviteTenant(input)),
    onSuccess: invalidate,
  });
}

export function useInvitePortal() {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => tenantSchema.parse(await source.invitePortal(id)),
    onSuccess: invalidate,
  });
}

export function useInviteCandidate() {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CandidateInvite) => candidateSchema.parse(await source.inviteCandidate(input)),
    onSuccess: invalidate,
  });
}

export function useSetCandidateStatus() {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CandidateStatus }) =>
      candidateSchema.parse(await source.setCandidateStatus(id, status)),
    onSuccess: invalidate,
  });
}

export function useConvertCandidate() {
  const source = useLocatairesSource();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => tenantSchema.parse(await source.convertCandidate(id)),
    onSuccess: invalidate,
  });
}
