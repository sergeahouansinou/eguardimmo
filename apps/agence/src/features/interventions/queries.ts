"use client";

import { z } from "zod";
import { agenceKey, useAgenceMutation, useAgenceQuery } from "@/features/query";
import { devisSchema, interventionSchema } from "./schemas";
import type { CreateInterventionInput, PriorityChangeInput, StatusChangeInput, SubmitDevisInput } from "./schemas";

const interventionListSchema = z.array(interventionSchema);
const devisListSchema = z.array(devisSchema);
const nullableIntervention = interventionSchema.nullable();

export function useInterventions() {
  return useAgenceQuery(agenceKey("interventions", "list"), interventionListSchema, (source) => source.interventions.list());
}

export function useIntervention(id: string) {
  return useAgenceQuery(agenceKey("interventions", "one", id), nullableIntervention, (source) => source.interventions.get(id));
}

export function useDevisList() {
  return useAgenceQuery(agenceKey("interventions", "devis"), devisListSchema, (source) => source.interventions.listDevis());
}

export function useCreateIntervention() {
  return useAgenceMutation((source, input: CreateInterventionInput) => source.interventions.create(input));
}

export function useChangeStatus() {
  return useAgenceMutation((source, input: StatusChangeInput) => source.interventions.changeStatus(input));
}

export function useSetPriority() {
  return useAgenceMutation((source, input: PriorityChangeInput) => source.interventions.setPriority(input));
}

export function useSubmitDevis() {
  return useAgenceMutation((source, input: SubmitDevisInput) => source.interventions.submitDevis(input));
}
