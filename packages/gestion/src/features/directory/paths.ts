const segment = (id: string): string => encodeURIComponent(id);

export const directoryPaths = {
  contacts: '/contacts',
  contactNew: '/contacts/nouveau',
  contact: (id: string) => `/contacts/${segment(id)}`,
  contactEdit: (id: string) => `/contacts/${segment(id)}/modifier`,
  property: (id: string) => `/biens/immeubles/${segment(id)}`,
  unit: (id: string) => `/biens/${segment(id)}`,
  home: '/',
} as const;
