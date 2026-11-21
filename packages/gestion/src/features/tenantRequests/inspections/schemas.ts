import { z } from 'zod';
import { todayIso } from '../../locataires/kit/dates';
import { requiredDate } from '../shared/dates';
import { INSPECTION_KINDS, INSPECTION_PERFORMERS, MAX_SIGNATORIES, REMARK_ANSWERS } from './model';
import type { Signatory } from './model';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PDF_MIME = 'application/pdf';

export const signatorySchema = z.object({
  name: z.string().trim().min(2, 'Nom du signataire : 2 caractères au moins.').max(120, 'Nom du signataire : 120 caractères au plus.'),
  capacity: z.string().trim().min(2, 'Qualité : 2 caractères au moins.').max(60, 'Qualité : 60 caractères au plus.'),
  date: requiredDate('Date de signature'),
});
export type SignatoryValues = z.input<typeof signatorySchema>;

const conformity = z.enum(['', 'yes', 'no']);
const performer = z.enum(INSPECTION_PERFORMERS, 'Choisissez qui a réalisé l’état des lieux.');
const signatories = z.array(signatorySchema).max(MAX_SIGNATORIES, `Dix signataires au plus.`);

const performedOn = requiredDate('Date de réalisation').refine((value) => value <= todayIso(), 'Date de réalisation : elle ne peut pas être dans le futur.');

const baseFields = z.object({
  kind: z.enum(INSPECTION_KINDS, 'Choisissez entrée ou sortie.'),
  performedOn,
  performedBy: performer,
  conformity,
  signatories,
  file: z.instanceof(File).nullable(),
});

const entryHasNoConformity = (values: { kind: string; conformity: string }, context: z.RefinementCtx): void => {
  if (values.kind === 'entry' && values.conformity !== '') context.addIssue({ code: 'custom', path: ['conformity'], message: 'La conformité ne se renseigne que pour un état des lieux de sortie.' });
};

export const inspectionFormSchema = baseFields.superRefine((values, context) => {
  if (values.file === null) context.addIssue({ code: 'custom', path: ['file'], message: 'Joignez le PDF de l’état des lieux.' });
  else if (values.file.size > MAX_FILE_BYTES) context.addIssue({ code: 'custom', path: ['file'], message: 'Le PDF dépasse 10 Mo.' });
  else if (values.file.type !== PDF_MIME) context.addIssue({ code: 'custom', path: ['file'], message: 'Le fichier doit être un PDF.' });
  entryHasNoConformity(values, context);
});
export type InspectionFormValues = z.input<typeof inspectionFormSchema>;

export const inspectionEditSchema = baseFields.superRefine(entryHasNoConformity);

export const answerSchema = z.object({
  answer: z.enum(REMARK_ANSWERS, 'Choisissez la décision.'),
  body: z.string().trim().min(2, 'Écrivez une réponse de 2 caractères au moins.').max(1000, 'La réponse ne peut pas dépasser 1000 caractères.'),
});
export type AnswerValues = z.input<typeof answerSchema>;

export const toConformity = (value: 'yes' | 'no' | ''): boolean | null => (value === '' ? null : value === 'yes');
export const fromConformity = (value: boolean | null): 'yes' | 'no' | '' => (value === null ? '' : value ? 'yes' : 'no');
export const trimSignatories = (rows: readonly Signatory[]): Signatory[] => rows.map((row) => ({ name: row.name.trim(), capacity: row.capacity.trim(), date: row.date }));
