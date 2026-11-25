import { z } from "zod";

export const ENTITIES = ["unit", "property", "party", "lease", "mandate", "equipment", "intervention"] as const;
export type Entity = (typeof ENTITIES)[number];

export const FIELD_TYPES = ["text", "number", "money", "date", "bool", "select", "multiselect", "term", "url"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const VOCABULARIES = ["legal_form", "contact_category", "unit_type", "lease_component", "certificate_type", "expense_category", "mandate_type", "invoice_item", "tax_rate", "intervention_nature", "charge_rubric"] as const;
export type Vocabulary = (typeof VOCABULARIES)[number];

const labels = z.union([z.record(z.string(), z.string()), z.array(z.never()).transform((): Record<string, string> => ({}))]);

const optionApi = z.object({ key: z.string(), labels });

const fieldApi = z.object({
  id: z.string().min(1),
  entity: z.enum(ENTITIES),
  key: z.string(),
  labels,
  type: z.enum(FIELD_TYPES),
  vocabulary: z.enum(VOCABULARIES).nullable(),
  options: z.array(optionApi).nullable(),
  required: z.boolean(),
  position: z.number().int(),
  type_locked: z.boolean(),
  archived: z.boolean(),
});

export const customFieldSchema = fieldApi.transform((field) => ({
  id: field.id,
  entity: field.entity,
  key: field.key,
  labels: field.labels,
  type: field.type,
  vocabulary: field.vocabulary,
  options: field.options ?? [],
  required: field.required,
  position: field.position,
  typeLocked: field.type_locked,
  archived: field.archived,
}));
export type CustomField = z.output<typeof customFieldSchema>;
export type FieldOption = CustomField["options"][number];

export const customFieldsResponse = z.object({ data: z.array(customFieldSchema) }).transform((payload) => payload.data);
export const customFieldResponse = z.object({ data: customFieldSchema }).transform((payload) => payload.data);

export interface FieldPayload {
  key?: string;
  labels: Record<string, string>;
  type: FieldType;
  vocabulary: Vocabulary | null;
  options: { key: string; labels: Record<string, string> }[] | null;
  required: boolean;
}
