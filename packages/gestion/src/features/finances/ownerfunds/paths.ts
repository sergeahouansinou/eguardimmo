export const ownerFundsPaths = {
  payouts: '/finances/reversements',
  batch: (id: string) => `/finances/reversements/lot?lot=${encodeURIComponent(id)}`,
  mandant: (id: string) => `/finances/reversements/${id}`,
  requests: '/finances/reversements/demandes-iban',
  requestsOf: (mandantId: string) => `/finances/reversements/demandes-iban?mandant=${encodeURIComponent(mandantId)}`,
  fees: '/finances/honoraires',
  simulation: '/finances/honoraires/bareme',
  amendment: '/mandats/avenant',
  trust: '/finances/fonds',
  closing: '/finances/cloture',
  security: '/compte/securite',
  invoice: (id: string) => `/finances/factures/${id}`,
};
