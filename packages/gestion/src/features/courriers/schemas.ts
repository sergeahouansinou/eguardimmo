import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const minor = z.number().int();
const isoDate = z.iso.date();
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const text = z.string().trim();
const required = (message: string) => text.min(1, message);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TEMPLATE_CATEGORIES = ['loyers', 'recouvrement', 'baux', 'conges', 'attestations', 'assurance', 'depot', 'general'] as const;
export const templateCategorySchema = z.enum(TEMPLATE_CATEGORIES);
export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export const templateCategoryLabel: Record<TemplateCategory, string> = {
  loyers: 'Loyers',
  recouvrement: 'Recouvrement',
  baux: 'Baux',
  conges: 'Congés',
  attestations: 'Attestations',
  assurance: 'Assurance',
  depot: 'Dépôt de garantie',
  general: 'Général',
};

export const LEGAL_FRAMES = ['loi_1989', 'meuble', 'commercial', 'autre'] as const;
export const legalFrameSchema = z.enum(LEGAL_FRAMES);
export type LegalFrame = z.infer<typeof legalFrameSchema>;
export const legalFrameLabel: Record<LegalFrame, string> = {
  loi_1989: 'Loi du 6 juillet 1989',
  meuble: 'Bail meublé',
  commercial: 'Bail commercial',
  autre: 'Autre',
};

export const TEMPLATE_FIELDS = [
  { key: 'locataire', label: 'Nom du locataire', sample: 'Koffi Adjovi' },
  { key: 'civilite', label: 'Civilité', sample: 'M.' },
  { key: 'bien', label: 'Bien loué', sample: 'Apt A1, Les Tilleuls' },
  { key: 'adresse', label: 'Adresse du bien', sample: '12 rue des Lilas, 75011 Paris' },
  { key: 'reference_bail', label: 'Référence du bail', sample: 'BL-2023-0007' },
  { key: 'loyer', label: 'Loyer charges comprises', sample: '850,00 €' },
  { key: 'bail.loyer', label: 'Loyer hors charges', sample: '700,00 €' },
  { key: 'bail.charges', label: 'Provision sur charges', sample: '150,00 €' },
  { key: 'montant_impaye', label: 'Montant impayé', sample: '850,00 €' },
  { key: 'mois', label: 'Mois concerné', sample: 'Novembre 2026' },
  { key: 'echeance', label: 'Date d’échéance', sample: '01/12/2026' },
  { key: 'date_limite', label: 'Date limite de paiement', sample: '20/11/2026' },
  { key: 'date', label: 'Date du jour', sample: '13/11/2026' },
  { key: 'bailleur', label: 'Nom du bailleur', sample: 'SCI Les Tilleuls' },
] as const;
export const TEMPLATE_FIELD_KEYS: readonly string[] = TEMPLATE_FIELDS.map((field) => field.key);

const TEMPLATE_TOKEN = /\{([a-z_]+(?:\.[a-z_]+)?)\}/g;

export function renderTemplate(body: string, values: Readonly<Record<string, string>>): string {
  return body.replace(TEMPLATE_TOKEN, (match, key: string) => values[key] ?? match);
}

export const templateSchema = z.object({
  id: slug,
  name: z.string().min(1),
  category: templateCategorySchema,
  legalFrame: legalFrameSchema,
  unitId: slug.nullable(),
  sourceId: slug.nullable(),
  description: z.string(),
  subject: z.string(),
  body: z.string(),
  suggestRegistered: z.boolean(),
  builtIn: z.boolean(),
  archived: z.boolean(),
  draft: z.boolean(),
  updatedOn: isoDate,
});
export type Template = z.infer<typeof templateSchema>;

const templateCommon = {
  name: required('Donnez un nom au modèle'),
  category: templateCategorySchema,
  legalFrame: legalFrameSchema,
  unitId: z.string(),
  description: text,
  suggestRegistered: z.boolean(),
};

function addUnknownFieldIssue(body: string, context: { addIssue: (issue: { code: 'custom'; path: string[]; message: string }) => void }) {
  const unknown = [...body.matchAll(TEMPLATE_TOKEN)].map((match) => match[1] ?? '').filter((key) => !TEMPLATE_FIELD_KEYS.includes(key));
  if (unknown.length > 0) {
    context.addIssue({ code: 'custom', path: ['body'], message: `Champ inconnu : {${unknown[0] ?? ''}}. Utilisez la liste des champs.` });
  }
}

export const templateInputSchema = z
  .object({
    ...templateCommon,
    subject: required('Renseignez l’objet du courrier'),
    body: text.min(20, 'Le contenu est trop court, 20 caractères au minimum'),
  })
  .superRefine((value, context) => { addUnknownFieldIssue(value.body, context); });
export type TemplateInput = z.infer<typeof templateInputSchema>;

export const templateDraftInputSchema = z
  .object({ ...templateCommon, subject: text, body: text })
  .superRefine((value, context) => { addUnknownFieldIssue(value.body, context); });

export const COURRIER_STATUSES = ['brouillon', 'genere', 'envoye'] as const;
export const courrierStatusSchema = z.enum(COURRIER_STATUSES);
export type CourrierStatus = z.infer<typeof courrierStatusSchema>;
export const CHANNELS = ['email', 'courrier', 'lrar'] as const;
export const channelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof channelSchema>;
export const channelLabel: Record<Channel, string> = { email: 'E-mail', courrier: 'Courrier simple', lrar: 'Lettre recommandée' };

export const sendingSchema = z.object({ on: isoDate, channel: channelSchema, resend: z.boolean() });
export type Sending = z.infer<typeof sendingSchema>;

export const courrierSchema = z.object({
  id: slug,
  reference: z.string().min(1),
  templateId: slug.nullable(),
  tenantId: slug,
  unitId: slug.nullable(),
  subject: z.string().min(1),
  body: z.string().min(1),
  status: courrierStatusSchema,
  channel: channelSchema,
  createdOn: isoDate,
  sentOn: isoDate.nullable(),
  updatedOn: isoDate,
  archived: z.boolean(),
  sendings: z.array(sendingSchema),
});
export type Courrier = z.infer<typeof courrierSchema>;

export const courrierInputSchema = z.object({
  templateId: z.string(),
  tenantId: z.string().min(1, 'Choisissez le destinataire'),
  unitId: z.string(),
  subject: required('Renseignez l’objet du courrier'),
  body: text.min(10, 'Rédigez le contenu du courrier'),
  channel: channelSchema,
});
export type CourrierInput = z.infer<typeof courrierInputSchema>;

export const SIGNATURE_STATUSES = ['en_cours', 'signe', 'refuse', 'annule'] as const;
export const signatureStatusSchema = z.enum(SIGNATURE_STATUSES);
export type SignatureStatus = z.infer<typeof signatureStatusSchema>;
export const signerSchema = z.object({ name: z.string().min(1), email: z.string().min(1), status: z.enum(['attente', 'signe', 'refuse']) });
export const SIGNATURE_PAGES = 3;
export const signatureFieldSchema = z.object({
  signer: z.number().int().min(0),
  page: z.number().int().min(1).max(SIGNATURE_PAGES),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});
export type SignatureField = z.infer<typeof signatureFieldSchema>;

export function defaultSignatureFields(count: number): SignatureField[] {
  return Array.from({ length: count }, (_, signer) => ({ signer, page: SIGNATURE_PAGES, x: count === 1 ? 70 : 20 + (60 * signer) / Math.max(1, count - 1), y: 85 }));
}

export const MAX_SIGNATURE_FILES = 10;

function withFiles(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || 'files' in raw || !('fileName' in raw) || typeof raw.fileName !== 'string') return raw;
  return { ...raw, files: [raw.fileName] };
}

export const signatureSchema = z.preprocess(
  withFiles,
  z.object({
    id: slug,
    reference: z.string().min(1),
    title: z.string().min(1),
    // fileName reste le premier document : le module baux le lit encore.
    fileName: z.string().min(1),
    files: z.array(z.string().min(1)).min(1),
    unitId: slug.nullable(),
    signers: z.array(signerSchema).min(1),
    status: signatureStatusSchema,
    createdOn: isoDate,
    completedOn: isoDate.nullable(),
    reminderSentOn: isoDate.nullable(),
    fields: z.array(signatureFieldSchema),
  }),
);
export type Signature = z.output<typeof signatureSchema>;

export function signatureFileNames(value: { files?: readonly string[] | undefined; fileName?: string | undefined }): string[] {
  if (value.files && value.files.length > 0) return [...value.files];
  return value.fileName ? [value.fileName] : [];
}

export const signatureInputSchema = z
  .object({
    title: required('Donnez un titre au document'),
    files: z.array(required('Nom de fichier vide')).optional(),
    fileName: text.optional(),
    unitId: z.string().optional(),
    signers: z.array(z.object({ name: z.string(), email: z.string() })),
    fields: z.array(signatureFieldSchema).optional(),
  })
  .superRefine((value, context) => {
    const files = signatureFileNames(value);
    if (files.length === 0) context.addIssue({ code: 'custom', path: ['files'], message: 'Joignez le PDF à signer' });
    if (files.length > MAX_SIGNATURE_FILES) context.addIssue({ code: 'custom', path: ['files'], message: `${String(MAX_SIGNATURE_FILES)} documents au maximum par demande` });
    if (new Set(files).size !== files.length) context.addIssue({ code: 'custom', path: ['files'], message: 'Un même fichier ne peut pas être joint deux fois' });
    if (value.signers.length === 0) {
      context.addIssue({ code: 'custom', path: ['signers'], message: 'Ajoutez au moins un signataire' });
      return;
    }
    const incomplete = value.signers.some((signer) => signer.name.trim() === '' || !EMAIL.test(signer.email.trim()));
    if (incomplete) context.addIssue({ code: 'custom', path: ['signers'], message: 'Chaque signataire a besoin d’un nom et d’un e-mail valide' });
    if (value.fields?.some((field) => field.signer >= value.signers.length)) {
      context.addIssue({ code: 'custom', path: ['fields'], message: 'Un champ de signature désigne un signataire inconnu' });
    }
  });
export type SignatureInput = z.input<typeof signatureInputSchema>;

export const RECEIPT_EVENT_TYPES = ['emise', 'envoyee', 'annulee'] as const;
export const receiptEventSchema = z.object({
  type: z.enum(RECEIPT_EVENT_TYPES),
  on: isoDate,
  by: z.string().min(1),
  note: z.string().nullable(),
});
export type ReceiptEvent = z.infer<typeof receiptEventSchema>;
export const receiptCancellationSchema = z.object({ on: isoDate, by: z.string().min(1), reason: z.string().min(1) });

export const receiptCancelInputSchema = z.object({
  reason: z.string({ error: 'Indiquez le motif de l’annulation' }).trim().min(1, 'Indiquez le motif de l’annulation').max(300, 'Le motif est limité à 300 caractères'),
});
export type ReceiptCancelInput = z.infer<typeof receiptCancelInputSchema>;

export const receiptSchema = z.object({
  id: slug,
  number: z.string().nullable(),
  leaseId: slug,
  tenantId: slug,
  unitId: slug,
  month: yearMonth,
  rent: minor,
  charges: minor,
  outstanding: minor,
  issuedOn: isoDate.nullable(),
  sentOn: isoDate.nullable(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  cancellation: receiptCancellationSchema.nullable(),
  history: z.array(receiptEventSchema),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const noticeSchema = z.object({
  id: slug,
  leaseId: slug,
  tenantId: slug,
  unitId: slug,
  month: yearMonth,
  due: isoDate,
  rent: minor,
  charges: minor,
  arrears: minor,
  sentOn: isoDate.nullable(),
});
export type Notice = z.infer<typeof noticeSchema>;
