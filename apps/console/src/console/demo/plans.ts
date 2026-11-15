import type { Plan } from '../schemas/abonnements';
import { MODULE_SEEDS } from './catalog';

const all = MODULE_SEEDS.map((module) => module.id);
const without = (...excluded: string[]) => all.filter((id) => !excluded.includes(id));

const essential = without('mandats', 'reversements', 'fiscalite', 'conformite', 'rapports');
const pro = without('mandats', 'reversements');
const agency = without('fiscalite');
const owner = ['authentification', 'organisations', 'journal-d-audit', 'biens', 'locataires', 'baux', 'quittances', 'documents', 'notifications', 'support', 'rapports'];

export function buildPlans(): Plan[] {
  return [
    {
      id: 'essentiel',
      code: 'essentiel',
      name: 'Essentiel',
      audience: 'bailleur',
      tagline: 'bailleurs particuliers',
      description: 'Gestion simple pour un bailleur particulier',
      monthlyMinor: 2900,
      yearlyMinor: 29000,
      trialDays: 30,
      limits: { users: 3, lots: 20, storageGb: 10, emailsMonth: 1000 },
      moduleIds: essential,
      publicSignup: true,
    },
    {
      id: 'pro',
      code: 'pro',
      name: 'Pro',
      audience: 'bailleur',
      tagline: 'bailleurs et SCI',
      description: 'Pour les bailleurs et SCI qui gèrent plusieurs lots',
      monthlyMinor: 7900,
      yearlyMinor: 79000,
      trialDays: 30,
      limits: { users: 10, lots: 60, storageGb: 25, emailsMonth: 2500 },
      moduleIds: pro,
      publicSignup: true,
    },
    {
      id: 'agence',
      code: 'agence',
      name: 'Agence',
      audience: 'agence',
      tagline: 'mandats et reversements',
      description: 'Mandats, reversements et comptes rendus pour les agences',
      monthlyMinor: 19900,
      yearlyMinor: 199000,
      trialDays: 30,
      limits: { users: 15, lots: 100, storageGb: 50, emailsMonth: 5000 },
      moduleIds: agency,
      publicSignup: true,
    },
    {
      id: 'proprietaire',
      code: 'proprietaire',
      name: 'Propriétaire',
      audience: 'proprietaire',
      tagline: "Inclus avec le mandat d'une agence",
      description: "Consultation pour les mandants d'une agence",
      monthlyMinor: 0,
      yearlyMinor: 0,
      trialDays: 0,
      limits: { users: 2, lots: 10, storageGb: 5, emailsMonth: 500 },
      moduleIds: owner,
      publicSignup: false,
    },
  ];
}
