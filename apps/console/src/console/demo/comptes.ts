import type { AccountDetail, AccountRow, AccountState, ProfileKind } from '../schemas/comptes';
import { addDays } from './clock';
import type { OrgRecord } from './organisations';
import { FIRST_NAMES, LAST_NAMES, createRandom, pick } from './random';

export interface AccountRecord extends AccountRow {
  createdOn: string;
  sessions: number;
  seed: number;
}

const KINDS: ProfileKind[] = ['bailleur', 'proprietaire', 'locataire', 'agence'];
const DEVICES = ['Chrome, macOS', 'Application iPhone', 'Firefox, Windows', 'Safari, iPhone', 'Application Android'] as const;

const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const NAMED: AccountRecord[] = [
  { id: 'marc-chevalier', name: 'Marc Chevalier', email: 'marc.chevalier@example.com', profiles: ['bailleur', 'proprietaire', 'locataire'], twoFactor: true, lastLoginAt: '2026-11-13T18:20:00+01:00', invitedOn: null, state: 'actif', createdOn: '2025-02-03', sessions: 2, seed: 1 },
  { id: 'sophie-delmas', name: 'Sophie Delmas', email: 'sophie@delmas-immo.example', profiles: ['agence'], twoFactor: true, lastLoginAt: '2026-11-13T17:05:00+01:00', invitedOn: null, state: 'actif', createdOn: '2025-01-14', sessions: 1, seed: 2 },
  { id: 'awa-diallo', name: 'Awa Diallo', email: 'awa.diallo@example.com', profiles: ['bailleur', 'locataire'], twoFactor: true, lastLoginAt: '2026-11-13T08:42:00+01:00', invitedOn: null, state: 'actif', createdOn: '2025-04-18', sessions: 1, seed: 3 },
  { id: 'koffi-adjovi', name: 'Koffi Adjovi', email: 'koffi.adjovi@example.com', profiles: ['locataire'], twoFactor: false, lastLoginAt: '2026-11-12T19:03:00+01:00', invitedOn: null, state: 'actif', createdOn: '2025-09-02', sessions: 1, seed: 4 },
  { id: 'anais-roux', name: 'Anaïs Roux', email: 'anais.roux@example.com', profiles: ['locataire'], twoFactor: false, lastLoginAt: '2026-11-10T07:55:00+01:00', invitedOn: null, state: 'actif', createdOn: '2025-06-21', sessions: 0, seed: 5 },
  { id: 'paul-lemoine', name: 'Paul Lemoine', email: 'paul.lemoine@example.com', profiles: ['proprietaire'], twoFactor: true, lastLoginAt: '2026-11-09T14:12:00+01:00', invitedOn: null, state: 'actif', createdOn: '2025-03-30', sessions: 0, seed: 6 },
  { id: 'louis-petit', name: 'Louis Petit', email: 'louis.petit@example.com', profiles: ['locataire'], twoFactor: false, lastLoginAt: null, invitedOn: '2026-11-12', state: 'invite', createdOn: '2026-11-12', sessions: 0, seed: 7 },
  { id: 'julien-morel', name: 'Julien Morel', email: 'julien.morel@example.com', profiles: ['bailleur'], twoFactor: false, lastLoginAt: '2026-06-12T10:30:00+01:00', invitedOn: null, state: 'suspendu', createdOn: '2025-05-12', sessions: 0, seed: 8 },
];

export const ACCOUNT_TOTAL = 1840;

export function buildAccounts(): AccountRecord[] {
  const random = createRandom(99);
  const records: AccountRecord[] = [...NAMED];
  const states: AccountState[] = [
    ...Array<AccountState>(1785).fill('actif'),
    ...Array<AccountState>(30).fill('invite'),
    ...Array<AccountState>(17).fill('suspendu'),
  ];
  const profileCounts: number[] = [...Array<number>(44).fill(3), ...Array<number>(379).fill(2)];
  const singles = states.length - profileCounts.length;
  const counts = [...profileCounts, ...Array<number>(singles).fill(1)];
  for (let index = counts.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = counts[index];
    counts[index] = counts[swap] ?? 1;
    counts[swap] = held ?? 1;
  }
  for (let shuffle = states.length - 1; shuffle > 0; shuffle -= 1) {
    const swap = Math.floor(random() * (shuffle + 1));
    const held = states[shuffle];
    states[shuffle] = states[swap] ?? 'actif';
    states[swap] = held ?? 'actif';
  }
  const used = new Set(records.map((record) => record.id));
  states.forEach((state, index) => {
    const first = pick(random, FIRST_NAMES);
    const last = pick(random, LAST_NAMES);
    let id = `${slug(first)}-${slug(last)}`;
    let attempt = 1;
    while (used.has(id)) {
      attempt += 1;
      id = `${slug(first)}-${slug(last)}-${String(attempt)}`;
    }
    used.add(id);
    const kinds = [...KINDS].sort(() => random() - 0.5).slice(0, counts[index] ?? 1);
    const day = addDays('2026-11-13', -Math.floor(random() * 120));
    const hour = String(7 + Math.floor(random() * 15)).padStart(2, '0');
    const minute = String(Math.floor(random() * 60)).padStart(2, '0');
    records.push({
      id,
      name: `${first} ${last}`,
      email: `${id}@example.com`,
      profiles: kinds.length > 0 ? kinds : ['locataire'],
      twoFactor: kinds.includes('locataire') && kinds.length === 1 ? random() > 0.7 : random() > 0.15,
      lastLoginAt: state === 'invite' ? null : `${day}T${hour}:${minute}:00+01:00`,
      invitedOn: state === 'invite' ? addDays('2026-11-13', -Math.floor(random() * 6)) : null,
      state,
      createdOn: addDays('2025-01-10', Math.floor(random() * 500)),
      sessions: state === 'actif' ? Math.floor(random() * 3) : 0,
      seed: index + 100,
    });
  });
  return records;
}

export function toAccountRow(record: AccountRecord): AccountRow {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    profiles: record.profiles,
    twoFactor: record.twoFactor,
    lastLoginAt: record.lastLoginAt,
    invitedOn: record.invitedOn,
    state: record.state,
  };
}

const PROFILE_TITLES: Record<ProfileKind, string> = {
  bailleur: 'Profil bailleur',
  proprietaire: 'Profil propriétaire',
  locataire: 'Profil locataire',
  agence: 'Profil agence',
};

export function buildAccountDetail(record: AccountRecord, organisations: readonly OrgRecord[]): AccountDetail {
  const random = createRandom(record.seed);
  const marc = record.id === 'marc-chevalier';
  const profileList: AccountDetail['profileList'] = marc
    ? [
        { id: 'marc-chevalier-bailleur', kind: 'bailleur', title: 'Profil bailleur', detail: 'Gestion Les Tilleuls · administrateur', status: 'Dernier utilisé', organisationId: 'gestion-les-tilleuls' },
        { id: 'marc-chevalier-proprietaire', kind: 'proprietaire', title: 'Profil propriétaire', detail: "SCI Chevalier · mandat Cabinet Delmas Immobilier", status: 'Organisation', organisationId: 'sci-chevalier' },
        { id: 'marc-chevalier-locataire', kind: 'locataire', title: 'Profil locataire', detail: 'Studio, 8 rue Garibaldi, 69003 Lyon · bail du 01/09/2024', status: 'À jour', organisationId: null },
      ]
    : record.profiles.map((kind, index) => {
        const org = organisations[Math.floor(random() * organisations.length)];
        return {
          id: `${record.id}-${kind}`,
          kind,
          title: PROFILE_TITLES[kind],
          detail:
            kind === 'locataire'
              ? `Bail du ${String(1 + Math.floor(random() * 27)).padStart(2, '0')}/0${String(1 + Math.floor(random() * 9))}/2025`
              : `${org?.name ?? 'Organisation'} · ${kind === 'agence' ? 'titulaire' : 'administrateur'}`,
          status: index === 0 ? 'Dernier utilisé' : 'Actif',
          organisationId: kind === 'locataire' ? null : (org?.id ?? null),
        };
      });
  const profileLabel = (kind: ProfileKind) => ({ bailleur: 'Bailleur', proprietaire: 'Propriétaire', locataire: 'Locataire', agence: 'Agence' })[kind];
  const rows = marc
    ? [
        { id: 'c1', at: '2026-11-13T18:20:00+01:00', profile: 'Bailleur', device: 'Chrome, macOS', origin: '81.250.xx.xx', success: true },
        { id: 'c2', at: '2026-11-12T09:15:00+01:00', profile: 'Bailleur', device: 'Application iPhone', origin: '92.184.xx.xx', success: true },
        { id: 'c3', at: '2026-11-10T19:40:00+01:00', profile: 'Bailleur', device: 'Chrome, macOS', origin: '81.250.xx.xx', success: true },
        { id: 'c4', at: '2026-11-08T08:02:00+01:00', profile: 'Bailleur', device: 'Application iPhone', origin: '92.184.xx.xx', success: true },
      ]
    : Array.from({ length: record.lastLoginAt ? 4 : 0 }, (_, index) => ({
        id: `c${String(index + 1)}`,
        at: `${addDays('2026-11-12', -index * 2 - Math.floor(random() * 2))}T${String(8 + Math.floor(random() * 12)).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00+01:00`,
        profile: profileLabel(record.profiles[index % record.profiles.length] ?? 'locataire'),
        device: pick(random, DEVICES),
        origin: `${String(60 + Math.floor(random() * 150))}.${String(10 + Math.floor(random() * 200))}.xx.xx`,
        success: index !== 2 || random() > 0.2,
      }));
  return {
    account: toAccountRow(record),
    createdOn: record.createdOn,
    profileList,
    logins: {
      total: marc ? 28 : record.lastLoginAt ? 6 + Math.floor(random() * 40) : 0,
      last30Days: marc ? 28 : record.lastLoginAt ? 2 + Math.floor(random() * 20) : 0,
      failures: marc ? 0 : rows.filter((row) => !row.success).length,
      rows,
    },
    contact: {
      mobile: `+33 6 •• •• •• ${String(10 + Math.floor(random() * 89))}`,
      language: 'Français',
      passwordChangedOn: marc ? '2026-08-12' : addDays('2026-11-01', -Math.floor(random() * 200)),
    },
    security: {
      method: record.twoFactor ? "Application d'authentification" : 'Aucune',
      since: record.twoFactor ? (marc ? '2025-02-03' : record.createdOn) : null,
      backupCodesLeft: record.twoFactor ? (marc ? 8 : 10 - Math.floor(random() * 3)) : 0,
      backupCodesTotal: record.twoFactor ? 10 : 0,
      sessions: record.sessions,
      lastFailure: marc || random() > 0.4 ? 'Aucun' : '12/11/2026, 19:02',
    },
  };
}
