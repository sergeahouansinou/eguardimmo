import { z } from 'zod';
import { legalFrameSchema, templateCategorySchema, templateInputSchema } from './schemas';
import type { Template, TemplateInput } from './schemas';

export const TEMPLATE_FILE_FORMAT = 'eguardimmo.modele';
export const TEMPLATE_FILE_MAX_BYTES = 200 * 1024;

const templateFileSchema = z.strictObject({
  format: z.literal(TEMPLATE_FILE_FORMAT),
  version: z.literal(1),
  template: z.strictObject({
    name: z.string(),
    category: templateCategorySchema,
    legalFrame: legalFrameSchema,
    description: z.string(),
    subject: z.string(),
    body: z.string(),
    suggestRegistered: z.boolean(),
  }),
});

export type TemplateFileResult = { ok: true; input: TemplateInput } | { ok: false; message: string };

export function serializeTemplate(template: Template): string {
  const { name, category, legalFrame, description, subject, body, suggestRegistered } = template;
  return JSON.stringify({ format: TEMPLATE_FILE_FORMAT, version: 1, template: { name, category, legalFrame, description, subject, body, suggestRegistered } }, null, 2);
}

function describeStructureIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === 'unrecognized_keys') return `champ inattendu « ${issue.keys.join(', ')} »`;
  const path = issue.path.join('.');
  return path === '' ? 'le contenu n’est pas un modèle exporté par l’application' : `le champ « ${path} » est manquant ou incorrect`;
}

export function parseTemplateFile(text: string): TemplateFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: 'Ce fichier n’est pas un JSON valide.' };
  }
  const structure = templateFileSchema.safeParse(raw);
  if (!structure.success) {
    const first = structure.error.issues[0];
    return { ok: false, message: `Fichier de modèle invalide : ${first ? describeStructureIssue(first) : 'contenu inattendu'}.` };
  }
  const business = templateInputSchema.safeParse({ ...structure.data.template, unitId: '' });
  if (!business.success) return { ok: false, message: `Fichier de modèle invalide : ${business.error.issues[0]?.message ?? 'contenu incorrect'}` };
  return { ok: true, input: business.data };
}

export function downloadTemplateFile(template: Template): void {
  const url = URL.createObjectURL(new Blob([serializeTemplate(template)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `modele-${template.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
