export const locatairesPaths = {
  list: '/locataires',
  create: '/locataires/nouveau',
  detail: (id: string) => `/locataires/${id}`,
  edit: (id: string) => `/locataires/${id}/modifier`,
  candidates: '/locataires/candidats',
  inviteCandidate: '/locataires/candidats/inviter',
  candidate: (id: string) => `/locataires/candidats/${id}`,
};
