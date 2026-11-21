import type { OrganisationState, OrganisationType } from '../schemas/organisations';
import { addDays } from './clock';
import { buildPlans } from './plans';
import { FIRST_NAMES, LAST_NAMES, createRandom, pick } from './random';

export interface OrgUser {
  id: string;
  name: string;
  role: string;
  lastLoginAt: string;
}

export interface OrgAccess {
  id: string;
  ticket: string;
  operator: string;
  reason: string;
  startedAt: string;
  endsAt: string;
  active: boolean;
}

export interface OrgRecord {
  id: string;
  name: string;
  type: OrganisationType;
  planId: string;
  state: OrganisationState;
  trialEndsOn: string | null;
  createdOn: string;
  holder: { name: string; email: string };
  contactEmail: string;
  headquarters: string;
  activity: string;
  creation: string;
  users: OrgUser[];
  usage: { lots: number; storageMb: number; signaturesMonth: number };
  lastActivity: { at: string; by: string };
  moduleOverrides: Record<string, { enabled: boolean; reason: string }>;
  accesses: OrgAccess[];
}

interface NamedSeed {
  name: string;
  type: OrganisationType;
  planId: string;
  state: OrganisationState;
  createdOn: string;
  trialEndsOn?: string;
  users: number;
}

const NAMED: NamedSeed[] = [
  { name: 'Gestion Les Tilleuls', type: 'bailleur', planId: 'gold', state: 'active', createdOn: '2025-03-12', users: 4 },
  { name: 'Cabinet Delmas Immobilier', type: 'agence', planId: 'gold', state: 'active', createdOn: '2025-01-14', users: 9 },
  { name: 'SCI Les Acacias', type: 'proprietaire', planId: 'proprietaire', state: 'active', createdOn: '2025-02-20', users: 2 },
  { name: 'SCI Chevalier', type: 'proprietaire', planId: 'proprietaire', state: 'active', createdOn: '2025-02-03', users: 1 },
  { name: 'Immo Rhône Gestion', type: 'agence', planId: 'gold', state: 'essai', createdOn: '2026-11-05', trialEndsOn: '2026-11-20', users: 5 },
  { name: 'Maison Girard', type: 'bailleur', planId: 'silver', state: 'essai', createdOn: '2026-11-04', trialEndsOn: '2026-11-19', users: 1 },
  { name: 'Résidences du Parc', type: 'bailleur', planId: 'gold', state: 'active', createdOn: '2025-06-05', users: 7 },
  { name: 'Agence Port-Sud', type: 'agence', planId: 'gold', state: 'suspendue', createdOn: '2025-09-11', users: 3 },
  { name: 'Foncière du Verger', type: 'bailleur', planId: 'gold', state: 'essai', createdOn: '2026-11-09', trialEndsOn: '2026-11-24', users: 2 },
  { name: 'Léa Fontaine', type: 'bailleur', planId: 'silver', state: 'essai', createdOn: '2026-11-06', trialEndsOn: '2026-11-21', users: 1 },
];

const BAILLEUR_PREFIXES = ['Gestion', 'Résidences', 'Maison', 'Patrimoine', 'Foncière', 'SCI', 'Immo'];
const AGENCE_PREFIXES = ['Agence', 'Cabinet', 'Groupe', 'Immobilière'];
const PROPRIO_PREFIXES = ['SCI', 'SCI Les', 'Famille'];
const NOUNS = [
  'Lilas', 'Marronniers', 'Peupliers', 'Cèdres', 'Platanes', 'Charmes', 'Ormes', 'Érables', 'Hêtres', 'Mélèzes',
  'Cerisiers', 'Pommiers', 'Noyers', 'Saules', 'Bouleaux', 'Sapins', 'Cyprès', 'Magnolias', 'Mimosas', 'Glycines',
  'Vignes', 'Coteaux', 'Rives', 'Berges', 'Moulins', 'Fontaines', 'Remparts', 'Halles', 'Arènes', 'Collines',
  'Horizons', 'Estuaires', 'Lavandes', 'Oliviers', 'Garrigues', 'Calanques', 'Vallées', 'Plateaux', 'Sources', 'Clairières',
  'Alizés', 'Embruns', 'Falaises', 'Dunes', 'Marais', 'Prairies', 'Bastides', 'Villas', 'Jardins', 'Terrasses',
  'Ponts', 'Quais', 'Tours', 'Portes', 'Places', 'Cours', 'Allées', 'Passages', 'Ruelles', 'Faubourgs',
] as const;
const CITIES = ['Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Nantes', 'Lille', 'Strasbourg', 'Montpellier', 'Rennes', 'Grenoble', 'Nice', 'Dijon'] as const;
const STREETS = ['rue de la République', 'avenue Jean Jaurès', 'quai Saint-Antoine', 'rue Garibaldi', 'boulevard Gambetta', 'cours Lafayette', 'rue Victor Hugo'] as const;

export const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface GenSpec {
  type: OrganisationType;
  planId: string;
  count: number;
  states: OrganisationState[];
}

const GENERATED: GenSpec[] = [
  { type: 'bailleur', planId: 'silver', count: 39, states: [...Array<OrganisationState>(38).fill('active'), 'suspendue'] },
  { type: 'bailleur', planId: 'gold', count: 30, states: [...Array<OrganisationState>(29).fill('active'), 'suspendue'] },
  { type: 'agence', planId: 'gold', count: 28, states: [...Array<OrganisationState>(26).fill('active'), 'essai', 'essai'] },
  { type: 'proprietaire', planId: 'proprietaire', count: 21, states: Array<OrganisationState>(21).fill('active') },
];

const ACTIVITY: Record<OrganisationType, (random: () => number) => string> = {
  bailleur: (random) => `${String(1 + Math.floor(random() * 9))} lots en gestion directe`,
  agence: (random) => `${String(2 + Math.floor(random() * 12))} mandants, ${String(5 + Math.floor(random() * 60))} lots sous mandat`,
  proprietaire: (random) => `${String(1 + Math.floor(random() * 4))} lots confiés à une agence`,
};

const USER_ROLES = ['Gestionnaire', 'Comptable', 'Agent', 'Gestionnaire', 'Agent'] as const;

function makeUsers(random: () => number, orgSlug: string, total: number, holderName: string, lastLogin: string, existing: OrgUser[] = []): OrgUser[] {
  const users: OrgUser[] = existing.length > 0 ? [...existing] : [{ id: `${orgSlug}-u1`, name: holderName, role: 'Titulaire', lastLoginAt: lastLogin }];
  for (let index = users.length; index < total; index += 1) {
    const day = addDays('2026-11-13', -Math.floor(random() * 9));
    const minutes = Math.floor(random() * 600) + 480;
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    users.push({
      id: `${orgSlug}-u${String(index + 1)}`,
      name: `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`,
      role: USER_ROLES[(index - 1) % USER_ROLES.length] ?? 'Agent',
      lastLoginAt: `${day}T${time}:00+01:00`,
    });
  }
  return users;
}

const PLAN_LIMITS = new Map(buildPlans().map((plan) => [plan.id, plan.limits]));

const within = (value: number, limit: number | null | undefined): number => (limit == null ? value : Math.min(value, limit));

function finishRecord(random: () => number, seed: NamedSeed): OrgRecord {
  const id = slug(seed.name);
  const holderName = id === 'cabinet-delmas-immobilier' ? 'Sophie Delmas' : `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`;
  const lastLogin = `${addDays('2026-11-13', -Math.floor(random() * 6))}T${String(8 + Math.floor(random() * 11)).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00+01:00`;
  const delmas = id === 'cabinet-delmas-immobilier';
  const delmasUsers: OrgUser[] = [
        { id: 'delmas-u1', name: 'Sophie Delmas', role: 'Titulaire', lastLoginAt: '2026-11-13T17:05:00+01:00' },
        { id: 'delmas-u2', name: 'Hugo Martin', role: 'Gestionnaire', lastLoginAt: '2026-11-13T09:30:00+01:00' },
        { id: 'delmas-u3', name: 'Camille Perrin', role: 'Comptable', lastLoginAt: '2026-11-12T16:48:00+01:00' },
        { id: 'delmas-u4', name: 'Inès Lambert', role: 'Gestionnaire', lastLoginAt: '2026-11-10T11:20:00+01:00' },
        { id: 'delmas-u5', name: 'Mathieu Clément', role: 'Agent', lastLoginAt: '2026-11-09T10:02:00+01:00' },
        { id: 'delmas-u6', name: 'Élodie Roussel', role: 'Agent', lastLoginAt: '2026-11-06T15:44:00+01:00' },
  ];
  const limits = PLAN_LIMITS.get(seed.planId);
  const users = makeUsers(random, id, seed.users, holderName, lastLogin, delmas ? delmasUsers : []);
  const domain = `${id}.example`;
  const city = delmas ? 'Lyon' : pick(random, CITIES);
  const street = pick(random, STREETS);
  return {
    id,
    name: seed.name,
    type: seed.type,
    planId: seed.planId,
    state: seed.state,
    trialEndsOn: seed.trialEndsOn ?? null,
    createdOn: seed.createdOn,
    holder: { name: holderName, email: delmas ? 'sophie@delmas-immo.example' : `${slug(holderName)}@${domain}` },
    contactEmail: delmas ? 'contact@delmas-immobilier.example' : `contact@${domain}`,
    headquarters: delmas ? 'Lyon, France' : `${String(1 + Math.floor(random() * 90))} ${street}, ${city}, France`,
    activity: delmas ? '6 mandants, 14 lots sous mandat' : ACTIVITY[seed.type](random),
    creation: `${seed.createdOn.slice(8, 10)}/${seed.createdOn.slice(5, 7)}/${seed.createdOn.slice(0, 4)}, par inscription`,
    users,
    usage: delmas
      ? { lots: 14, storageMb: 4200, signaturesMonth: 12 }
      : {
          lots: within(1 + Math.floor(random() * 30), limits?.lots),
          storageMb: within(100 + Math.floor(random() * 6000), limits?.storageMb),
          signaturesMonth: within(Math.floor(random() * 21), limits?.signaturesMonth),
        },
    lastActivity: { at: users[0]?.lastLoginAt ?? lastLogin, by: holderName },
    moduleOverrides: delmas
      ? { rapports: { enabled: false, reason: "Désactivé à la demande de l'organisation, le 02/09/2026" } }
      : {},
    accesses: delmas
      ? [
          { id: 'acc-sup-2077', ticket: 'SUP-2077', operator: 'Inès Garnier', reason: 'Diagnostic d’un écart de comptes rendus', startedAt: '2026-11-12T14:20:00+01:00', endsAt: '2026-11-12T14:40:00+01:00', active: false },
          { id: 'acc-sup-2041', ticket: 'SUP-2041', operator: 'Inès Garnier', reason: 'Reprise d’un import de mandats', startedAt: '2026-09-02T10:15:00+01:00', endsAt: '2026-09-02T10:35:00+01:00', active: false },
          { id: 'acc-sup-1893', ticket: 'SUP-1893', operator: 'Théo Marchand', reason: 'Correction d’un modèle de quittance', startedAt: '2026-05-14T09:40:00+01:00', endsAt: '2026-05-14T10:00:00+01:00', active: false },
        ]
      : [],
  };
}

export function buildOrganisations(): OrgRecord[] {
  const random = createRandom(7);
  const records: OrgRecord[] = NAMED.map((seed) => finishRecord(random, seed));
  const used = new Set(records.map((record) => record.id));
  let counter = 0;

  for (const spec of GENERATED) {
    const prefixes = spec.type === 'bailleur' ? BAILLEUR_PREFIXES : spec.type === 'agence' ? AGENCE_PREFIXES : PROPRIO_PREFIXES;
    for (let index = 0; index < spec.count; index += 1) {
      let name = '';
      let attempt = counter;
      do {
        const noun = NOUNS[attempt % NOUNS.length] ?? 'Lilas';
        const prefix = prefixes[Math.floor(attempt / NOUNS.length + attempt) % prefixes.length] ?? prefixes[0] ?? 'Gestion';
        name = spec.type === 'agence' && prefix === 'Cabinet' ? `Cabinet ${noun} Immobilier` : `${prefix} ${noun}`;
        attempt += 1;
      } while (used.has(slug(name)));
      counter = attempt;
      used.add(slug(name));
      const state = spec.states[index] ?? 'active';
      const createdOn = addDays('2025-01-08', Math.floor(random() * 480));
      const trialEndsOn = state === 'essai' ? addDays('2026-11-13', 1 + Math.floor(random() * 14)) : undefined;
      const maxUsers = { bailleur: spec.planId === 'gold' ? 8 : 3, agence: 14, proprietaire: 2 }[spec.type];
      records.push(
        finishRecord(
          random,
          {
            name,
            type: spec.type,
            planId: spec.planId,
            state,
            createdOn: trialEndsOn ? addDays(trialEndsOn, -15) : createdOn,
            ...(trialEndsOn ? { trialEndsOn } : {}),
            users: 1 + Math.floor(random() * maxUsers),
          },
        ),
      );
    }
  }
  return records;
}
