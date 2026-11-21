import { z } from 'zod';
import { SUPPORT_SUBJECT_MAX } from './model';

const body = z.string().trim().min(1, 'Saisissez votre message').max(5000, '5 000 caractères au maximum');

export const supportReplySchema = z.object({ body });

export const supportRequestSchema = z.object({
  subject: z.string().trim().min(1, 'Saisissez un sujet').max(SUPPORT_SUBJECT_MAX, `${String(SUPPORT_SUBJECT_MAX)} caractères au maximum`),
  body,
});
