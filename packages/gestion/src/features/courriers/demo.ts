import { demoLeaseOrder, demoLeases, receiptNumberFor, RECEIPT_MONTHS } from '../baux/demo';
import { demoLeaseTerms } from '../locataires/demo';
import { noticeIdOf, receiptIdOf } from './paths';
import type { Courrier, Notice, Receipt, Signature, Template } from './schemas';

export const demoTemplates: readonly Template[] = [
  {
    id: 'relance-de-loyer-impaye',
    name: 'Relance de loyer impayé',
    category: 'loyers',
    subject: 'Relance, loyer de {mois} impayé',
    body: 'Bonjour {civilite} {locataire},\n\nSauf erreur de notre part, le loyer de {mois} pour le logement {bien}, soit {montant_impaye}, n’a pas été réglé à ce jour.\n\nNous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais. Si le paiement a été effectué entre-temps, merci de ne pas tenir compte de ce courrier.\n\nCordialement,\n{bailleur}',
    builtIn: true,
    archived: false,
    updatedOn: '2026-01-15',
  },
  {
    id: 'avis-d-echeance',
    name: 'Avis d’échéance',
    category: 'loyers',
    subject: 'Avis d’échéance, {mois}',
    body: 'Bonjour {civilite} {locataire},\n\nVoici votre avis d’échéance pour {mois} : {loyer} à régler avant le {echeance} pour le logement {bien}.\n\nCordialement,\n{bailleur}',
    builtIn: true,
    archived: false,
    updatedOn: '2026-01-15',
  },
  {
    id: 'quittance-de-loyer',
    name: 'Quittance de loyer',
    category: 'loyers',
    subject: 'Quittance de loyer, {mois}',
    body: 'Bonjour {civilite} {locataire},\n\nNous accusons réception de votre paiement de {loyer} pour {mois} et vous en donnons quittance pour le logement {bien}.\n\nCordialement,\n{bailleur}',
    builtIn: true,
    archived: false,
    updatedOn: '2026-01-15',
  },
  {
    id: 'revision-du-loyer',
    name: 'Révision du loyer',
    category: 'baux',
    subject: 'Révision annuelle du loyer',
    body: 'Bonjour {civilite} {locataire},\n\nConformément à votre bail {reference_bail}, le loyer du logement {bien} est révisé selon l’indice de référence des loyers. Le nouveau montant, {loyer}, s’applique à compter du {echeance}.\n\nCordialement,\n{bailleur}',
    builtIn: true,
    archived: false,
    updatedOn: '2026-02-03',
  },
  {
    id: 'accuse-de-reception-du-preavis',
    name: 'Accusé de réception du préavis',
    category: 'baux',
    subject: 'Accusé de réception de votre préavis',
    body: 'Bonjour {civilite} {locataire},\n\nNous accusons réception de votre préavis de départ du logement {bien}, bail {reference_bail}. Nous vous proposerons prochainement une date pour la visite de pré-sortie.\n\nCordialement,\n{bailleur}',
    builtIn: true,
    archived: false,
    updatedOn: '2026-02-03',
  },
  {
    id: 'convocation-a-l-etat-des-lieux',
    name: 'Convocation à l’état des lieux',
    category: 'general',
    subject: 'Convocation à l’état des lieux',
    body: 'Bonjour {civilite} {locataire},\n\nNous vous convoquons à l’état des lieux du logement {bien} le {echeance}. Merci de vous munir d’une pièce d’identité.\n\nCordialement,\n{bailleur}',
    builtIn: false,
    archived: false,
    updatedOn: '2026-09-22',
  },
];

export const demoCourriers: readonly Courrier[] = [
  { id: 'cr-2026-0041', reference: 'CR-2026-0041', templateId: 'relance-de-loyer-impaye', tenantId: 'koffi-adjovi', unitId: 'apt-a1', subject: 'Relance, loyer de Novembre 2026 impayé', body: 'Bonjour M. Koffi Adjovi,\n\nSauf erreur de notre part, le loyer de Novembre 2026 pour le logement Apt A1, Les Tilleuls, soit 850,00 €, n’a pas été réglé à ce jour.\n\nNous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais. Si le paiement a été effectué entre-temps, merci de ne pas tenir compte de ce courrier.\n\nCordialement,\nSCI Les Tilleuls', status: 'envoye', channel: 'email', createdOn: '2026-11-08', sentOn: '2026-11-08' },
  { id: 'cr-2026-0040', reference: 'CR-2026-0040', templateId: 'relance-de-loyer-impaye', tenantId: 'clarisse-hounkpatin', unitId: 'apt-b1', subject: 'Relance, loyer de Novembre 2026 impayé', body: 'Bonjour Mme Clarisse Hounkpatin,\n\nSauf erreur de notre part, le loyer de Novembre 2026 pour le logement Apt B1, Les Tilleuls, soit 210,00 €, n’a pas été réglé à ce jour.\n\nCordialement,\nSCI Les Tilleuls', status: 'brouillon', channel: 'email', createdOn: '2026-11-12', sentOn: null },
  { id: 'cr-2026-0038', reference: 'CR-2026-0038', templateId: 'revision-du-loyer', tenantId: 'nadege-sossou', unitId: 'apt-a2', subject: 'Révision annuelle du loyer', body: 'Bonjour Mme Nadège Sossou,\n\nConformément à votre bail BL-2024-0011, le loyer du logement Apt A2, Les Tilleuls est révisé selon l’indice de référence des loyers. Le nouveau montant, 990,00 €, s’applique à compter du 01/09/2026.\n\nCordialement,\nSCI Les Tilleuls', status: 'envoye', channel: 'lrar', createdOn: '2026-10-20', sentOn: '2026-10-20' },
  { id: 'cr-2026-0035', reference: 'CR-2026-0035', templateId: 'convocation-a-l-etat-des-lieux', tenantId: 'yann-le-gall', unitId: 'studio-b3', subject: 'Convocation à l’état des lieux', body: 'Bonjour M. Yann Le Gall,\n\nNous vous convoquons à l’état des lieux du logement Studio B3, Les Tilleuls le 31/01/2027. Merci de vous munir d’une pièce d’identité.\n\nCordialement,\nSCI Les Tilleuls', status: 'genere', channel: 'courrier', createdOn: '2026-11-09', sentOn: null },
];

export const demoSignatures: readonly Signature[] = [
  { id: 'sg-2026-0012', reference: 'SG-2026-0012', title: 'Bail Studio B3, avenant', fileName: 'avenant-studio-b3.pdf', signers: [{ name: 'Yann Le Gall', email: 'yann.legall@example.com', status: 'signe' }, { name: 'SCI Les Tilleuls', email: 'gestion@example.com', status: 'attente' }], status: 'en_cours', createdOn: '2026-11-05', completedOn: null },
  { id: 'sg-2026-0011', reference: 'SG-2026-0011', title: 'Bail Apt B1', fileName: 'bail-apt-b1.pdf', signers: [{ name: 'Clarisse Hounkpatin', email: 'clarisse.hounkpatin@example.com', status: 'signe' }, { name: 'SCI Les Tilleuls', email: 'gestion@example.com', status: 'signe' }], status: 'signe', createdOn: '2025-08-20', completedOn: '2025-08-24' },
  { id: 'sg-2026-0010', reference: 'SG-2026-0010', title: 'Mandat de gestion', fileName: 'mandat-gestion.pdf', signers: [{ name: 'Marc Dossou', email: 'marc.dossou@example.com', status: 'attente' }], status: 'annule', createdOn: '2026-09-02', completedOn: null },
];

const activeLeases = demoLeases.filter((lease) => lease.status === 'en_cours' || lease.status === 'preavis');
const orderedActive = [...activeLeases].sort((a, b) => demoLeaseOrder.indexOf(a.id as (typeof demoLeaseOrder)[number]) - demoLeaseOrder.indexOf(b.id as (typeof demoLeaseOrder)[number]));

export const demoReceipts: readonly Receipt[] = [
  ...orderedActive.flatMap((lease) =>
    RECEIPT_MONTHS.flatMap((month): Receipt[] => {
      const number = receiptNumberFor(lease.id, month);
      const tenantId = demoLeaseTerms[lease.id]?.tenantId;
      if (!number || !tenantId) return [];
      return [{ id: receiptIdOf(number), number, leaseId: lease.id, tenantId, unitId: lease.unitId, month, rent: lease.rent, charges: lease.charges, issuedOn: `${month}-05`, sentOn: `${month}-05` }];
    }),
  ),
  ...orderedActive
    .filter((lease) => lease.balance === 0)
    .flatMap((lease): Receipt[] => {
      const tenantId = demoLeaseTerms[lease.id]?.tenantId;
      return tenantId ? [{ id: `en-attente-202611-${lease.id}`, number: null, leaseId: lease.id, tenantId, unitId: lease.unitId, month: '2026-11', rent: lease.rent, charges: lease.charges, issuedOn: null, sentOn: null }] : [];
    }),
];

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
