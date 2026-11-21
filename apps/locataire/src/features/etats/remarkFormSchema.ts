import { z } from 'zod';
import { PHOTO_RULES, checkFile } from '@/lib/files';
import { hasForbiddenCharacter } from '@/tenant/apiKit';
import { REMARK_KINDS } from '@/tenant/inspectionSchemas';

export const MAX_PHOTOS = 6;
export const BODY_MAX = 2000;

export const remarkFormSchema = z
  .object({
    kind: z.string().refine((value) => REMARK_KINDS.some((item) => item === value), 'Choisissez la nature de votre remarque.'),
    body: z
      .string()
      .trim()
      .min(2, 'Décrivez votre remarque (2 caractères au minimum).')
      .max(BODY_MAX, `La remarque est trop longue (${String(BODY_MAX)} caractères au maximum).`)
      .refine((value) => !hasForbiddenCharacter(value.replace(/[\n\r\t]/g, ' ')), 'La remarque contient un caractère non autorisé.'),
    photos: z.array(z.custom<File>((value) => value instanceof File)),
  })
  .superRefine((value, context) => {
    if (value.photos.length > MAX_PHOTOS) {
      context.addIssue({ code: 'custom', path: ['photos'], message: `Six photos au maximum par remarque.` });
      return;
    }
    for (const photo of value.photos) {
      const check = checkFile(photo, PHOTO_RULES);
      if (!check.ok) {
        context.addIssue({ code: 'custom', path: ['photos'], message: check.error ?? 'Photo refusée.' });
        return;
      }
    }
  });

export type RemarkValues = z.input<typeof remarkFormSchema>;
