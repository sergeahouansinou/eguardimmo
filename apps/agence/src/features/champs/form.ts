import { z } from "zod";
import { FIELD_TYPES, VOCABULARIES } from "./schemas";
import type { CustomField, FieldPayload } from "./schemas";
import { CHOICE_TYPES } from "./labels";

export const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
export const LOCALE = "fr";

export interface FieldForm {
  label: string;
  key: string;
  type: (typeof FIELD_TYPES)[number];
  vocabulary: string;
  options: { key: string; label: string }[];
  required: boolean;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function optionKey(option: { key: string; label: string }): string {
  return option.key === "" ? slugify(option.label) : option.key;
}

export function fieldFormSchema(editing: boolean) {
  return z
    .object({
      label: z.string().trim().min(1, "Indiquez le libellé du champ.").max(80, "80 caractères au maximum."),
      key: editing ? z.string() : z.string().trim().regex(KEY_PATTERN, "Utilisez 2 à 40 caractères : lettres minuscules, chiffres et tiret bas, en commençant par une lettre."),
      type: z.enum(FIELD_TYPES),
      vocabulary: z.string(),
      options: z.array(z.object({ key: z.string(), label: z.string().trim().min(1, "Indiquez le libellé de l’option.").max(80, "80 caractères au maximum.") })),
      required: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (values.type === "term" && !(VOCABULARIES as readonly string[]).includes(values.vocabulary)) {
        ctx.addIssue({ code: "custom", path: ["vocabulary"], message: "Choisissez le référentiel dont la valeur est choisie." });
      }
      if (!CHOICE_TYPES.includes(values.type)) return;
      if (values.options.length === 0) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "Ajoutez au moins une option." });
        return;
      }
      const seen = new Set<string>();
      values.options.forEach((option, index) => {
        const key = optionKey(option);
        if (key === "") {
          ctx.addIssue({ code: "custom", path: ["options", index, "label"], message: "Utilisez au moins une lettre ou un chiffre." });
        } else if (seen.has(key)) {
          ctx.addIssue({ code: "custom", path: ["options", index, "label"], message: "Deux options portent le même nom." });
        }
        seen.add(key);
      });
    });
}

function frLabel(labels: Readonly<Record<string, string>>): string {
  return labels[LOCALE] ?? Object.values(labels)[0] ?? "";
}

export function emptyForm(): FieldForm {
  return { label: "", key: "", type: "text", vocabulary: "", options: [], required: false };
}

export function formFromField(field: CustomField): FieldForm {
  return {
    label: frLabel(field.labels),
    key: field.key,
    type: field.type,
    vocabulary: field.vocabulary ?? "",
    options: field.options.map((option) => ({ key: option.key, label: frLabel(option.labels) })),
    required: field.required,
  };
}

export function buildPayload(values: FieldForm, existing?: CustomField): FieldPayload {
  const choices = CHOICE_TYPES.includes(values.type);
  const previous = new Map((existing?.options ?? []).map((option) => [option.key, option.labels]));
  return {
    ...(existing === undefined ? { key: values.key } : {}),
    labels: { ...existing?.labels, [LOCALE]: values.label },
    type: values.type,
    vocabulary: values.type === "term" ? (VOCABULARIES.find((vocabulary) => vocabulary === values.vocabulary) ?? null) : null,
    options: choices ? values.options.map((option) => ({ key: optionKey(option), labels: { ...previous.get(option.key), [LOCALE]: option.label } })) : null,
    required: values.required,
  };
}
