import type { AccessKind, AccessScope, AccessStatus, EmergencyBasis } from './model';

export const ACCESS_PRIVACY_TEXT =
  'Le support ne lit jamais vos conversations, ni celles avec vos locataires ou vos mandants. Un accès est en lecture seule, limité à ce que vous autorisez, et prend fin à la résolution de la demande.';

export const scopeLabel: Record<AccessScope, string> = {
  settings: 'Réglages',
  team: 'Équipe',
  records: 'Dossiers',
  documents: 'Documents',
};

export const scopeHint: Record<AccessScope, string> = {
  settings: 'Nom, pays et devise de l’organisation, plan et modules.',
  team: 'Membres et rôles, sans double authentification ni secret.',
  records: 'Biens, baux, mandats et parties en lecture, coordonnées masquées.',
  documents: 'Liste des documents et téléchargement.',
};

export const statusLabel: Record<AccessStatus, string> = {
  requested: 'À traiter',
  active: 'En cours',
  refused: 'Refusé',
  revoked: 'Révoqué',
  expired: 'Expiré',
};

export const kindLabel: Record<AccessKind, string> = {
  consent: 'Demande d’accès',
  emergency: 'Accès d’urgence',
};

export const basisLabel: Record<EmergencyBasis, string> = {
  security_incident: 'Incident de sécurité',
  legal_requisition: 'Réquisition légale',
};
