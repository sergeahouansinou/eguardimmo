import { z } from 'zod';
import { expenseTypeSchema, paymentModeSchema, paymentNatureSchema } from './schemas';

const id = z.string().min(1);
const isoDate = z.iso.date();
const positiveMinor = z.number().int().positive();
const key = z.string().min(8);

export const financesCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('recordPayment'),
    requestKey: key,
    bailId: id,
    echeanceId: id.nullable(),
    montant: positiveMinor,
    date: isoDate,
    mode: paymentModeSchema,
    nature: paymentNatureSchema,
    reference: z.string().max(60),
    note: z.string().max(500),
    comptabilise: z.boolean(),
    mentionQuittance: z.boolean(),
    envoyerRecu: z.boolean(),
  }),
  z.object({ type: z.literal('sendReminders'), requestKey: key, echeanceIds: z.array(id).min(1), canal: z.enum(['email', 'courrier']) }),
  z.object({ type: z.literal('markUncollectible'), requestKey: key, echeanceId: id }),
  z.object({ type: z.literal('updateEcheance'), requestKey: key, echeanceId: id, libelle: z.string().trim().min(1).max(120), montant: positiveMinor, echeance: isoDate }),
  z.object({ type: z.literal('shiftEcheances'), requestKey: key, echeanceIds: z.array(id).min(1), echeance: isoDate }),
  z.object({ type: z.literal('duplicateEcheance'), requestKey: key, echeanceId: id }),
  z.object({ type: z.literal('cancelEcheance'), requestKey: key, echeanceId: id }),
  z.object({ type: z.literal('attachJustificatif'), requestKey: key, echeanceId: id, fileName: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal('carryCredit'), requestKey: key, echeanceId: id }),
  z.object({
    type: z.literal('saveExpense'),
    requestKey: key,
    depenseId: id.nullable(),
    bien: z.string().trim().min(1),
    expenseType: expenseTypeSchema,
    date: isoDate,
    montantTtc: positiveMinor,
    fournisseur: z.string().trim().min(1),
    description: z.string().max(500),
    numeroFacture: z.string().max(60),
    deductible: z.boolean(),
    recuperable: z.boolean(),
    nonComptabilise: z.boolean(),
    justificatif: z.string().max(120).nullable(),
    ligneBancaireId: id.nullable(),
  }),
  z.object({ type: z.literal('cancelExpense'), requestKey: key, depenseId: id }),
  z.object({
    type: z.literal('createInvoice'),
    requestKey: key,
    locataireId: id,
    date: isoDate,
    objet: z.string().trim().min(1).max(160),
    montantHt: positiveMinor,
    tvaPct: z.number().int().min(0).max(100),
    echeance: isoDate.nullable(),
  }),
  z.object({ type: z.literal('creditInvoice'), requestKey: key, factureId: id }),
  z.object({ type: z.literal('markInvoicePaid'), requestKey: key, factureId: id, date: isoDate, mode: paymentModeSchema }),
  z.object({ type: z.literal('sendInvoice'), requestKey: key, factureId: id }),
  z.object({ type: z.literal('sendReceipt'), requestKey: key, recuId: id }),
  z.object({ type: z.literal('openDossier'), requestKey: key, echeanceId: id }),
  z.object({
    type: z.literal('addDiligence'),
    requestKey: key,
    dossierId: id,
    date: isoDate,
    kind: z.enum(['relance', 'mise_en_demeure', 'commandement', 'autre']),
    libelle: z.string().trim().min(1).max(160),
    intervenant: z.string().trim().min(1).max(120),
    cout: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('billDossierFees'), requestKey: key, dossierId: id, echeance: isoDate }),
  z.object({ type: z.literal('proposePlan'), requestKey: key, echeanceId: id, count: z.number().int().min(2).max(12), premiere: isoDate }),
  z.object({
    type: z.literal('saveRegularisation'),
    requestKey: key,
    regularisationId: id.nullable(),
    bailId: id,
    debut: isoDate,
    fin: isoDate,
    provisions: z.number().int().nonnegative(),
    chargesReelles: z.number().int().nonnegative(),
    justificatifs: z.array(z.string().max(120)),
    emettre: z.boolean(),
  }),
  z.object({
    type: z.literal('savePret'),
    requestKey: key,
    pretId: id.nullable(),
    bien: z.string().trim().min(1),
    banque: z.string().trim().min(1),
    emprunte: positiveMinor,
    tauxBp: z.number().int().min(0).max(2000),
    fin: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    mensualite: z.number().int().nonnegative(),
    restantDu: z.number().int().nonnegative(),
    interetsAnnee: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('prepayPret'), requestKey: key, pretId: id, montant: positiveMinor }),
  z.object({ type: z.literal('setPretStatut'), requestKey: key, pretId: id, statut: z.enum(['en_cours', 'archive']) }),
  z.object({ type: z.literal('deletePret'), requestKey: key, pretId: id }),
  z.object({
    type: z.literal('importEcheancier'),
    requestKey: key,
    pretId: id,
    lignes: z.array(z.object({ date: isoDate, mensualite: z.number().int(), interets: z.number().int(), capital: z.number().int(), restant: z.number().int() })).min(1),
  }),
  z.object({
    type: z.literal('importBankLines'),
    requestKey: key,
    compte: z.string().min(1),
    lignes: z.array(z.object({ date: isoDate, libelle: z.string().trim().min(1).max(120), montant: z.number().int().refine((value) => value !== 0) })).min(1).max(500),
  }),
  z.object({ type: z.literal('matchBankLine'), requestKey: key, ligneId: id, echeanceId: id }),
  z.object({ type: z.literal('ignoreBankLine'), requestKey: key, ligneId: id }),
  z.object({ type: z.literal('restoreBankLine'), requestKey: key, ligneId: id }),
  z.object({ type: z.literal('splitBankLine'), requestKey: key, ligneId: id, premierePart: z.number().int() }),
  z.object({ type: z.literal('toggleAutomation'), requestKey: key, automatisationId: id, active: z.boolean() }),
]);
export type FinancesCommand = z.infer<typeof financesCommandSchema>;
export type FinancesCommandInput<T extends FinancesCommand['type']> = Omit<Extract<FinancesCommand, { type: T }>, 'requestKey'>;

export interface CommandResult {
  message: string;
  href: string | null;
  id: string | null;
}
