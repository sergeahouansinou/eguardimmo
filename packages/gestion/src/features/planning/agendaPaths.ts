export const agendaPaths = {
  agenda: '/agenda',
  newEvent: '/agenda/nouveau',
  newEventOn: (date: string) => `/agenda/nouveau?date=${encodeURIComponent(date)}`,
  event: (id: string) => `/agenda/${encodeURIComponent(id)}`,
  editEvent: (id: string) => `/agenda/${encodeURIComponent(id)}/modifier`,
  task: (id: string) => `/taches/${encodeURIComponent(id)}`,
  timezone: '/reglages/fuseau-horaire',
  property: (id: string) => `/biens/immeubles/${encodeURIComponent(id)}`,
  unit: (id: string) => `/biens/${encodeURIComponent(id)}`,
  lease: (id: string) => `/baux/${encodeURIComponent(id)}`,
};
