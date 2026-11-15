'use client';

import { shellKeys, useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { homeSchema, preferenceSchema, profileSchema, securitySchema } from './schemas/compte';
import { interventionSchema } from './schemas/interventions';
import { attestationSchema, documentSchema, inspectionSchema, leaseSchema } from './schemas/logement';
import { chargesSchema, installmentSchema, mandateSchema, paymentSchema, receiptSchema } from './schemas/loyers';
import { useLocataireSource } from './source';
import type { LocataireSource } from './source';

export const locataireKeys = {
  all: ['locataire'] as const,
  home: ['locataire', 'home'] as const,
  lease: ['locataire', 'lease'] as const,
  installments: ['locataire', 'installments'] as const,
  payment: (id: string) => ['locataire', 'payment', id] as const,
  receipt: (id: string) => ['locataire', 'receipt', id] as const,
  charges: ['locataire', 'charges'] as const,
  mandate: ['locataire', 'mandate'] as const,
  inspections: ['locataire', 'inspections'] as const,
  documents: ['locataire', 'documents'] as const,
  interventions: ['locataire', 'interventions'] as const,
  attestations: ['locataire', 'attestations'] as const,
  profile: ['locataire', 'profile'] as const,
  preferences: ['locataire', 'preferences'] as const,
  security: ['locataire', 'security'] as const,
};

export interface ScreenQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

function useScreenQuery<T>(
  key: readonly unknown[],
  load: (source: LocataireSource) => Promise<unknown>,
  schema: z.ZodType<T>,
): ScreenQuery<T> {
  const source = useLocataireSource();
  const query = useQuery({
    queryKey: key,
    queryFn: async () => schema.parse(await load(source)),
  });
  const state = useAfterHydration(query);
  return { ...state, refetch: () => { void query.refetch(); } };
}

export const useHome = () => useScreenQuery(locataireKeys.home, (source) => source.home(), homeSchema);
export const useLease = () => useScreenQuery(locataireKeys.lease, (source) => source.lease(), leaseSchema);
export const useInstallments = () =>
  useScreenQuery(locataireKeys.installments, (source) => source.installments(), z.array(installmentSchema));
export const usePayment = (id: string) =>
  useScreenQuery(locataireKeys.payment(id), (source) => source.payment(id), paymentSchema.nullable());
export const useReceipt = (id: string) =>
  useScreenQuery(locataireKeys.receipt(id), (source) => source.receipt(id), receiptSchema.nullable());
export const useCharges = () => useScreenQuery(locataireKeys.charges, (source) => source.charges(), chargesSchema);
export const useMandate = () => useScreenQuery(locataireKeys.mandate, (source) => source.mandate(), mandateSchema);
export const useInspections = () =>
  useScreenQuery(locataireKeys.inspections, (source) => source.inspections(), z.array(inspectionSchema));
export const useDocuments = () =>
  useScreenQuery(locataireKeys.documents, (source) => source.documents(), z.array(documentSchema));
export const useInterventions = () =>
  useScreenQuery(locataireKeys.interventions, (source) => source.interventions(), z.array(interventionSchema));
export const useAttestations = () =>
  useScreenQuery(locataireKeys.attestations, (source) => source.attestations(), z.array(attestationSchema));
export const useProfile = () => useScreenQuery(locataireKeys.profile, (source) => source.profile(), profileSchema);
export const usePreferences = () =>
  useScreenQuery(locataireKeys.preferences, (source) => source.preferences(), z.array(preferenceSchema));
export const useSecurity = () => useScreenQuery(locataireKeys.security, (source) => source.security(), securitySchema);

function useInvalidateAll() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: locataireKeys.all }),
      client.invalidateQueries({ queryKey: shellKeys.data }),
    ]);
  };
}

function useSourceMutation<Input, Output>(
  run: (source: LocataireSource, input: Input) => Promise<unknown>,
  schema: z.ZodType<Output>,
) {
  const source = useLocataireSource();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: Input) => schema.parse(await run(source, input)),
    onSuccess: invalidate,
  });
}

function useSourceAction<Output>(run: (source: LocataireSource) => Promise<unknown>, schema: z.ZodType<Output>) {
  const source = useLocataireSource();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async () => schema.parse(await run(source)),
    onSuccess: invalidate,
  });
}

export const useStartPayment = () => useSourceMutation((source, input: Parameters<LocataireSource['startPayment']>[0]) => source.startPayment(input), paymentSchema);
export const useResolvePayment = () =>
  useSourceMutation((source, input: Parameters<LocataireSource['resolvePayment']>[0]) => source.resolvePayment(input), paymentSchema);
export const useSettlePayment = () => useSourceMutation((source, id: string) => source.settlePayment(id), paymentSchema);
export const useSignMandate = () => useSourceMutation((source, input: Parameters<LocataireSource['signMandate']>[0]) => source.signMandate(input), mandateSchema);
export const useRevokeMandate = () => useSourceAction((source) => source.revokeMandate(), mandateSchema);
export const useCreateIntervention = () =>
  useSourceMutation((source, input: Parameters<LocataireSource['createIntervention']>[0]) => source.createIntervention(input), interventionSchema);
export const useRescheduleIntervention = () =>
  useSourceMutation((source, input: Parameters<LocataireSource['rescheduleIntervention']>[0]) => source.rescheduleIntervention(input), interventionSchema);
export const useDepositAttestation = () =>
  useSourceMutation((source, input: Parameters<LocataireSource['depositAttestation']>[0]) => source.depositAttestation(input), attestationSchema);
export const useGiveNotice = () => useSourceMutation((source, input: Parameters<LocataireSource['giveNotice']>[0]) => source.giveNotice(input), leaseSchema);
export const useUpdateProfile = () =>
  useSourceMutation((source, input: Parameters<LocataireSource['updateProfile']>[0]) => source.updateProfile(input), profileSchema);
export const useSetPreference = () =>
  useSourceMutation((source, input: Parameters<LocataireSource['setPreference']>[0]) => source.setPreference(input), z.array(preferenceSchema));
export const useRequestDataExport = () => useSourceAction((source) => source.requestDataExport(), profileSchema);
