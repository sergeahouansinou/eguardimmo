export const courriersPaths = {
  documents: '/documents',
  quittances: '/documents/quittances',
  quittance: (id: string) => `/documents/quittances/${id}`,
  notices: '/documents/avis-echeance',
  notice: (id: string) => `/documents/avis-echeance/${id}`,
  courriers: '/documents/courriers',
  courrier: (id: string) => `/documents/courriers/${id}`,
  newCourrier: '/documents/courriers/nouveau',
  editCourrier: (id: string) => `/documents/courriers/${id}/modifier`,
  signatures: '/documents/signatures',
  newSignature: '/documents/signatures/nouvelle',
  signatureFor: (title: string, fileName: string) => `/documents/signatures/nouvelle?${new URLSearchParams({ titre: title, fichier: fileName }).toString()}`,
  attestation: (id: string) => `/documents/attestations/${id}`,
  modeles: '/modeles',
  newModele: '/modeles/nouveau',
  modele: (id: string) => `/modeles/${id}`,
  editModele: (id: string) => `/modeles/${id}/modifier`,
};

export const receiptIdOf = (number: string): string => number.toLowerCase();
export const noticeIdOf = (leaseId: string, month: string): string => `av-${month.replace('-', '')}01-${leaseId}`;
