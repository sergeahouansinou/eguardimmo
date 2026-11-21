export const SUBJECT_TYPE_PARAM = 'entite';
export const SUBJECT_ID_PARAM = 'entite_id';

export const activityPaths = {
  journal: '/journal',
  entity: (subjectType: string, subjectId: string): string => `/journal?${SUBJECT_TYPE_PARAM}=${encodeURIComponent(subjectType)}&${SUBJECT_ID_PARAM}=${encodeURIComponent(subjectId)}`,
  security: '/compte/securite',
  lease: (id: string): string => `/baux/${encodeURIComponent(id)}`,
  unit: (id: string): string => `/biens/${encodeURIComponent(id)}`,
  property: (id: string): string => `/biens/immeubles/${encodeURIComponent(id)}`,
  party: (id: string): string => `/contacts/${encodeURIComponent(id)}`,
  task: (id: string): string => `/taches/${encodeURIComponent(id)}`,
  event: (id: string): string => `/agenda/${encodeURIComponent(id)}`,
};
