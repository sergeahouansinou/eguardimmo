export const LOT_TABS = [
  { id: '', label: 'Vue d’ensemble' },
  { id: 'caracteristiques', label: 'Caractéristiques' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'locations', label: 'Locations' },
  { id: 'equipements', label: 'Équipements' },
  { id: 'compteurs', label: 'Compteurs' },
  { id: 'documents', label: 'Documents' },
  { id: 'finances', label: 'Finances' },
] as const;

export const IMMEUBLE_TABS = [
  { id: '', label: 'Vue d’ensemble' },
  { id: 'lots', label: 'Lots' },
  { id: 'charges', label: 'Charges et répartition' },
  { id: 'copropriete', label: 'Copropriété' },
  { id: 'equipements', label: 'Équipements communs' },
  { id: 'documents', label: 'Documents' },
  { id: 'interventions', label: 'Interventions' },
] as const;

export const EQUIPEMENT_TABS = [
  { id: '', label: 'Vue d’ensemble' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'interventions', label: 'Interventions' },
  { id: 'documents', label: 'Documents' },
] as const;

const tab = (base: string, id: string) => (id === '' ? base : `${base}/${id}`);

export const biensPaths = {
  lots: '/biens',
  newLot: '/biens/nouveau',
  lot: (id: string, section = '') => tab(`/biens/${id}`, section),
  editLot: (id: string) => `/biens/${id}/modifier`,
  immeubles: '/biens/immeubles',
  newImmeuble: '/biens/immeubles/nouveau',
  immeuble: (id: string, section = '') => tab(`/biens/immeubles/${id}`, section),
  editImmeuble: (id: string) => `/biens/immeubles/${id}/modifier`,
  equipements: '/biens/equipements',
  newEquipement: '/biens/equipements/nouveau',
  equipement: (id: string, section = '') => tab(`/biens/equipements/${id}`, section),
  editEquipement: (id: string) => `/biens/equipements/${id}/modifier`,
  releves: '/biens/releves',
  inventaires: '/biens/inventaires',
};

export const externalPaths = {
  leases: '/baux',
  newLease: (lotId: string) => `/baux/nouveau?bien=${encodeURIComponent(lotId)}`,
  tenant: (id: string) => `/locataires/${id}`,
  newIntervention: '/interventions/nouvelle',
  interventions: '/interventions',
  collectRent: '/finances/encaissements/nouveau',
  newMessage: '/messages/nouveau',
  operations: '/finances',
  agenda: '/agenda',
  contacts: '/contacts',
  regularisation: '/finances/regularisation',
  edls: '/baux/etats-des-lieux',
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
