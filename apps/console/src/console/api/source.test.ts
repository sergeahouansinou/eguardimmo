import { createApiClient } from '@eguardimmo/api';
import { shellSchema } from '@eguardimmo/shell';
import { describe, expect, it, vi } from 'vitest';
import { ConsoleError } from '../schemas';
import { UNAVAILABLE_MESSAGE } from '../unavailable';
import { requestUrl } from '../../../test/requestUrl';
import * as api from './fixtures';
import { createApiConsoleSource } from './source';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(...responses: Response[]) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(() => {
    const next = queue.shift();
    return next ? Promise.resolve(next) : Promise.reject(new TypeError('Aucune réponse prévue'));
  });
  const client = createApiClient({ baseUrl: 'https://console.test', fetchImpl, readCookie: () => 'x' });
  const login = vi.fn();
  const created = createApiConsoleSource(client, { login, signOut: vi.fn() });
  return { ...created, fetchImpl, login };
}

describe('source API de la console', () => {
  it('construit la coquille depuis console/me, sans compteur ni notification inventés', async () => {
    const { source, fetchImpl } = setup(json(200, api.meResponse));
    const shell = shellSchema.parse(await source.shell());

    expect(requestUrl(fetchImpl.mock.calls[0]?.[0] ?? '')).toBe('https://console.test/api/v1/console/me');
    expect(shell).toEqual({
      user: { firstName: 'Awa', fullName: 'Awa Diallo', initials: 'AD', email: 'awa.diallo@eguardimmo.test' },
      workspace: { name: 'Équipe opérateur', role: 'operateur' },
      counts: {},
      notifications: [],
    });
  });

  it('expose l’identifiant de l’opérateur pour aligner ses messages', async () => {
    const { operatorId } = setup(json(200, api.meResponse));
    expect(await operatorId()).toBe(api.IDS.me);
  });

  it('refuse une identité hors contrat et propage un 401', async () => {
    const malformed = setup(json(200, { data: { id: api.IDS.me, name: '', email: 'pas-un-courriel' } }));
    await expect(malformed.source.shell()).rejects.toThrow('Réponse inattendue du serveur');
    const refused = setup(json(401, { code: 'unauthenticated', title: 'Non authentifié' }));
    await expect(refused.source.shell()).rejects.toMatchObject({ status: 401 });
  });

  it('refuse de marquer des notifications comme lues, sans appel réseau', async () => {
    const { source, fetchImpl } = setup();
    await expect(source.markAllNotificationsRead()).rejects.toThrow('Les notifications ne sont pas encore reliées au serveur.');
    await expect(source.markNotificationRead('x')).rejects.toThrow('Les notifications ne sont pas encore reliées au serveur.');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejette chaque famille sans source, sans aucun appel réseau ni donnée de démonstration', async () => {
    const { source, fetchImpl } = setup();
    const calls: (() => Promise<unknown>)[] = [
      () => source.overview(),
      () => source.organisations.list({}),
      () => source.organisations.suspend('x', { reason: 'Facture impayée' }),
      () => source.comptes.get('x'),
      () => source.modules.list({}),
      () => source.abonnements.overview(),
      () => source.audit.list({}),
      () => source.rgpd.list({}),
      () => source.sante.get(),
      () => source.sauvegardes.get(),
      () => source.parametres.profile(),
      () => source.equipe.list(),
    ];

    for (const call of calls) await expect(call()).rejects.toMatchObject({ code: 'invalid', message: UNAVAILABLE_MESSAGE });
    await expect(source.equipe.list()).rejects.toBeInstanceOf(ConsoleError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('transmet l’authentification fournie', () => {
    const { source, login } = setup();
    expect(source.auth.login).toBe(login);
  });
});
