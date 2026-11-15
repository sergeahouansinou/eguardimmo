"use client";

import { useAfterHydration } from "@eguardimmo/shell";
import type { ClientQuery } from "@eguardimmo/shell";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { agenceKey, useAgenceMutation, useAgenceQuery } from "@/features/query";
import { useAgenceSource } from "@/features/source";
import type { AgenceSource } from "@/features/source";
import type { z } from "zod";
import type { BaremeInput, PreviewPaymentInput } from "./inputs";
import {
  baremesSchema,
  encaissementsSchema,
  honorairesSchema,
  impayeDetailSchema,
  impayesSchema,
  lotSchema,
  openInstallmentsSchema,
  paymentPreviewSchema,
  reversementDetailSchema,
  reversementsSchema,
  simulationSchema,
} from "./schemas";

const key = (...parts: readonly unknown[]) => agenceKey("finances", ...parts);

export function newKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function useKeptQuery<S extends z.ZodType>(queryKey: readonly unknown[], schema: S, load: (source: AgenceSource) => Promise<unknown>): ClientQuery<z.output<S>> {
  const source = useAgenceSource();
  return useAfterHydration(
    useQuery({
      queryKey,
      placeholderData: keepPreviousData,
      queryFn: async (): Promise<z.output<S>> => schema.parse(await load(source)),
    }),
  );
}

export const useEncaissements = (period: string) => useKeptQuery(key("encaissements", period), encaissementsSchema, (s) => s.finances.encaissements(period));
export const useOpenInstallments = () => useAgenceQuery(key("open-installments"), openInstallmentsSchema, (s) => s.finances.openInstallments());
export const useImpayes = () => useAgenceQuery(key("impayes"), impayesSchema, (s) => s.finances.impayes());
export const useImpayeDetail = (lotId: string) => useAgenceQuery(key("impaye", lotId), impayeDetailSchema.nullable(), (s) => s.finances.impayeDetail(lotId));
export const useReversements = () => useAgenceQuery(key("reversements"), reversementsSchema, (s) => s.finances.reversements());
export const useLot = () => useAgenceQuery(key("lot"), lotSchema, (s) => s.finances.lot());
export const useReversementDetail = (mandantId: string) =>
  useAgenceQuery(key("reversement", mandantId), reversementDetailSchema, (s) => s.finances.reversement(mandantId));
export const useHonoraires = (period: string) => useKeptQuery(key("honoraires", period), honorairesSchema, (s) => s.finances.honoraires(period));
export const useBaremes = () => useAgenceQuery(key("baremes"), baremesSchema, (s) => s.finances.baremes());

function useGuardedQuery<S extends z.ZodType>(queryKey: readonly unknown[], schema: S, enabled: boolean, load: () => Promise<unknown>): ClientQuery<z.output<S>> {
  return useAfterHydration(
    useQuery({
      queryKey,
      enabled,
      queryFn: async (): Promise<z.output<S>> => schema.parse(await load()),
    }),
  );
}

export function usePaymentPreview(input: PreviewPaymentInput | null) {
  const source = useAgenceSource();
  return useGuardedQuery(key("preview", input), paymentPreviewSchema, input !== null, () => (input ? source.finances.previewPayment(input) : Promise.resolve(null)));
}

export function useSimulation(input: BaremeInput | null) {
  const source = useAgenceSource();
  return useGuardedQuery(key("simulation", input), simulationSchema, input !== null, () => (input ? source.finances.simulateBareme(input) : Promise.resolve(null)));
}

export const useRecordPayment = () => useAgenceMutation((s, input: Parameters<typeof s.finances.recordPayment>[0]) => s.finances.recordPayment(input));
export const useReconcilePayment = () => useAgenceMutation((s, input: { paymentId: string }) => s.finances.reconcilePayment(input));
export const useRejectPayment = () => useAgenceMutation((s, input: Parameters<typeof s.finances.rejectPayment>[0]) => s.finances.rejectPayment(input));
export const useSendReminders = () => useAgenceMutation((s, input: Parameters<typeof s.finances.sendReminders>[0]) => s.finances.sendReminders(input));
export const useProposePlan = () => useAgenceMutation((s, input: Parameters<typeof s.finances.proposePlan>[0]) => s.finances.proposePlan(input));
export const usePrepareNotice = () => useAgenceMutation((s, input: { lotId: string }) => s.finances.prepareNotice(input));
export const useInformMandant = () => useAgenceMutation((s, input: { lotId: string }) => s.finances.informMandant(input));
export const usePrepareLot = () => useAgenceMutation<undefined>((s) => s.finances.prepareLot());
export const useIncludeInLot = () => useAgenceMutation((s, input: { mandantId: string }) => s.finances.includeInLot(input));
export const useRemoveFromLot = () => useAgenceMutation((s, input: Parameters<typeof s.finances.removeFromLot>[0]) => s.finances.removeFromLot(input));
export const useValidateLot = () => useAgenceMutation((s, input: Parameters<typeof s.finances.validateLot>[0]) => s.finances.validateLot(input));
export const useBlockReversement = () => useAgenceMutation((s, input: Parameters<typeof s.finances.blockReversement>[0]) => s.finances.blockReversement(input));
export const useUnblockReversement = () => useAgenceMutation((s, input: { mandantId: string }) => s.finances.unblockReversement(input));
export const useSaveBareme = () => useAgenceMutation((s, input: BaremeInput) => s.finances.saveBareme(input));
