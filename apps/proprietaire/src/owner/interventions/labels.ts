import type { BadgeTone } from "@eguardimmo/ui";

export const INTERVENTION_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  qualified: { label: "Qualifiée", tone: "info" },
  cancelled: { label: "Annulée", tone: "neutral" },
  quoting: { label: "Devis en cours", tone: "info" },
  awaiting_approval: { label: "En attente d’accord", tone: "warning" },
  approved: { label: "Accord donné", tone: "info" },
  scheduled: { label: "Planifiée", tone: "info" },
  in_progress: { label: "En cours", tone: "info" },
  completed: { label: "Terminée", tone: "success" },
  invoiced: { label: "Facturée", tone: "success" },
  closed: { label: "Clôturée", tone: "neutral" },
};

export const PRIORITY: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  urgent: { label: "Urgente", tone: "danger" },
  normal: { label: "Normale", tone: "neutral" },
  low: { label: "Basse", tone: "neutral" },
};

export const RESPONSIBILITY: Readonly<Record<string, string>> = {
  owner: "À votre charge",
  tenant: "À la charge du locataire",
  shared: "Partagée",
  undetermined: "À déterminer",
};

export const APPROVAL_BASIS: Readonly<Record<string, string>> = {
  under_ceiling: "Sous le plafond de travaux du mandat",
  owner_approved: "Accord du mandant",
  emergency: "Urgence",
  self_managed: "Gérée par le propriétaire",
};

export const VISIT_SLOT: Readonly<Record<string, string>> = { morning: "Matin", afternoon: "Après-midi", evening: "Soirée" };

export const VISIT_STATUS: Readonly<Record<string, string>> = {
  proposed: "Proposée",
  confirmed: "Confirmée",
  reschedule_requested: "Report demandé",
  done: "Réalisée",
  cancelled: "Annulée",
  no_show: "Absence constatée",
};

export const EVENT_KIND: Readonly<Record<string, string>> = {
  reported: "Signalement enregistré",
  updated: "Informations mises à jour",
  qualified: "Intervention qualifiée",
  declined: "Classée sans suite",
  cancelled: "Intervention annulée",
  comment: "Commentaire",
  supplier_assigned: "Prestataire désigné",
  visit_proposed: "Visite proposée",
  visit_confirmed: "Visite confirmée",
  visit_reschedule_requested: "Report de visite demandé",
  visit_done: "Visite réalisée",
  visit_cancelled: "Visite annulée",
  visit_no_show: "Absence à la visite",
  quote_recorded: "Devis reçu",
  quote_submitted: "Devis soumis",
  quote_accepted: "Devis accepté",
  quote_refused: "Devis refusé",
  approval_requested: "Accord demandé",
  approval_decided: "Accord décidé",
  approval_expired: "Demande d’accord expirée",
  approval_withdrawn: "Demande d’accord retirée",
  approved: "Travaux approuvés",
  emergency_engaged: "Travaux d’urgence engagés",
  started: "Travaux commencés",
  completed: "Travaux terminés",
  reopened: "Intervention rouverte",
  invoiced: "Facture enregistrée",
  closed: "Intervention clôturée",
  file_added: "Fichier ajouté",
  file_shared: "Fichier partagé",
};

export const EVENT_AUTHOR: Readonly<Record<string, string>> = { tenant: "Locataire", owner: "Vous", team: "Agence" };

export const FILE_KIND: Readonly<Record<string, string>> = {
  photo_before: "Photo avant travaux",
  photo_after: "Photo après travaux",
  quote: "Devis",
  invoice: "Facture",
  report: "Rapport",
  proof: "Justificatif",
  other: "Autre fichier",
};

export const QUOTE_KIND: Readonly<Record<string, string>> = { initial: "Devis initial", supplement: "Devis complémentaire" };

export const QUOTE_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  received: { label: "Reçu", tone: "neutral" },
  submitted: { label: "Soumis à votre décision", tone: "warning" },
  accepted: { label: "Accepté", tone: "success" },
  refused: { label: "Refusé", tone: "neutral" },
  expired: { label: "Expiré", tone: "neutral" },
  superseded: { label: "Remplacé", tone: "neutral" },
};

export const APPROVAL_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  pending: { label: "En attente de décision", tone: "warning" },
  accepted: { label: "Accepté", tone: "success" },
  refused: { label: "Refusé", tone: "neutral" },
  question: { label: "Précision demandée", tone: "info" },
  expired: { label: "Expiré", tone: "neutral" },
  withdrawn: { label: "Retiré", tone: "neutral" },
};

export const DECIDED_VIA: Readonly<Record<string, string>> = { owner_space: "Depuis votre espace", agency_recorded: "Enregistré par l’agence" };

export const SUPPLIER_INVOICE_STATUS: Readonly<Record<string, string>> = { recorded: "Enregistrée", allocated: "Imputée", cancelled: "Annulée" };
