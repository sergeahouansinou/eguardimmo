function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export const links = {
  home: '/',
  unit: (unitId: string) => `/biens/${unitId}`,
  newLease: (params: { locataire?: string; bien?: string } = {}) => withQuery('/baux/nouveau', params),
  newCourrier: (params: { modele?: string; locataire?: string; bien?: string } = {}) => withQuery('/documents/courriers/nouveau', params),
  newMessage: (tenantId?: string) => withQuery('/messages/nouveau', { destinataire: tenantId }),
  newPayment: (params: { locataire?: string; reservation?: string } = {}) => withQuery('/finances/encaissements/nouveau', params),
  agenda: '/agenda',
  ledger: (tenantId?: string) => withQuery('/finances', { locataire: tenantId }),
  arrears: '/finances/impayes',
  messages: '/messages',
};
