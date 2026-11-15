import { z } from 'zod';
import { CURRENCIES } from '../../format/money';

const minor = z.number().int();
const positiveMinor = z.number().int().positive();
const id = z.string().min(1);
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime({ offset: true });
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const PAYMENT_MODES = ['virement', 'prelevement', 'especes', 'cheque', 'mobile_money', 'carte'] as const;
export const paymentModeSchema = z.enum(PAYMENT_MODES);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

export const PAYMENT_NATURES = ['echeance', 'acompte_loyer', 'acompte_depot', 'autre'] as const;
export const paymentNatureSchema = z.enum(PAYMENT_NATURES);
export type PaymentNature = z.infer<typeof paymentNatureSchema>;

export const EXPENSE_TYPES = ['reparation', 'entretien', 'taxe', 'assurance', 'energie', 'autre'] as const;
export const expenseTypeSchema = z.enum(EXPENSE_TYPES);
export type ExpenseType = z.infer<typeof expenseTypeSchema>;

export const bailSchema = z.object({
  id,
  numero: z.string().min(1),
  locataireId: id,
  locataire: z.string().min(1),
  unite: z.string().min(1),
  immeuble: z.string().min(1),
  proprietaire: z.string().min(1),
});
export type Bail = z.infer<typeof bailSchema>;

export const echeanceSchema = z.object({
  id,
  bailId: id,
  libelle: z.string().min(1),
  echeance: isoDate,
  montant: minor,
  paye: minor,
  statut: z.enum(['active', 'annulee', 'irrecouvrable']),
  justificatifs: z.array(z.string()),
});
export type Echeance = z.infer<typeof echeanceSchema>;

export const paiementSchema = z.object({
  id,
  bailId: id,
  echeanceId: id.nullable(),
  date: isoDate,
  montant: positiveMinor,
  mode: paymentModeSchema,
  nature: paymentNatureSchema,
  reference: z.string(),
  note: z.string(),
  comptabilise: z.boolean(),
  mentionQuittance: z.boolean(),
  recuId: id.nullable(),
  libelle: z.string().min(1),
});
export type Paiement = z.infer<typeof paiementSchema>;

export const depenseSchema = z.object({
  id,
  bien: z.string().min(1),
  type: expenseTypeSchema,
  date: isoDate,
  montantTtc: positiveMinor,
  fournisseur: z.string().min(1),
  description: z.string(),
  numeroFacture: z.string(),
  deductible: z.boolean(),
  recuperable: z.boolean(),
  nonComptabilise: z.boolean(),
  justificatif: z.string().nullable(),
  annulee: z.boolean(),
});
export type Depense = z.infer<typeof depenseSchema>;

export const relanceSchema = z.object({
  id,
  echeanceId: id,
  date: isoDate,
  canal: z.enum(['email', 'courrier', 'recommande']),
  amiable: z.boolean(),
});
export type Relance = z.infer<typeof relanceSchema>;

export const factureLigneSchema = z.object({
  designation: z.string().min(1),
  reference: z.string(),
  quantite: z.number().int().positive(),
  prixUnitaire: minor,
  montant: minor,
});
export type FactureLigne = z.infer<typeof factureLigneSchema>;

export const factureSchema = z.object({
  id,
  numero: z.string().min(1),
  type: z.enum(['facture', 'avoir']),
  date: isoDate,
  locataireId: id,
  destinataire: z.string().min(1),
  objet: z.string().min(1),
  montantHt: minor,
  tvaPct: z.number().int().min(0).max(100),
  montantTtc: minor,
  echeance: isoDate.nullable(),
  statut: z.enum(['attente', 'payee', 'avoir']),
  payeLe: isoDate.nullable(),
  envoyeLe: isoDate.nullable(),
  lignes: z.array(factureLigneSchema),
  bailId: id.nullable(),
  dossierId: id.nullable(),
  factureOrigineId: id.nullable(),
  avoirId: id.nullable(),
  empreinte: z.string(),
  scelleLe: isoDateTime,
});
export type Facture = z.infer<typeof factureSchema>;

export const recuSchema = z.object({
  id,
  numero: z.string().min(1),
  date: isoDate,
  paiementId: id,
  bailId: id,
  echeanceId: id.nullable(),
  nature: paymentNatureSchema,
  montant: positiveMinor,
  mode: paymentModeSchema,
  reference: z.string(),
  appele: minor,
  recuSurEcheance: minor,
  resteDu: minor,
  envoyeLe: isoDate.nullable(),
  empreinte: z.string(),
  scelleLe: isoDateTime,
});
export type Recu = z.infer<typeof recuSchema>;

export const acteSchema = z.object({
  id,
  date: isoDate,
  kind: z.enum(['relance', 'mise_en_demeure', 'commandement', 'transmission', 'revocation', 'autre']),
  libelle: z.string().min(1),
  intervenant: z.string().min(1),
  cout: z.number().int().nonnegative(),
  factureId: id.nullable(),
});
export type Acte = z.infer<typeof acteSchema>;

export const planSchema = z.object({
  lignes: z.array(z.object({ date: isoDate, montant: positiveMinor })),
  propositionLe: isoDate,
});

export const creanceSchema = z.object({
  id,
  kind: z.enum(['echeance', 'facture']),
  refId: id,
  libelle: z.string().min(1),
  montantInitial: minor,
  inclusLe: isoDate,
  retireLe: isoDate.nullable(),
});
export type Creance = z.infer<typeof creanceSchema>;

export const PIECE_KINDS = ['decompte', 'avis_echeance', 'facture', 'relance', 'mise_en_demeure', 'bail', 'grand_livre'] as const;

export const pieceSchema = z.object({
  id,
  kind: z.enum(PIECE_KINDS),
  libelle: z.string().min(1),
  octets: positiveMinor,
  facultative: z.boolean(),
});
export type Piece = z.infer<typeof pieceSchema>;

export const liasseSchema = z.object({
  id,
  genereLe: isoDate,
  pieces: z.array(pieceSchema).min(1),
  octets: positiveMinor,
  empreinte: z.string(),
});
export type Liasse = z.infer<typeof liasseSchema>;

export const TRANSMISSION_DUREES = [3, 7, 14, 30] as const;
export const emailSchema = z.string().trim().min(1, 'Le contact n’a pas d’adresse e-mail.').pipe(z.email('Adresse e-mail invalide.'));

export const transmissionSchema = z.object({
  id,
  liasseId: id,
  destinataireId: id,
  destinataire: z.string().min(1),
  email: emailSchema,
  envoyeLe: isoDate,
  dureeJours: z.number().int().min(1).max(30),
  expireLe: isoDate,
  message: z.string(),
  revoqueLe: isoDate.nullable(),
  telechargements: z.number().int().nonnegative(),
});
export type Transmission = z.infer<typeof transmissionSchema>;

export const dossierSchema = z.object({
  id,
  numero: z.string().min(1),
  bailId: id,
  ouvertLe: isoDate,
  delaiJusquau: isoDate.nullable(),
  creances: z.array(creanceSchema).min(1),
  actes: z.array(acteSchema),
  plan: planSchema.nullable(),
  liasses: z.array(liasseSchema),
  transmissions: z.array(transmissionSchema),
});
export type Dossier = z.infer<typeof dossierSchema>;

export const regularisationSchema = z.object({
  id,
  bailId: id,
  debut: isoDate,
  fin: isoDate,
  provisions: z.number().int().nonnegative(),
  chargesReelles: z.number().int().nonnegative(),
  justificatifs: z.array(z.string()),
  statut: z.enum(['brouillon', 'emise']),
  factureId: id.nullable(),
});
export type Regularisation = z.infer<typeof regularisationSchema>;

export const bilanLigneSchema = z.object({
  id,
  categorie: z.string().min(1),
  detail: z.string(),
  sens: z.enum(['recette', 'charge']),
  montant: z.number().int().nonnegative(),
  justificatifs: z.enum(['complet', 'manquants']),
  manquants: z.number().int().nonnegative(),
});
export type BilanLigne = z.infer<typeof bilanLigneSchema>;

export const bilanSchema = z.object({
  annee: z.number().int(),
  lignes: z.array(bilanLigneSchema),
  amortissementsLmnp: z.number().int().nonnegative(),
});
export type Bilan = z.infer<typeof bilanSchema>;

export const pretSchema = z.object({
  id,
  bien: z.string().min(1),
  banque: z.string().min(1),
  emprunte: positiveMinor,
  tauxBp: z.number().int().nonnegative(),
  fin: yearMonth,
  mensualite: z.number().int().nonnegative(),
  restantDu: z.number().int().nonnegative(),
  interetsAnnee: z.number().int().nonnegative(),
  statut: z.enum(['en_cours', 'rembourse', 'archive']),
  supprime: z.boolean(),
  echeancier: z
    .array(z.object({ date: isoDate, mensualite: z.number().int(), interets: z.number().int(), capital: z.number().int(), restant: z.number().int() }))
    .nullable(),
});
export type Pret = z.infer<typeof pretSchema>;

export const ligneBancaireSchema = z.object({
  id,
  date: isoDate,
  libelle: z.string().min(1),
  compte: z.string().min(1),
  montant: minor,
  statut: z.enum(['a_rapprocher', 'rapprochee', 'archivee']),
  echeanceProposeeId: id.nullable(),
  indication: z.string(),
  cle: z.string().min(1),
});
export type LigneBancaire = z.infer<typeof ligneBancaireSchema>;

export const automatisationSchema = z.object({ id, libelle: z.string().min(1), active: z.boolean() });
export type Automatisation = z.infer<typeof automatisationSchema>;

export const financesSchema = z.object({
  today: isoDate,
  currency: z.enum(CURRENCIES),
  workspace: z.object({ nom: z.string().min(1), adresse: z.string().min(1), compte: z.string().min(1) }),
  baux: z.array(bailSchema),
  fournisseurs: z.array(z.string().min(1)),
  echeances: z.array(echeanceSchema),
  paiements: z.array(paiementSchema),
  depenses: z.array(depenseSchema),
  relances: z.array(relanceSchema),
  factures: z.array(factureSchema),
  recus: z.array(recuSchema),
  dossiers: z.array(dossierSchema),
  regularisations: z.array(regularisationSchema),
  bilans: z.array(bilanSchema),
  prets: z.array(pretSchema),
  lignesBancaires: z.array(ligneBancaireSchema),
  automatisations: z.array(automatisationSchema),
  resume: z.object({ previsionnel12Mois: minor, declaration: z.object({ annee: z.number().int(), statut: z.enum(['brouillon', 'validee']) }) }),
  sequences: z.object({ FA: z.number().int().nonnegative(), AV: z.number().int().nonnegative(), RC: z.number().int().nonnegative(), DOS: z.number().int().nonnegative() }),
});
export type FinancesData = z.infer<typeof financesSchema>;
