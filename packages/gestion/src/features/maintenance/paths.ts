export const maintenancePaths = {
  interventions: '/interventions',
  newIntervention: '/interventions/nouvelle',
  intervention: (id: string) => `/interventions/${id}`,
  quotes: '/devis',
  quotesOf: (interventionId: string) => `/devis?intervention=${interventionId}`,
  suppliers: '/interventions/prestataires',
};
