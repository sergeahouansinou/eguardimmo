import { describe, expect, it } from 'vitest';
import { meData } from '../fixtures';
import { setupApi, jsonResponse } from '../testApi';
import { fetchOperator } from './me';

describe('profil de l’opérateur', () => {
  it('lit l’identité et les rôles servis par GET /console/me', async () => {
    const { client, url } = setupApi(jsonResponse(200, meData(['support', 'billing'])));

    const me = await fetchOperator(client);

    expect(url().pathname).toBe('/api/v1/console/me');
    expect(me).toMatchObject({ name: 'Awa Diallo', email: 'awa.diallo@eguardimmo.test', roles: ['support', 'billing'], phone: null });
  });

  it('ignore un rôle inconnu du front au lieu de casser toute la console', async () => {
    const { client } = setupApi(jsonResponse(200, meData(['admin', 'nouveau-role'])));

    expect((await fetchOperator(client)).roles).toEqual(['admin']);
  });

  it('refuse une réponse sans rôles, sans identité ou avec une adresse invalide', async () => {
    const withoutRoles = { data: { ...meData().data, roles: undefined } };
    await expect(fetchOperator(setupApi(jsonResponse(200, withoutRoles)).client)).rejects.toThrow('Réponse inattendue');
    await expect(fetchOperator(setupApi(jsonResponse(200, { data: { ...meData().data, email: 'pas-un-courriel' } })).client)).rejects.toThrow('Réponse inattendue');
  });

  it('propage 401 et 403 sans les transformer', async () => {
    await expect(fetchOperator(setupApi(jsonResponse(401, { code: 'unauthenticated', title: 'Non authentifié' })).client)).rejects.toMatchObject({ status: 401 });
    await expect(fetchOperator(setupApi(jsonResponse(403, { code: 'space_forbidden', title: 'Accès refusé' })).client)).rejects.toMatchObject({ status: 403, code: 'space_forbidden' });
  });
});
