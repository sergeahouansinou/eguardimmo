export const libraryPaths = {
  documents: '/documents',
  add: '/documents/ajout',
  certificates: '/conformite',
};

export const issuedDocumentLinks = [
  { label: 'Quittances de loyer', href: '/finances/loyers/quittances' },
  { label: 'Comptes rendus de gestion', href: '/comptes-rendus' },
  { label: 'Factures', href: '/finances/factures' },
  { label: 'Devis', href: '/devis' },
] as const;
