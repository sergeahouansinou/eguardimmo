"use client";

import { orgKey, useOrgMutation, useOrgQuery } from "@/features/org/queries";
import { useChampsSource } from "./ChampsSourceProvider";
import type { CustomField, Entity, FieldPayload } from "./schemas";

const MODULE = "champs";

export function useCustomFields(entity: Entity, includeArchived: boolean) {
  const source = useChampsSource();
  return useOrgQuery(orgKey(MODULE, entity, includeArchived), () => source.list(entity, includeArchived));
}

export function useSaveField(entity: Entity) {
  const source = useChampsSource();
  return useOrgMutation(MODULE, (input: { payload: FieldPayload; existing: CustomField | null }) =>
    input.existing === null ? source.create(entity, input.payload) : source.update(input.existing.id, input.payload),
  );
}

export function useArchiveField() {
  const source = useChampsSource();
  return useOrgMutation(MODULE, (field: CustomField) => (field.archived ? source.restore(field.id) : source.archive(field.id)));
}
