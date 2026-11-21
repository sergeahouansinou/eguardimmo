import type { BadgeTone } from '@eguardimmo/ui';
import { formatMoney } from '../../format/money';
import type {
  ActorKind,
  AllocationTarget,
  ApprovalBasis,
  ApprovalDecision,
  ApprovalStatus,
  DeclineReason,
  FileKind,
  InterventionStatus,
  Money,
  Origin,
  PaymentMethod,
  Priority,
  QuoteKind,
  QuoteStatus,
  ReportedUrgency,
  Responsibility,
  SupplierInvoiceStatus,
  SupplierStatus,
  TaxCategory,
  VisitSlot,
  VisitStatus,
} from './model';

interface BadgeView {
  label: string;
  tone: BadgeTone;
}

export const statusBadge: Record<InterventionStatus, BadgeView> = {
  reported: { label: 'Signalée', tone: 'info' },
  qualified: { label: 'Qualifiée', tone: 'info' },
  declined: { label: 'Classée sans suite', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
  quoting: { label: 'Devis en cours', tone: 'warning' },
  awaiting_approval: { label: 'Accord du mandant attendu', tone: 'warning' },
  approved: { label: 'Accordée', tone: 'success' },
  scheduled: { label: 'Planifiée', tone: 'info' },
  in_progress: { label: 'En cours', tone: 'info' },
  completed: { label: 'Terminée', tone: 'success' },
  invoiced: { label: 'Facturée', tone: 'warning' },
  closed: { label: 'Clôturée', tone: 'neutral' },
};

export const priorityBadge: Record<Priority, BadgeView> = {
  urgent: { label: 'Urgente', tone: 'danger' },
  normal: { label: 'Normale', tone: 'neutral' },
  low: { label: 'Basse', tone: 'neutral' },
};

export const urgencyLabel: Record<ReportedUrgency, string> = { urgent: 'Urgente', soon: 'Rapidement', normal: 'Normale' };

export const responsibilityLabel: Record<Responsibility, string> = {
  owner: 'Propriétaire',
  tenant: 'Locataire',
  shared: 'Partagée',
  undetermined: 'À déterminer',
};

export const originLabel: Record<Origin, string> = { tenant: 'Signalée par le locataire', team: 'Créée par l’équipe' };

export const basisLabel: Record<ApprovalBasis, string> = {
  under_ceiling: 'Sous le plafond du mandat',
  owner_approved: 'Accord du mandant',
  emergency: 'Urgence',
  self_managed: 'Gestion directe',
};

export const approvalBadge: Record<ApprovalStatus, BadgeView> = {
  pending: { label: 'En attente', tone: 'warning' },
  accepted: { label: 'Accepté', tone: 'success' },
  refused: { label: 'Refusé', tone: 'danger' },
  question: { label: 'Question posée', tone: 'info' },
  expired: { label: 'Expiré', tone: 'neutral' },
  withdrawn: { label: 'Retiré', tone: 'neutral' },
};

export const decisionLabel: Record<ApprovalDecision, string> = { accept: 'Le mandant accepte', refuse: 'Le mandant refuse', question: 'Le mandant pose une question' };

export const quoteBadge: Record<QuoteStatus, BadgeView> = {
  received: { label: 'Reçu', tone: 'info' },
  submitted: { label: 'Soumis au mandant', tone: 'warning' },
  accepted: { label: 'Accepté', tone: 'success' },
  refused: { label: 'Refusé', tone: 'danger' },
  expired: { label: 'Expiré', tone: 'neutral' },
  superseded: { label: 'Remplacé', tone: 'neutral' },
};

export const quoteKindLabel: Record<QuoteKind, string> = { initial: 'Devis initial', supplement: 'Devis complémentaire' };

export const visitBadge: Record<VisitStatus, BadgeView> = {
  proposed: { label: 'Proposée', tone: 'warning' },
  confirmed: { label: 'Confirmée', tone: 'success' },
  reschedule_requested: { label: 'Report demandé', tone: 'warning' },
  done: { label: 'Effectuée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
  no_show: { label: 'Absence constatée', tone: 'danger' },
};

export const slotLabel: Record<VisitSlot, string> = { morning: 'Matin', afternoon: 'Après-midi', evening: 'Fin de journée' };

export const invoiceBadge: Record<SupplierInvoiceStatus, BadgeView> = {
  recorded: { label: 'À imputer', tone: 'warning' },
  allocated: { label: 'Imputée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const methodLabel: Record<PaymentMethod, string> = {
  transfer: 'Virement',
  cheque: 'Chèque',
  cash: 'Espèces',
  card: 'Carte',
  direct_debit: 'Prélèvement',
};

export const targetLabel: Record<AllocationTarget, string> = { owner: 'Propriétaire (mandant)', deposit: 'Dépôt de garantie' };

export const supplierBadge: Record<SupplierStatus, BadgeView> = {
  active: { label: 'Actif', tone: 'success' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  archived: { label: 'Archivé', tone: 'neutral' },
};

export const declineReasonLabel: Record<DeclineReason, string> = {
  duplicate: 'Doublon',
  out_of_scope: 'Hors périmètre',
  not_an_issue: 'Pas de désordre constaté',
  tenant_responsibility: 'Entretien locatif',
  other: 'Autre motif',
};

export const fileKindLabel: Record<FileKind, string> = {
  photo_before: 'Photo avant travaux',
  photo_after: 'Photo après travaux',
  quote: 'Devis',
  invoice: 'Facture',
  report: 'Compte rendu',
  proof: 'Preuve d’accord',
  other: 'Autre pièce',
};

export const actorLabel: Record<ActorKind, string> = { team: 'Agence', owner: 'Mandant', tenant: 'Locataire', system: 'Système' };

export const taxCategoryLabel: Record<TaxCategory, string> = {
  S: 'Taux normal',
  Z: 'Taux zéro',
  E: 'Exonéré',
  AE: 'Autoliquidation',
  O: 'Hors champ',
};

export const eventLabel: Readonly<Record<string, string>> = {
  reported: 'Intervention signalée',
  updated: 'Intervention modifiée',
  qualified: 'Intervention qualifiée',
  declined: 'Classée sans suite',
  cancelled: 'Intervention annulée',
  comment: 'Commentaire',
  supplier_assigned: 'Prestataire assigné',
  visit_proposed: 'Visite proposée',
  visit_confirmed: 'Visite confirmée',
  visit_reschedule_requested: 'Report de visite demandé',
  visit_done: 'Visite effectuée',
  visit_cancelled: 'Visite annulée',
  visit_no_show: 'Absence à la visite',
  quote_recorded: 'Devis enregistré',
  quote_submitted: 'Devis soumis au mandant',
  quote_accepted: 'Devis accepté',
  quote_refused: 'Devis refusé',
  approval_requested: 'Accord du mandant demandé',
  approval_decided: 'Décision du mandant enregistrée',
  approval_expired: 'Demande d’accord expirée',
  approval_withdrawn: 'Demande d’accord retirée',
  approved: 'Travaux accordés',
  emergency_engaged: 'Engagement en urgence',
  started: 'Travaux démarrés',
  completed: 'Travaux terminés',
  reopened: 'Intervention rouverte',
  invoiced: 'Facture reçue',
  closed: 'Intervention clôturée',
  file_added: 'Pièce ajoutée',
  file_shared: 'Pièce partagée',
};

export const eventText = (kind: string): string => eventLabel[kind] ?? 'Événement';

export const moneyText = (value: Money): string => formatMoney(value.amount, value.currency);

export const isTerminal = (status: InterventionStatus): boolean => status === 'declined' || status === 'cancelled' || status === 'closed';
