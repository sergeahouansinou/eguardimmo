const segment = encodeURIComponent;

export const tenantRequestsPaths = {
  notices: '/baux/conges',
  notice: (id: string) => `/baux/conges/${segment(id)}`,
  insurance: '/conformite/assurances',
  inspections: '/baux/etats-des-lieux',
  inspectionsOf: (leaseId: string) => `/baux/etats-des-lieux?bail=${segment(leaseId)}`,
  inspectionNew: (leaseId: string) => `/baux/etats-des-lieux/nouveau?bail=${segment(leaseId)}`,
  inspection: (id: string) => `/baux/etats-des-lieux/${segment(id)}`,
  onlinePayments: '/finances/paiements-en-ligne',
  lease: (id: string) => `/baux/${segment(id)}`,
  tenant: (id: string) => `/locataires/${segment(id)}`,
  security: '/compte/securite',
};
