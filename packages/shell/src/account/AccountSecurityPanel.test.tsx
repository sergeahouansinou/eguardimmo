import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { AccountSecurityPanel } from './AccountSecurityPanel';
import {
  ACCOUNT_IDS,
  devicesAfterRevocation,
  devicesResponse,
  noDevicesResponse,
  notFoundProblem,
  securityResponse,
  securityWithTwoFactorResponse,
  serverErrorProblem,
  tooManyRequestsProblem,
  unauthenticatedProblem,
} from './responses.fixtures';
import { renderWithClient, stubApi } from './testing';
import type { Reply } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
});

const DELETE_OTHER = `DELETE /api/v1/me/devices/${ACCOUNT_IDS.otherDevice}`;

function renderPanel() {
  return renderWithClient((client) => <AccountSecurityPanel client={client} timeZone="UTC" />);
}

function withRevocation(revocation: Reply) {
  let revoked = false;
  const api = stubApi({
    'GET /api/v1/me/security': { body: securityResponse },
    'GET /api/v1/me/devices': () => ({ body: revoked ? devicesAfterRevocation : devicesResponse }),
    [DELETE_OTHER]: () => {
      if ((revocation.status ?? 204) < 400) revoked = true;
      return revocation;
    },
  });
  return api;
}

describe('Connexion et sécurité en mode API : état de sécurité', () => {
  it('affiche une double authentification non activée et les liens vers le hub', async () => {
    stubApi({ 'GET /api/v1/me/security': { body: securityResponse }, 'GET /api/v1/me/devices': { body: devicesResponse } });

    const { container } = renderPanel();

    const connection = await screen.findByRole('region', { name: 'Connexion' });
    expect(await within(connection).findByText('Non activée')).toBeTruthy();
    expect(within(connection).queryByText('Activée')).toBeNull();
    expect(within(connection).getByText('Défini')).toBeTruthy();
    expect(within(connection).getByText('Aucun compte Google ou Apple lié.')).toBeTruthy();
    const hrefs = within(connection).getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      'http://localhost:3040/compte/securite',
      'http://localhost:3040/compte/securite',
      'http://localhost:3040/compte/securite/double-authentification',
      'http://localhost:3040/compte/comptes-lies',
    ]);
    await screen.findByText('Pixel 9');
    await expectNoA11yViolations(container);
  });

  it('affiche la double authentification activée, ses codes de secours et les comptes liés', async () => {
    stubApi({ 'GET /api/v1/me/security': { body: securityWithTwoFactorResponse }, 'GET /api/v1/me/devices': { body: devicesResponse } });

    renderPanel();

    const connection = await screen.findByRole('region', { name: 'Connexion' });
    expect(await within(connection).findByText('Activée')).toBeTruthy();
    expect(within(connection).queryByText('Non activée')).toBeNull();
    expect(within(connection).getByText(/Activée le 12 novembre 2026 · 6 codes de secours restants sur 8/)).toBeTruthy();
    expect(within(connection).getByText('Google (jeanne@gmail.test)')).toBeTruthy();
  });

  it('signale un compte sans mot de passe', async () => {
    stubApi({
      'GET /api/v1/me/security': { body: { data: { ...securityResponse.data, has_password: false } } },
      'GET /api/v1/me/devices': { body: noDevicesResponse },
    });

    renderPanel();

    expect(await screen.findByText('Aucun mot de passe : vous vous connectez avec Google ou Apple.')).toBeTruthy();
  });

  it('renvoie la suppression du compte vers le hub sans jamais appeler DELETE /me', async () => {
    const api = stubApi({ 'GET /api/v1/me/security': { body: securityResponse }, 'GET /api/v1/me/devices': { body: devicesResponse } });

    const { user } = renderPanel();

    const card = await screen.findByRole('region', { name: 'Suppression du compte' });
    const link = within(card).getByRole('link', { name: /Supprimer mon compte/ });
    expect(link.getAttribute('href')).toBe('http://localhost:3040/compte/supprimer');
    await user.click(link);
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('isole les pannes : la sécurité en 429 n’empêche pas les appareils, le 401 des appareils propose la connexion', async () => {
    stubApi({
      'GET /api/v1/me/security': { status: 429, body: tooManyRequestsProblem, headers: { 'Retry-After': '42' } },
      'GET /api/v1/me/devices': { status: 401, body: unauthenticatedProblem },
    });

    renderPanel();

    expect(await screen.findByText('Trop de demandes en peu de temps. Patientez 42 s avant de réessayer.')).toBeTruthy();
    const devices = screen.getByRole('region', { name: 'Appareils mobiles connectés' });
    expect(await within(devices).findByText('Votre session a expiré. Reconnectez-vous pour continuer.')).toBeTruthy();
    expect(within(devices).getByRole('link', { name: 'Se connecter' })).toBeTruthy();
  });
});

describe('Connexion et sécurité en mode API : appareils', () => {
  it('liste les appareils sans proposer de révoquer l’appareil courant', async () => {
    stubApi({ 'GET /api/v1/me/security': { body: securityResponse }, 'GET /api/v1/me/devices': { body: devicesResponse } });

    renderPanel();

    const devices = await screen.findByRole('region', { name: 'Appareils mobiles connectés' });
    expect(await within(devices).findByText('Pixel 9')).toBeTruthy();
    expect(within(devices).getByText('iPhone de Jeanne')).toBeTruthy();
    expect(within(devices).getByText('Cet appareil')).toBeTruthy();
    expect(within(devices).getByText('Dernière activité le 17 novembre 2026 à 12:06')).toBeTruthy();
    expect(within(devices).getByText('Ajouté le 17 novembre 2026, jamais utilisé depuis')).toBeTruthy();
    expect(within(devices).getAllByRole('button', { name: /Révoquer/ }).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Révoquer Pixel 9',
    ]);
  });

  it('n’affiche aucun bouton de révocation sans appareil', async () => {
    stubApi({ 'GET /api/v1/me/security': { body: securityResponse }, 'GET /api/v1/me/devices': { body: noDevicesResponse } });

    renderPanel();

    expect(await screen.findByText('Aucun appareil mobile connecté')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Révoquer/ })).toBeNull();
  });

  it('annuler la confirmation ferme sans aucune requête de révocation', async () => {
    const api = withRevocation({ status: 204 });

    const { user } = renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Révoquer Pixel 9' }));

    const dialog = await screen.findByRole('dialog', { name: 'Révoquer Pixel 9 ?' });
    expect(within(dialog).getByText(/Cet appareil sera déconnecté immédiatement/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('révoque l’appareil confirmé par DELETE, puis recharge la liste', async () => {
    const api = withRevocation({ status: 204 });

    const { user } = renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Révoquer Pixel 9' }));
    const dialog = await screen.findByRole('dialog', { name: 'Révoquer Pixel 9 ?' });
    expect(await axeOfDialog(dialog)).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Révoquer l’appareil' }));

    expect(await screen.findByText('« Pixel 9 » a été déconnecté.')).toBeTruthy();
    await waitFor(() => { expect(screen.queryByText('Pixel 9')).toBeNull(); });
    expect(api.calls.filter((call) => call.method === 'DELETE').map((call) => call.path)).toEqual([`/api/v1/me/devices/${ACCOUNT_IDS.otherDevice}`]);
    expect(api.count('GET', '/api/v1/me/devices')).toBe(2);
    expect(screen.queryByRole('button', { name: /Révoquer/ })).toBeNull();
  });

  it('traite un 404 comme un appareil déjà révoqué et rafraîchit la liste', async () => {
    let calls = 0;
    const api = stubApi({
      'GET /api/v1/me/security': { body: securityResponse },
      'GET /api/v1/me/devices': () => {
        calls += 1;
        return { body: calls === 1 ? devicesResponse : devicesAfterRevocation };
      },
      [DELETE_OTHER]: { status: 404, body: notFoundProblem },
    });

    const { user } = renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Révoquer Pixel 9' }));
    await user.click(await screen.findByRole('button', { name: 'Révoquer l’appareil' }));

    expect(await screen.findByText('« Pixel 9 » était déjà déconnecté. La liste est mise à jour.')).toBeTruthy();
    await waitFor(() => { expect(screen.queryByText('Pixel 9')).toBeNull(); });
    expect(api.count('GET', '/api/v1/me/devices')).toBe(2);
  });

  it.each([
    ['429', { status: 429, body: tooManyRequestsProblem, headers: { 'Retry-After': '42' } }, 'Trop de demandes en peu de temps. Patientez 42 s avant de réessayer.'],
    ['401', { status: 401, body: unauthenticatedProblem }, 'Votre session a expiré. Reconnectez-vous pour continuer.'],
    ['403', { status: 403, body: { ...serverErrorProblem, status: 403, code: 'operator_token_forbidden' } }, 'Vous n’avez pas le droit d’effectuer cette action.'],
    ['réseau', { network: true }, 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.'],
    ['500', { status: 500, body: serverErrorProblem }, 'Une erreur interne est survenue. Réessayez plus tard.'],
  ] satisfies [string, Reply, string][])('garde la confirmation ouverte avec le message français sur une erreur %s', async (_label, reply, message) => {
    const api = withRevocation(reply);

    const { user } = renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Révoquer Pixel 9' }));
    const dialog = await screen.findByRole('dialog', { name: 'Révoquer Pixel 9 ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Révoquer l’appareil' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(message);
    expect(screen.getByText('Pixel 9')).toBeTruthy();
    expect(api.count('GET', '/api/v1/me/devices')).toBe(1);
  });
});

async function axeOfDialog(dialog: HTMLElement): Promise<boolean> {
  await expectNoA11yViolations(dialog);
  return true;
}
