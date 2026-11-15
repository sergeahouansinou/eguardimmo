import { z } from "zod";
import { fileMetaSchema } from "@/features/kit/serverValidation";
import { DEMO_TODAY, isIsoDate } from "@/features/shared/dates";

export const CATEGORIES = [
  "Mandat",
  "Bail",
  "Quittance",
  "Compte rendu",
  "Devis",
  "Facture",
  "Photo",
  "Diagnostic",
  "Conformité",
  "Autre",
] as const;

export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

const isoDate = z.string().refine(isIsoDate, "Saisissez une date valide.");

export const AGENCY_OWNER = "agence";

export const documentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  displayName: z.string(),
  ownerId: z.string(),
  lotId: z.string().nullable(),
  tenantId: z.string().nullable(),
  category: categorySchema,
  sharedWithMandant: z.boolean(),
  sharedWithTenant: z.boolean(),
  sizeBytes: z.number().int().nonnegative(),
  date: isoDate,
  validUntil: isoDate.nullable(),
  description: z.string(),
  archived: z.boolean(),
});

export type DocumentRecord = z.infer<typeof documentSchema>;

export const documentsSchema = z.object({ documents: z.array(documentSchema) });
export type DocumentsData = z.infer<typeof documentsSchema>;

const NO_LOT = "none";
export const NO_LOT_VALUE = NO_LOT;

export const addDocumentFormSchema = z.object({
  ownerId: z.string().min(1, "Choisissez le rattachement."),
  lotId: z.string(),
  category: z.enum(CATEGORIES, { error: "Choisissez la catégorie." }),
  displayName: z.string().trim().max(120, "120 caractères au maximum."),
  validUntil: z
    .string()
    .refine((value) => value === "" || isIsoDate(value), "Saisissez une date valide.")
    .refine((value) => value === "" || value >= DEMO_TODAY, "La date de validité ne peut pas être passée."),
  description: z.string().trim().max(500, "500 caractères au maximum."),
  sharedWithMandant: z.boolean(),
  sharedWithTenant: z.boolean(),
});

export type AddDocumentForm = z.infer<typeof addDocumentFormSchema>;

export const addDocumentInputSchema = z.object({
  file: fileMetaSchema,
  ownerId: z.string().min(1, "Choisissez le rattachement."),
  lotId: z.string().nullable(),
  category: categorySchema,
  displayName: z.string().trim().max(120),
  validUntil: isoDate.nullable().refine((value) => value === null || value >= DEMO_TODAY, "La date de validité ne peut pas être passée."),
  description: z.string().trim().max(500),
  sharedWithMandant: z.boolean(),
  sharedWithTenant: z.boolean(),
});

export type AddDocumentInput = z.infer<typeof addDocumentInputSchema>;

export const sharingInputSchema = z.object({ sharedWithMandant: z.boolean(), sharedWithTenant: z.boolean() });
export type SharingInput = z.infer<typeof sharingInputSchema>;

export const archiveInputSchema = z.object({ archived: z.boolean() });
