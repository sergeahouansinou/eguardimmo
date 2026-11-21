import { z } from 'zod';

export const REASON_MIN = 10;
export const REASON_MAX = 500;

export const approvalFormSchema = z.object({
  reason: z.string().trim().min(REASON_MIN, `Le motif doit faire au moins ${String(REASON_MIN)} caractères.`).max(REASON_MAX, `Le motif ne peut dépasser ${String(REASON_MAX)} caractères.`),
  ticketReference: z
    .string()
    .trim()
    .max(40, 'La référence ne peut dépasser 40 caractères.')
    .regex(/^[A-Za-z0-9._/-]*$/, 'Lettres, chiffres, point, tiret, tiret bas et barre oblique uniquement.'),
});

export type ApprovalFormErrors = Partial<Record<'reason' | 'ticketReference', string>>;

export function validateApprovalForm(input: { reason: string; ticketReference: string }): { ok: true; reason: string; ticketReference: string } | { ok: false; errors: ApprovalFormErrors } {
  const parsed = approvalFormSchema.safeParse(input);
  if (parsed.success) return { ok: true, reason: parsed.data.reason, ticketReference: parsed.data.ticketReference };
  const errors: ApprovalFormErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if ((field === 'reason' || field === 'ticketReference') && errors[field] === undefined) errors[field] = issue.message;
  }
  return { ok: false, errors };
}
