import { z } from 'zod';
import { ATTESTATION_RULES, checkFile } from '@/lib/files';
import { hasForbiddenCharacter } from '@/tenant/apiKit';

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} est obligatoire (${String(min)} caractères au minimum).`)
    .max(max, `${label} est trop long (${String(max)} caractères au maximum).`)
    .refine((value) => !hasForbiddenCharacter(value), `${label} contient un caractère non autorisé.`);

export function depositSchema(today: string) {
  return z
    .object({
      insurer: text('L’assureur', 2, 120),
      policyNumber: text('Le numéro de contrat', 2, 60),
      startsOn: z.iso.date('Indiquez la date de début.'),
      endsOn: z.iso.date('Indiquez la date de fin.'),
      file: z.custom<File | null>().refine((value) => value instanceof File, 'Joignez l’attestation.'),
    })
    .superRefine((value, context) => {
      if (value.file instanceof File) {
        const check = checkFile(value.file, ATTESTATION_RULES);
        if (!check.ok) context.addIssue({ code: 'custom', path: ['file'], message: check.error ?? 'Fichier refusé.' });
      }
      if (value.endsOn <= value.startsOn) {
        context.addIssue({ code: 'custom', path: ['endsOn'], message: 'La date de fin doit suivre la date de début.' });
      } else if (value.endsOn < today) {
        context.addIssue({ code: 'custom', path: ['endsOn'], message: 'Cette attestation est déjà expirée.' });
      }
    });
}

export type DepositValues = z.input<ReturnType<typeof depositSchema>>;
