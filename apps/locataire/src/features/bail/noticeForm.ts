import { z } from 'zod';
import { formatDate } from '@/lib/dates';
import { ATTESTATION_RULES, checkFile } from '@/lib/files';
import { hasForbiddenCharacter } from '@/tenant/apiKit';
import type { NoticeReasonOption } from '@/tenant/noticeSchemas';

export const FORWARDING_ADDRESS_MAX = 300;

export function noticeSchema(reasons: readonly NoticeReasonOption[], today: string) {
  return z
    .object({
      reasonKey: z.string().min(1, 'Choisissez le motif de votre préavis.'),
      departureOn: z.iso.date('Indiquez la date de départ souhaitée.'),
      forwardingAddress: z
        .string()
        .trim()
        .max(FORWARDING_ADDRESS_MAX, `L’adresse est trop longue (${String(FORWARDING_ADDRESS_MAX)} caractères au maximum).`)
        .refine((value) => !hasForbiddenCharacter(value), 'L’adresse contient un caractère non autorisé.'),
      proof: z.custom<File | null>(),
      consent: z.boolean().refine((value) => value, 'Cochez la case pour confirmer votre demande.'),
    })
    .superRefine((value, context) => {
      const reason = reasons.find((item) => item.key === value.reasonKey);
      if (reason === undefined) return;
      if (value.departureOn < today) {
        context.addIssue({ code: 'custom', path: ['departureOn'], message: 'La date de départ ne peut pas être passée.' });
      } else if (value.departureOn < reason.earliestDepartureOn) {
        context.addIssue({
          code: 'custom',
          path: ['departureOn'],
          message: `Avec ce motif, le départ est possible au plus tôt le ${formatDate(reason.earliestDepartureOn)}.`,
        });
      }
      if (reason.proofRequired && !(value.proof instanceof File)) {
        context.addIssue({ code: 'custom', path: ['proof'], message: 'Ce motif exige un justificatif : joignez-le.' });
      }
      if (value.proof instanceof File) {
        const check = checkFile(value.proof, ATTESTATION_RULES);
        if (!check.ok) context.addIssue({ code: 'custom', path: ['proof'], message: check.error ?? 'Fichier refusé.' });
      }
    });
}

export type NoticeValues = z.input<ReturnType<typeof noticeSchema>>;
