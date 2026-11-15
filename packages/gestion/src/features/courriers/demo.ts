import { demoLeaseOrder, demoLeases, receiptNumberFor, RECEIPT_MONTHS } from '../baux/demo';
import { demoLeaseTerms } from '../locataires/demo';
import { noticeIdOf, receiptIdOf } from './paths';
import { emissionHistory } from './receiptHistory';
import type { Courrier, Notice, Receipt, Signature, Template } from './schemas';

export const demoTemplates: readonly Template[] = [
  {
    id: 'relance-de-loyer-impaye',
    name: 'Relance de loyer impayé',
    category: 'loyers',
    legalFrame: 'autre',
    unitId: null,
    sourceId: null,
    description: 'Premier rappel amiable, sans mise en demeure.',
    subject: 'Relance, loyer de {mois} impayé',
    body: 'Bonjour {civilite} {locataire},\n\nSauf erreur de notre part, le loyer de {mois} pour le logement {bien}, soit {montant_impaye}, n’a pas été réglé à ce jour.\n\nNous vous remercions de bien vouloir régulariser cette situation avant le {date_limite}. Si le paiement a été effectué entre-temps, merci de ne pas tenir compte de ce courrier.\n\nCordialement,\n{bailleur}',
    suggestRegistered: false,
    builtIn: true,
    archived: false,
    draft: false,
    updatedOn: '2026-01-15',
  },
  {
    id: 'avis-d-echeance',
    name: 'Avis d’échéance',
    category: 'loyers',
    legalFrame: 'autre',
    unitId: null,
    sourceId: null,
    description: 'Montant à régler et date limite.',
    subject: 'Avis d’échéance, {mois}',
    body: 'Bonjour {civilite} {locataire},\n\nVoici votre avis d’échéance pour {mois} : {loyer} à régler avant le {echeance} pour le logement {bien}.\n\nCordialement,\n{bailleur}',
    suggestRegistered: false,
    builtIn: true,
    archived: false,
    draft: false,
    updatedOn: '2026-01-15',
  },
  {
    id: 'quittance-de-loyer',
    name: 'Quittance de loyer',
    category: 'loyers',
    legalFrame: 'loi_1989',
    unitId: null,
    sourceId: null,
    description: 'Accusé de paiement du mois.',
    subject: 'Quittance de loyer, {mois}',
    body: 'Bonjour {civilite} {locataire},\n\nNous accusons réception de votre paiement de {loyer} pour {mois} et vous en donnons quittance pour le logement {bien}.\n\nCordialement,\n{bailleur}',
    suggestRegistered: false,
    builtIn: true,
    archived: false,
    draft: false,
    updatedOn: '2026-01-15',
  },
  {
    id: 'revision-du-loyer',
    name: 'Révision du loyer',
    category: 'baux',
    legalFrame: 'loi_1989',
    unitId: null,
    sourceId: null,
    description: 'Indice de référence des loyers, nouveau montant.',
    subject: 'Révision annuelle du loyer',
    body: 'Bonjour {civilite} {locataire},\n\nConformément à votre bail {reference_bail}, le loyer du logement {bien} est révisé selon l’indice de référence des loyers. Le nouveau montant, {loyer}, s’applique à compter du {echeance}.\n\nCordialement,\n{bailleur}',
    suggestRegistered: true,
    builtIn: true,
    archived: false,
    draft: false,
    updatedOn: '2026-02-03',
  },
  {
    id: 'accuse-de-reception-du-preavis',
    name: 'Accusé de réception du préavis',
    category: 'baux',
    legalFrame: 'loi_1989',
    unitId: null,
    sourceId: null,
    description: 'Réponse au préavis de départ du locataire.',
    subject: 'Accusé de réception de votre préavis',
    body: 'Bonjour {civilite} {locataire},\n\nNous accusons réception de votre préavis de départ du logement {bien}, bail {reference_bail}. Nous vous proposerons prochainement une date pour la visite de pré-sortie.\n\nCordialement,\n{bailleur}',
    suggestRegistered: false,
    builtIn: true,
    archived: false,
    draft: false,
    updatedOn: '2026-02-03',
  },
  {
    id: 'convocation-a-l-etat-des-lieux',
    name: 'Convocation à l’état des lieux',
    category: 'general',
    legalFrame: 'loi_1989',
    unitId: null,
    sourceId: null,
    description: 'Date et pièces à apporter.',
    subject: 'Convocation à l’état des lieux',
    body: 'Bonjour {civilite} {locataire},\n\nNous vous convoquons à l’état des lieux du logement {bien} le {echeance}. Merci de vous munir d’une pièce d’identité.\n\nCordialement,\n{bailleur}',
    suggestRegistered: false,
    builtIn: false,
    archived: false,
    draft: false,
    updatedOn: '2026-09-22',
  },
  {
    id: 'mise-en-demeure-de-payer',
    name: 'Mise en demeure de payer',
    category: 'recouvrement',
    legalFrame: 'loi_1989',
    unitId: null,
    sourceId: null,
    description: 'Envoyée après deux relances sans réponse.',
    subject: 'Mise en demeure de payer le loyer de {mois}',
    body: 'Bonjour {civilite} {locataire},\n\nMalgré nos relances, le loyer de {mois} pour le logement {bien}, d’un montant de {bail.loyer} hors charges, reste impayé. Le montant restant dû s’élève à {montant_impaye}.\n\nPar la présente, nous vous mettons en demeure de régler cette somme sous huit jours à compter de la réception de ce courrier.\n\nCordialement,\n{bailleur}',
    suggestRegistered: true,
    builtIn: false,
    archived: false,
    draft: false,
    updatedOn: '2026-11-04',
  },
  {
    id: 'conge-pour-vendre',
    name: 'Congé pour vendre',
    category: 'conges',
    legalFrame: 'loi_1989',
    unitId: null,
    sourceId: null,
    description: 'Préavis de six mois avant le terme du bail.',
    subject: 'Congé pour vendre, bail {reference_bail}',
    body: 'Bonjour {civilite} {locataire},\n\nPar la présente, nous vous donnons congé pour vendre du logement {bien}, bail {reference_bail}, avec un préavis de six mois avant le terme du bail, soit le {echeance}.\n\nCordialement,\n{bailleur}',
    suggestRegistered: true,
    builtIn: true,
    archived: false,
    draft: false,
    updatedOn: '2026-01-15',
  },
  {
    id: 'attestation-de-loyer',
    name: 'Attestation de loyer',
    category: 'attestations',
    legalFrame: 'autre',
    unitId: null,
    sourceId: null,
    description: 'Loyers et charges réglés.',
    subject: 'Attestation de loyer, {mois}',
    body: 'Bonjour {civilite} {locataire},\n\nNous attestons que le loyer de {bail.loyer} et la provision sur charges de {bail.charges} du logement {bien} sont à jour au {date}.\n\nCordialement,\n{bailleur}',
    suggestRegistered: false,
    builtIn: true,
    archived: false,
    draft: false,
    updatedOn: '2026-01-15',
  },
];

const courrierEntries: readonly Omit<Courrier, 'updatedOn' | 'archived' | 'sendings'>[] = [
  { id: 'cr-2026-0041', reference: 'CR-2026-0041', templateId: 'relance-de-loyer-impaye', tenantId: 'koffi-adjovi', unitId: 'apt-a1', subject: 'Relance, loyer de Novembre 2026 impayé', body: 'Bonjour M. Koffi Adjovi,\n\nSauf erreur de notre part, le loyer de Novembre 2026 pour le logement Apt A1, Les Tilleuls, soit 850,00 €, n’a pas été réglé à ce jour.\n\nNous vous remercions de bien vouloir régulariser cette situation avant le {date_limite}. Si le paiement a été effectué entre-temps, merci de ne pas tenir compte de ce courrier.\n\nCordialement,\nSCI Les Tilleuls', status: 'envoye', channel: 'email', createdOn: '2026-11-08', sentOn: '2026-11-08' },
  { id: 'cr-2026-0040', reference: 'CR-2026-0040', templateId: 'relance-de-loyer-impaye', tenantId: 'clarisse-hounkpatin', unitId: 'apt-b1', subject: 'Relance, loyer de Novembre 2026 impayé', body: 'Bonjour Mme Clarisse Hounkpatin,\n\nSauf erreur de notre part, le loyer de Novembre 2026 pour le logement Apt B1, Les Tilleuls, soit 210,00 €, n’a pas été réglé à ce jour.\n\nCordialement,\nSCI Les Tilleuls', status: 'brouillon', channel: 'email', createdOn: '2026-11-12', sentOn: null },
  { id: 'cr-2026-0038', reference: 'CR-2026-0038', templateId: 'revision-du-loyer', tenantId: 'nadege-sossou', unitId: 'apt-a2', subject: 'Révision annuelle du loyer', body: 'Bonjour Mme Nadège Sossou,\n\nConformément à votre bail BL-2024-0011, le loyer du logement Apt A2, Les Tilleuls est révisé selon l’indice de référence des loyers. Le nouveau montant, 990,00 €, s’applique à compter du 01/09/2026.\n\nCordialement,\nSCI Les Tilleuls', status: 'envoye', channel: 'lrar', createdOn: '2026-10-20', sentOn: '2026-10-20' },
  { id: 'cr-2026-0035', reference: 'CR-2026-0035', templateId: 'convocation-a-l-etat-des-lieux', tenantId: 'yann-le-gall', unitId: 'studio-b3', subject: 'Convocation à l’état des lieux', body: 'Bonjour M. Yann Le Gall,\n\nNous vous convoquons à l’état des lieux du logement Studio B3, Les Tilleuls le 31/01/2027. Merci de vous munir d’une pièce d’identité.\n\nCordialement,\nSCI Les Tilleuls', status: 'genere', channel: 'courrier', createdOn: '2026-11-09', sentOn: null },
  { id: 'cr-2026-0029', reference: 'CR-2026-0029', templateId: 'convocation-a-l-etat-des-lieux', tenantId: 'nadege-sossou', unitId: 'apt-a2', subject: 'Convocation à l’état des lieux', body: 'Bonjour Mme Nadège Sossou,\n\nNous vous convoquons à l’état des lieux du logement Apt A2, Les Tilleuls le 30/09/2026. Merci de vous munir d’une pièce d’identité.\n\nCordialement,\nSCI Les Tilleuls', status: 'envoye', channel: 'courrier', createdOn: '2026-09-14', sentOn: '2026-09-14' },
];

export const demoCourriers: readonly Courrier[] = courrierEntries.map((item) => ({
  ...item,
  updatedOn: item.sentOn ?? item.createdOn,
  archived: false,
  sendings: item.sentOn ? [{ on: item.sentOn, channel: item.channel, resend: false }] : [],
}));

const signatureEntries: readonly Omit<Signature, 'fileName'>[] = [
  { id: 'sg-2026-0012', reference: 'SG-2026-0012', title: 'Bail Studio B3, avenant', files: ['avenant-studio-b3.pdf'], unitId: 'studio-b3', signers: [{ name: 'Yann Le Gall', email: 'yann.legall@example.com', status: 'signe' }, { name: 'SCI Les Tilleuls', email: 'gestion@example.com', status: 'attente' }], status: 'en_cours', createdOn: '2026-11-05', completedOn: null, reminderSentOn: null, fields: [{ signer: 0, page: 3, x: 20, y: 85 }, { signer: 1, page: 3, x: 80, y: 85 }] },
  { id: 'sg-2026-0011', reference: 'SG-2026-0011', title: 'Bail Apt B1', files: ['bail-apt-b1.pdf', 'annexe-diagnostics.pdf'], unitId: 'apt-b1', signers: [{ name: 'Clarisse Hounkpatin', email: 'clarisse.hounkpatin@example.com', status: 'signe' }, { name: 'SCI Les Tilleuls', email: 'gestion@example.com', status: 'signe' }], status: 'signe', createdOn: '2025-08-20', completedOn: '2025-08-24', reminderSentOn: null, fields: [{ signer: 0, page: 3, x: 20, y: 85 }, { signer: 1, page: 3, x: 80, y: 85 }] },
  { id: 'sg-2026-0010', reference: 'SG-2026-0010', title: 'Mandat de gestion', files: ['mandat-gestion.pdf'], unitId: null, signers: [{ name: 'Marc Dossou', email: 'marc.dossou@example.com', status: 'attente' }], status: 'annule', createdOn: '2026-09-02', completedOn: null, reminderSentOn: null, fields: [{ signer: 0, page: 3, x: 70, y: 85 }] },
  { id: 'sg-2026-0009', reference: 'SG-2026-0009', title: 'Avenant Apt A1', files: ['avenant-apt-a1.pdf'], unitId: 'apt-a1', signers: [{ name: 'Koffi Adjovi', email: 'koffi.adjovi@example.com', status: 'refuse' }, { name: 'SCI Les Tilleuls', email: 'gestion@example.com', status: 'signe' }], status: 'refuse', createdOn: '2026-11-05', completedOn: null, reminderSentOn: null, fields: [{ signer: 0, page: 3, x: 20, y: 85 }, { signer: 1, page: 3, x: 80, y: 85 }] },
];

export const demoSignatures: readonly Signature[] = signatureEntries.map((item) => ({ ...item, fileName: item.files[0] ?? '' }));

const activeLeases = demoLeases.filter((lease) => lease.status === 'en_cours' || lease.status === 'preavis');
const orderedActive = [...activeLeases].sort((a, b) => demoLeaseOrder.indexOf(a.id as (typeof demoLeaseOrder)[number]) - demoLeaseOrder.indexOf(b.id as (typeof demoLeaseOrder)[number]));

type ReceiptEntry = Omit<Receipt, 'fingerprint' | 'cancellation' | 'history'>;

const receiptEntries: readonly ReceiptEntry[] = [
  ...orderedActive.flatMap((lease) =>
    RECEIPT_MONTHS.flatMap((month): ReceiptEntry[] => {
      const number = receiptNumberFor(lease.id, month);
      const tenantId = demoLeaseTerms[lease.id]?.tenantId;
      if (!number || !tenantId) return [];
      return [{ id: receiptIdOf(number), number, leaseId: lease.id, tenantId, unitId: lease.unitId, month, rent: lease.rent, charges: lease.charges, outstanding: 0, issuedOn: `${month}-05`, sentOn: `${month}-05` }];
    }),
  ),
  ...orderedActive
    .filter((lease) => lease.balance === 0)
    .flatMap((lease): ReceiptEntry[] => {
      const tenantId = demoLeaseTerms[lease.id]?.tenantId;
      return tenantId ? [{ id: `en-attente-202611-${lease.id}`, number: null, leaseId: lease.id, tenantId, unitId: lease.unitId, month: '2026-11', rent: lease.rent, charges: lease.charges, outstanding: 0, issuedOn: null, sentOn: null }] : [];
    }),
  ...orderedActive
    .filter((lease) => lease.balance < 0)
    .flatMap((lease): ReceiptEntry[] => {
      const tenantId = demoLeaseTerms[lease.id]?.tenantId;
      return tenantId ? [{ id: `a-solder-202611-${lease.id}`, number: null, leaseId: lease.id, tenantId, unitId: lease.unitId, month: '2026-11', rent: lease.rent, charges: lease.charges, outstanding: -lease.balance, issuedOn: null, sentOn: null }] : [];
    }),
];

export const demoReceipts: readonly Receipt[] = receiptEntries.map((item) => ({ ...item, fingerprint: null, cancellation: null, history: emissionHistory(item.issuedOn, item.sentOn) }));

export const demoNotices: readonly Notice[] = orderedActive.flatMap((lease): Notice[] => {
  const tenantId = demoLeaseTerms[lease.id]?.tenantId;
  if (!tenantId) return [];
  const arrears = lease.balance < 0 ? -lease.balance : 0;
  const base = { leaseId: lease.id, tenantId, unitId: lease.unitId, rent: lease.rent, charges: lease.charges };
  return [
    { id: noticeIdOf(lease.id, '2026-11'), ...base, month: '2026-11', due: '2026-11-01', arrears: 0, sentOn: '2026-10-25' },
    ...(lease.end >= '2026-12-01' ? [{ id: noticeIdOf(lease.id, '2026-12'), ...base, month: '2026-12', due: '2026-12-01', arrears, sentOn: null }] : []),
  ];
});

export const demoTemplateIds: readonly string[] = demoTemplates.map((template) => template.id);
export const demoCourrierIds: readonly string[] = demoCourriers.map((courrier) => courrier.id);
export const demoReceiptIds: readonly string[] = demoReceipts.filter((receipt) => receipt.number !== null).map((receipt) => receipt.id);
export const demoNoticeIds: readonly string[] = demoNotices.map((notice) => notice.id);
