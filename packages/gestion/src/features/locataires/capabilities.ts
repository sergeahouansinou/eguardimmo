export const LOCATAIRES_FEATURES = ['balance', 'documents', 'messages', 'portal', 'candidates', 'deletion', 'identityExtras', 'idAttachment'] as const;
export type LocatairesFeature = (typeof LOCATAIRES_FEATURES)[number];

export const locatairesFeatureLabel: Record<LocatairesFeature, string> = {
  balance: 'Soldes, paiements, retards et activités du compte',
  documents: 'Dossier et documents du locataire',
  messages: 'Messages du locataire',
  portal: 'Invitations et espace locataire',
  candidates: 'Candidats et dossiers de candidature',
  deletion: 'Suppression d’un locataire',
  identityExtras: 'Civilité et profession',
  idAttachment: 'Date d’expiration et copie de la pièce d’identité',
};
