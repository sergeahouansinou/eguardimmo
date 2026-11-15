import type { AuditEvent, AuditType } from '../schemas/audit';
import { chainHash } from './audit';
import { addDays } from './clock';
import type { OrgRecord } from './organisations';
import { FIRST_NAMES, LAST_NAMES, createRandom, pick } from './random';

export const AUDIT_TOTAL = 1240;
const OPERATORS = ['Lucas Bernard', 'Inès Garnier', 'Théo Marchand', 'Karim Haddad', 'Julie Fontaine'] as const;
const DEVICES = ['Chrome, macOS', 'Safari, iPhone', 'Firefox, Windows', 'Chrome, Windows', 'Application Android'] as const;

interface Template {
  type: AuditType;
  title: string;
  context: (org: string, random: () => number) => string;
  actor: 'org' | 'operator' | 'system';
  module: string;
  request: string;
  justified?: boolean;
  weight: number;
}

const TEMPLATES: Template[] = [
  { type: 'connexion', title: 'Connexion, 2FA validée', context: (org) => org, actor: 'org', module: 'Authentification', request: 'POST /api/auth/login', weight: 30 },
  { type: 'securite', title: 'Échec de connexion', context: (org) => `${org}, mot de passe incorrect`, actor: 'org', module: 'Authentification', request: 'POST /api/auth/login', weight: 6 },
  { type: 'droits', title: 'Droits modifiés', context: (org) => `${org}, rôle modifié`, actor: 'org', module: 'Organisations', request: 'PATCH /api/organisations/members', weight: 8 },
  { type: 'export', title: 'Export des quittances', context: (org) => org, actor: 'org', module: 'Quittances', request: 'GET /api/quittances/export', weight: 10 },
  { type: 'export', title: 'Comptes rendus générés', context: (org, random) => `${org}, ${String(2 + Math.floor(random() * 8))} mandants`, actor: 'org', module: 'Reversements', request: 'POST /api/reversements/comptes-rendus', weight: 8 },
  { type: 'configuration', title: 'Paramètre modifié', context: (org) => `${org}, notifications`, actor: 'org', module: 'Organisations', request: 'PATCH /api/organisations/settings', weight: 8 },
  { type: 'organisation', title: 'Module activé', context: (org) => `${org}, Rapports`, actor: 'org', module: 'Organisations', request: 'PUT /api/organisations/modules', weight: 4 },
  { type: 'acces_justifie', title: 'Accès aux données ouvert', context: (org, random) => `${org}, ticket SUP-${String(2000 + Math.floor(random() * 99))}`, actor: 'operator', module: 'Console', request: 'POST /api/console/acces', justified: true, weight: 4 },
  { type: 'rgpd', title: "Demande d'accès", context: (_org, random) => `Registre RGPD, ${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`, actor: 'operator', module: 'Conformité', request: 'POST /api/console/rgpd', weight: 2 },
  { type: 'securite', title: '5 échecs de connexion', context: (org) => `${org}, compte bloqué 15 min`, actor: 'system', module: 'Authentification', request: 'POST /api/auth/login', weight: 3 },
  { type: 'compte', title: 'Compte suspendu', context: (_org, random) => `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}, motif consigné`, actor: 'operator', module: 'Console', request: 'POST /api/console/comptes/suspension', weight: 1 },
];

interface Named {
  at: string;
  actor: { name: string; role: string };
  type: AuditType;
  title: string;
  context: string;
  origin: string;
  orgName: string | null;
  action: string;
  module: string | null;
  request: string | null;
  justified?: boolean;
  resource?: string | null;
  before?: Record<string, string> | null;
  after?: Record<string, string> | null;
  device?: string;
  session?: string;
}

const NAMED: Named[] = [
  { at: '2026-11-13T20:58:00+01:00', actor: { name: 'Lucas Bernard', role: 'Opérateur' }, type: 'connexion', title: 'Connexion opérateur, 2FA validée', context: 'Console opérateur', origin: '81.250.xx.xx', orgName: null, action: 'Connexion', module: 'Console', request: 'POST /api/v1/console/auth/token' },
  { at: '2026-11-13T20:55:00+01:00', actor: { name: 'Théo Marchand', role: 'Opérateur' }, type: 'configuration', title: 'Limitation du débit activée', context: 'Messagerie, 200 messages par minute', origin: '81.250.xx.xx', orgName: null, action: "Activation d'un drapeau", module: 'Messagerie', request: 'PUT /api/console/modules/messagerie/flags' },
  {
    at: '2026-11-13T17:12:07+01:00',
    actor: { name: 'Sophie Delmas', role: 'Titulaire' },
    type: 'droits',
    title: 'Droits modifiés',
    context: 'Cabinet Delmas Immobilier, rôle ajouté',
    origin: '90.63.xx.xx',
    orgName: 'Cabinet Delmas Immobilier',
    action: "Ajout d'un rôle",
    module: 'Organisations',
    request: 'POST /api/organisations/members',
    resource: 'Compte de Hugo Martin',
    before: { Utilisateur: 'Hugo Martin', Rôles: 'Comptable', 'Biens accessibles': 'Tous' },
    after: { Utilisateur: 'Hugo Martin', Rôles: 'Comptable, Gestionnaire', 'Biens accessibles': 'Tous' },
    device: 'Chrome, macOS',
  },
  { at: '2026-11-13T11:40:00+01:00', actor: { name: 'Inès Garnier', role: 'Opérateur' }, type: 'export', title: 'Export des comptes', context: 'SCI Les Acacias, accès justifié et consigné', origin: '81.250.xx.xx', orgName: 'SCI Les Acacias', action: 'Export', module: 'Comptes', request: 'GET /api/console/comptes/export', justified: true },
  { at: '2026-11-13T09:30:00+01:00', actor: { name: 'Hugo Martin', role: 'Gestionnaire' }, type: 'export', title: 'Comptes rendus générés, 6 mandants', context: 'Cabinet Delmas Immobilier', origin: '90.63.xx.xx', orgName: 'Cabinet Delmas Immobilier', action: 'Génération', module: 'Reversements', request: 'POST /api/reversements/comptes-rendus' },
  { at: '2026-11-13T09:05:00+01:00', actor: { name: 'Système', role: 'Protection' }, type: 'securite', title: '5 échecs de connexion', context: 'Gestion Les Tilleuls, compte bloqué 15 min', origin: '176.143.xx.xx', orgName: 'Gestion Les Tilleuls', action: 'Verrouillage', module: 'Authentification', request: 'POST /api/auth/login' },
  { at: '2026-11-13T08:41:00+01:00', actor: { name: 'Sophie Delmas', role: 'Titulaire' }, type: 'connexion', title: 'Connexion, 2FA validée', context: 'Cabinet Delmas Immobilier', origin: '90.63.xx.xx', orgName: 'Cabinet Delmas Immobilier', action: 'Connexion', module: 'Authentification', request: 'POST /api/auth/login' },
  { at: '2026-11-12T18:30:00+01:00', actor: { name: 'Karim Haddad', role: 'Opérateur' }, type: 'rgpd', title: 'Demande de rectification', context: 'Registre RGPD, Louis Petit', origin: '81.250.xx.xx', orgName: 'Gestion Les Tilleuls', action: 'Enregistrement', module: 'Conformité', request: 'POST /api/console/rgpd' },
  { at: '2026-11-12T14:20:00+01:00', actor: { name: 'Inès Garnier', role: 'Opérateur' }, type: 'acces_justifie', title: 'Accès aux données ouvert', context: 'Cabinet Delmas Immobilier, ticket SUP-2077', origin: '81.250.xx.xx', orgName: 'Cabinet Delmas Immobilier', action: 'Ouverture', module: 'Console', request: 'POST /api/console/acces', justified: true },
];

const KNOWN_HASHES: Record<string, string> = {
  'EVT-2026-204517': '7d02c18a94b3e8a3',
  'EVT-2026-204518': 'a91c7f3b52d604be',
};

function maskedIp(random: () => number): string {
  return `${String(60 + Math.floor(random() * 150))}.${String(10 + Math.floor(random() * 200))}.xx.xx`;
}

function pickTemplate(random: () => number): Template {
  const total = TEMPLATES.reduce((sum, template) => sum + template.weight, 0);
  let cursor = random() * total;
  const picked = TEMPLATES.find((template) => {
    cursor -= template.weight;
    return cursor < 0;
  });
  if (!picked) throw new Error('Aucun modèle d’événement sélectionnable.');
  return picked;
}

type Draft = Omit<AuditEvent, 'id' | 'reference' | 'hash' | 'previousHash'>;

export function buildAuditEvents(organisations: readonly OrgRecord[]): AuditEvent[] {
  const random = createRandom(2026);
  const byName = new Map(organisations.map((org) => [org.name, org]));
  const drafts: Draft[] = NAMED.map((named) => {
    const org = named.orgName ? byName.get(named.orgName) : undefined;
    return {
      at: named.at,
      actor: named.actor,
      type: named.type,
      title: named.title,
      context: named.context,
      origin: named.origin,
      organisationId: org?.id ?? null,
      organisationName: org?.name ?? null,
      resource: named.resource ?? null,
      module: named.module,
      request: named.request,
      action: named.action,
      before: named.before ?? null,
      after: named.after ?? null,
      device: named.device ?? 'Chrome, macOS',
      session: named.actor.role === 'Protection' ? 'Aucune session' : 'Double authentification validée',
      justified: named.justified ?? false,
    };
  });

  for (let day = 0; day <= 12; day += 1) {
    const date = addDays('2026-11-13', -day);
    drafts.push({
      at: `${date}T03:00:00+01:00`,
      actor: { name: 'Système', role: 'Planificateur' },
      type: 'sauvegarde',
      title: 'Sauvegarde quotidienne terminée',
      context: 'Base de données et documents, chiffrée',
      origin: 'Interne',
      organisationId: null,
      organisationName: null,
      resource: null,
      module: 'Sauvegardes',
      request: null,
      action: 'Sauvegarde',
      before: null,
      after: null,
      device: 'Serveur',
      session: 'Aucune session',
      justified: false,
    });
  }

  while (drafts.length < AUDIT_TOTAL) {
    const template = pickTemplate(random);
    const org = organisations[Math.floor(random() * organisations.length)];
    if (!org) throw new RangeError('Aucune organisation de démonstration');
    const day = addDays('2026-11-13', -Math.floor(random() * 13));
    const minutes = Math.floor(random() * (day === '2026-11-13' ? 21 * 60 + 20 : 24 * 60 - 1));
    const at = `${day}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}+01:00`;
    const actorName =
      template.actor === 'operator'
        ? pick(random, OPERATORS)
        : template.actor === 'system'
          ? 'Système'
          : (org.users[Math.floor(random() * org.users.length)]?.name ?? org.holder.name);
    const actorRole = template.actor === 'operator' ? 'Opérateur' : template.actor === 'system' ? 'Protection' : 'Utilisateur';
    drafts.push({
      at,
      actor: { name: actorName, role: actorRole },
      type: template.type,
      title: template.title,
      context: template.context(org.name, random),
      origin: maskedIp(random),
      organisationId: org.id,
      organisationName: org.name,
      resource: null,
      module: template.module,
      request: template.request,
      action: template.title,
      before: null,
      after: null,
      device: pick(random, DEVICES),
      session: template.actor === 'system' ? 'Aucune session' : 'Double authentification validée',
      justified: template.justified ?? false,
    });
  }

  drafts.sort((left, right) => Date.parse(left.at) - Date.parse(right.at) || left.title.localeCompare(right.title));
  const anchor = drafts.findIndex((draft) => draft.at === '2026-11-13T17:12:07+01:00');
  const base = 204_518 - anchor;
  const events: AuditEvent[] = [];
  let previousHash = '0000000000000000';
  drafts.forEach((draft, index) => {
    const reference = `EVT-2026-${String(base + index).padStart(6, '0')}`;
    const hash = KNOWN_HASHES[reference] ?? chainHash(previousHash, { reference, ...draft });
    events.push({ id: reference.toLowerCase(), reference, ...draft, hash, previousHash });
    previousHash = hash;
  });
  return events;
}
