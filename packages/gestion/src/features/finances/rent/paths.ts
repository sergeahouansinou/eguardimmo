export const rentPaths = {
  installments: '/finances/loyers',
  installment: (id: string) => `/finances/loyers/${id}`,
  notices: '/baux/avis-echeance',
  payments: '/finances/loyers/paiements',
  newPayment: (leaseId?: string) => (leaseId ? `/finances/loyers/paiements/nouveau?bail=${encodeURIComponent(leaseId)}` : '/finances/loyers/paiements/nouveau'),
  receipts: '/finances/loyers/quittances',
  receipt: (id: string) => `/finances/loyers/quittances/${id}`,
};
