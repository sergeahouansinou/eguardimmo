import { z } from 'zod';
import { BIEN_IDS } from '../shared/biens';
import { isoDateSchema } from '../shared/schemas';

export const documentInputSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'Indiquez le nom du fichier.')
    .max(255, 'Le nom ne dépasse pas 255 caractères.')
    .refine((value) => !/[\\/]/.test(value), 'Le nom ne peut pas contenir « / » ni « \\ ».'),
  bienId: z.enum(BIEN_IDS).nullable(),
  description: z.string().trim().max(200, 'La description ne dépasse pas 200 caractères.'),
  sharedWith: z.string().trim().max(120).nullable(),
  shared: z.boolean(),
  sizeBytes: z.number().int().nonnegative(),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;

export const documentSchema = documentInputSchema.extend({
  id: z.string().min(1),
  date: isoDateSchema,
  archived: z.boolean(),
});
export type DocumentRecord = z.infer<typeof documentSchema>;

export const documentListSchema = z.array(documentSchema);

export const documentPatchSchema = documentInputSchema.pick({ fileName: true, bienId: true, sharedWith: true }).partial();
export type DocumentPatch = z.infer<typeof documentPatchSchema>;
