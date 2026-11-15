import { toneSchema } from '@eguardimmo/shell';
import { z } from 'zod';
import { CURRENCIES } from '../../../format/money';

export const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const isoDate = z.iso.date();
export const minor = z.number().int();
export const count = z.number().int().nonnegative();
export const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const currencySchema = z.enum(CURRENCIES);

export const badgeSchema = z.object({ label: z.string().min(1), tone: toneSchema });
export type Badge = z.infer<typeof badgeSchema>;

export const personRefSchema = z.object({ id: idSchema, name: z.string().min(1) });
export type PersonRef = z.infer<typeof personRefSchema>;

export const letterSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
export type Letter = z.infer<typeof letterSchema>;

export const factRowSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  secret: z.boolean().optional(),
  badge: badgeSchema.optional(),
});
export type FactRow = z.infer<typeof factRowSchema>;

export const photoSchema = z.object({ id: idSchema, label: z.string().min(1), cover: z.boolean() });

export const ownerKindSchema = z.enum(['lot', 'immeuble', 'equipement']);
export type OwnerKind = z.infer<typeof ownerKindSchema>;
export const ownerSchema = z.object({ kind: ownerKindSchema, id: idSchema });
export type Owner = z.infer<typeof ownerSchema>;

export const documentSchema = z.object({
  id: idSchema,
  owner: ownerSchema,
  name: z.string().min(1),
  category: z.string().min(1),
  date: isoDate,
  shared: z.boolean(),
  sizeBytes: count,
});
export type DocumentRecord = z.infer<typeof documentSchema>;

export const documentsSchema = z.object({
  categories: z.array(z.string().min(1)),
  items: z.array(documentSchema),
});
export type DocumentsData = z.infer<typeof documentsSchema>;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
