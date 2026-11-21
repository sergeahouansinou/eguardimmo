import type { Plan } from '../schemas/abonnements';
import { MODULE_SEEDS } from './catalog';

const all = MODULE_SEEDS.map((module) => module.id);
const owner = ['authentification', 'organisations', 'journal-d-audit', 'biens', 'locataires', 'baux', 'quittances', 'documents', 'notifications', 'support', 'rapports'];

export function buildPlans(): Plan[] {
  return [
    {
      id: 'gratuit',
      code: 'gratuit',
      name: 'Gratuit',
      audience: 'organisation',
      tagline: 'pour démarrer',
      description: '1 lot, 1 utilisateur, 2 locataires, 2 baux, 4 états des lieux, 50 Mo de stockage',
      monthlyMinor: 0,
      yearlyMinor: 0,
      trialDays: 15,
      limits: { users: 1, lots: 1, tenants: 2, leases: 2, inspections: 4, storageMb: 50, signaturesMonth: null },
      moduleIds: all,
      publicSignup: true,
    },
    {
      id: 'silver',
      code: 'silver',
      name: 'Silver',
      audience: 'organisation',
      tagline: '2 à 5 lots',
      description: '2 à 5 lots, plusieurs utilisateurs, locataires, baux et états des lieux illimités, 10 signatures par mois, 500 Mo de stockage',
      monthlyMinor: 490,
      yearlyMinor: 5800,
      trialDays: 15,
      limits: { users: null, lots: 5, tenants: null, leases: null, inspections: null, storageMb: 500, signaturesMonth: 10 },
      moduleIds: all,
      publicSignup: true,
    },
    {
      id: 'gold',
      code: 'gold',
      name: 'Gold',
      audience: 'organisation',
      tagline: 'lots illimités',
      description: 'Lots illimités, plusieurs utilisateurs, locataires, baux et états des lieux illimités, 20 signatures par mois, 5 Go de stockage',
      monthlyMinor: 1090,
      yearlyMinor: 11800,
      trialDays: 15,
      limits: { users: null, lots: null, tenants: null, leases: null, inspections: null, storageMb: 5000, signaturesMonth: 20 },
      moduleIds: all,
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
      limits: { users: 2, lots: 10, tenants: null, leases: null, inspections: null, storageMb: 5000, signaturesMonth: null },
      moduleIds: owner,
      publicSignup: false,
    },
  ];
}
