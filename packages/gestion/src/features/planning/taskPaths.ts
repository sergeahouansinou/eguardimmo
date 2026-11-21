const segment = encodeURIComponent;

export const taskPaths = {
  list: '/taches',
  create: '/taches/nouvelle',
  detail: (id: string) => `/taches/${segment(id)}`,
  edit: (id: string) => `/taches/${segment(id)}/modifier`,
  property: (id: string) => `/biens/immeubles/${segment(id)}`,
  unit: (id: string) => `/biens/${segment(id)}`,
  lease: (id: string) => `/baux/${segment(id)}`,
  agenda: '/agenda',
};
