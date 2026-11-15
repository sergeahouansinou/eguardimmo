import {
  ConsoleError,
  PROFILE_LABELS,
  exportAuditResultSchema,
  accessRequestInputSchema,
  accountDetailSchema,
  accountFiltersSchema,
  accountListSchema,
  listQuerySchema,
  matchesQuery,
  paginate,
  suspendInputSchema,
} from '../../schemas';
import type { ComptesApi } from '../../source';
import { buildAccountDetail, toAccountRow } from '../comptes';
import type { AccountRecord } from '../comptes';
import { requireFound } from '../context';
import type { DemoContext } from '../context';

function findAccount(ctx: DemoContext, id: string): AccountRecord {
  return requireFound(ctx.state.accounts.find((account) => account.id === id), 'Compte');
}

export function comptesApi(ctx: DemoContext): ComptesApi {
  const target = (account: AccountRecord) => ({ resource: `Compte de ${account.name}`, module: 'Comptes' });

  return {
    list: (rawQuery) => {
      const query = listQuerySchema.parse(rawQuery);
      const filters = accountFiltersSchema.parse(rawQuery);
      const tab = rawQuery.tab ?? '';
      const base = ctx.state.accounts.filter(
        (account) =>
          matchesQuery(query.q, account.name, account.email) &&
          (filters.profile === '' || account.profiles.includes(filters.profile)) &&
          (filters.twoFactor === '' || account.twoFactor === (filters.twoFactor === 'avec')),
      );
      const filtered = base.filter((account) => tab === '' || account.state === tab);
      const all = ctx.state.accounts;
      return Promise.resolve(
        accountListSchema.parse({
          ...paginate(filtered.map(toAccountRow), query.page, query.pageSize),
          counts: {
            all: base.length,
            actif: base.filter((account) => account.state === 'actif').length,
            invite: base.filter((account) => account.state === 'invite').length,
            suspendu: base.filter((account) => account.state === 'suspendu').length,
          },
          stats: {
            accounts: all.length,
            profiles: all.reduce((sum, account) => sum + account.profiles.length, 0),
            multiProfile: all.filter((account) => account.profiles.length > 1).length,
            withThreeProfiles: all.filter((account) => account.profiles.length === 3).length,
            invited: all.filter((account) => account.state === 'invite').length,
            suspended: all.filter((account) => account.state === 'suspendu').length,
          },
        }),
      );
    },

    export: (rawQuery) => {
      const query = listQuerySchema.parse(rawQuery);
      const filters = accountFiltersSchema.parse(rawQuery);
      const tab = rawQuery.tab ?? '';
      const accounts = ctx.state.accounts.filter(
        (account) =>
          matchesQuery(query.q, account.name, account.email) &&
          (filters.profile === '' || account.profiles.includes(filters.profile)) &&
          (filters.twoFactor === '' || account.twoFactor === (filters.twoFactor === 'avec')) &&
          (tab === '' || account.state === tab),
      );
      const lines = accounts.map((account) =>
        [account.name, account.email, account.profiles.map((kind) => PROFILE_LABELS[kind]).join(' + '), account.twoFactor ? 'Oui' : 'Non', account.state].join(';'),
      );
      ctx.audit.record({
        type: 'export',
        title: 'Export des comptes',
        context: `${String(accounts.length)} comptes`,
        action: 'Export',
        module: 'Comptes',
        request: 'GET /api/console/comptes/export',
        after: { Comptes: String(accounts.length) },
      });
      return Promise.resolve(
        exportAuditResultSchema.parse({
          filename: 'comptes.csv',
          csv: ['Compte;E-mail;Profils;2FA;État', ...lines].join('\n'),
          rows: accounts.length,
        }),
      );
    },

    get: (id) => Promise.resolve(accountDetailSchema.parse(buildAccountDetail(findAccount(ctx, id), ctx.state.orgs))),

    suspend: (id, rawInput) => {
      const input = suspendInputSchema.parse(rawInput);
      const account = findAccount(ctx, id);
      if (account.state === 'suspendu') throw new ConsoleError('conflict', 'Ce compte est déjà suspendu.');
      if (account.state === 'invite') throw new ConsoleError('invalid', 'Une invitation en attente ne se suspend pas : annulez-la.');
      account.state = 'suspendu';
      account.sessions = 0;
      ctx.audit.record({
        type: 'compte',
        title: 'Compte suspendu',
        context: `${account.name}, motif : ${input.reason}`,
        action: 'Suspension',
        ...target(account),
        request: `POST /api/console/comptes/${id}/suspension`,
        before: { État: 'Actif' },
        after: { État: 'Suspendu' },
      });
      return Promise.resolve();
    },

    reactivate: (id) => {
      const account = findAccount(ctx, id);
      if (account.state !== 'suspendu') throw new ConsoleError('conflict', 'Ce compte n’est pas suspendu.');
      account.state = 'actif';
      ctx.audit.record({
        type: 'compte',
        title: 'Compte réactivé',
        context: account.name,
        action: 'Réactivation',
        ...target(account),
        request: `DELETE /api/console/comptes/${id}/suspension`,
        before: { État: 'Suspendu' },
        after: { État: 'Actif' },
      });
      return Promise.resolve();
    },

    resetTwoFactor: (id) => {
      const account = findAccount(ctx, id);
      if (!account.twoFactor) throw new ConsoleError('conflict', 'La double authentification n’est pas activée.');
      account.twoFactor = false;
      account.sessions = 0;
      ctx.audit.record({
        type: 'securite',
        title: 'Double authentification réinitialisée',
        context: `${account.name}, sessions révoquées`,
        action: 'Réinitialisation de la 2FA',
        ...target(account),
        request: `DELETE /api/console/comptes/${id}/2fa`,
        before: { '2FA': 'Activée' },
        after: { '2FA': 'À reconfigurer à la prochaine connexion' },
      });
      return Promise.resolve();
    },

    revokeSessions: (id) => {
      const account = findAccount(ctx, id);
      const revoked = account.sessions;
      account.sessions = 0;
      ctx.audit.record({
        type: 'securite',
        title: 'Sessions révoquées',
        context: `${account.name}, ${String(revoked)} appareil(s)`,
        action: 'Révocation des sessions',
        ...target(account),
        request: `DELETE /api/console/comptes/${id}/sessions`,
        before: { 'Sessions actives': String(revoked) },
        after: { 'Sessions actives': '0' },
      });
      return Promise.resolve();
    },

    requestAccess: (id, rawInput) => {
      const input = accessRequestInputSchema.parse(rawInput);
      const account = findAccount(ctx, id);
      const minutes = ctx.state.security.justifiedAccessMinutes;
      ctx.audit.record({
        type: 'acces_justifie',
        title: 'Accès aux données ouvert',
        context: `${account.name}, ${input.ticket === '' ? 'sans ticket' : `ticket ${input.ticket}`}, ${String(minutes)} min`,
        action: 'Ouverture',
        ...target(account),
        request: `POST /api/console/comptes/${id}/acces`,
        after: { Motif: input.reason, Durée: `${String(minutes)} minutes` },
        justified: true,
      });
      return Promise.resolve();
    },
  };
}
