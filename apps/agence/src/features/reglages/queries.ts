"use client";

import { agenceKey, useAgenceMutation, useAgenceQuery } from "@/features/query";
import type { FileMeta } from "@/features/kit/serverValidation";
import { financesSchema, identitySchema } from "./schemas";

export function useIdentity() {
  return useAgenceQuery(agenceKey("reglages", "identite"), identitySchema, (source) => source.reglages.identity());
}

export function useFinances() {
  return useAgenceQuery(agenceKey("reglages", "finances"), financesSchema, (source) => source.reglages.finances());
}

export interface IdentityPayload {
  companyName: string;
  legalForm: string;
  siren: string;
  capitalMinor: number | null;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  logo: FileMeta | null;
  signature: FileMeta | null;
}

export function useSaveIdentity() {
  return useAgenceMutation(async (source, input: IdentityPayload) => identitySchema.parse(await source.reglages.saveIdentity(input)));
}

export interface FinancesPayload {
  feeRateBp: number;
  feeBasis: string;
  feeTaxMode: string;
  minFeeMinor: number;
  payoutDay: number;
  worksCeilingMinor: number;
}

export function useSaveFinances() {
  return useAgenceMutation(async (source, input: FinancesPayload) => financesSchema.parse(await source.reglages.saveFinances(input)));
}

export function useUpdateAccount() {
  return useAgenceMutation(async (source, input: { iban: string; bank: string; holder: string }) =>
    financesSchema.parse(await source.reglages.updateAccount(input)),
  );
}
