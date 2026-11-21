import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { AccountIdentityPanel } from './AccountIdentityPanel';
import { meResponse, noProfilesResponse, profilesResponse, serverErrorProblem, tooManyRequestsProblem, unauthenticatedProblem } from './responses.fixtures';
import { renderWithClient, stubApi } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPanel() {
  return renderWithClient((client) => <AccountIdentityPanel client={client} timeZone="UTC" />);
}

describe('Mon compte en mode API : identité', () => {
  it('affiche l’identité lue sur /me et les espaces lus sur /me/profiles', async () => {
    const api = stubApi({ 'GET /api/v1/me': { body: meResponse }, 'GET /api/v1/me/profiles': { body: profilesResponse } });

    const { container } = renderPanel();

    const identity = await screen.findByRole('region', { name: 'Identité' });
    expect(await within(identity).findByText('Jeanne Martin')).toBeTruthy();
    expect(within(identity).getByText('jeanne@exemple.fr')).toBeTruthy();
    expect(within(identity).getByText('Vérifiée')).toBeTruthy();
    expect(within(identity).getByText('14 novembre 2026 à 18:30')).toBeTruthy();
    expect(within(identity).getByText('10 novembre 2026 à 09:00')).toBeTruthy();
    const spaces = screen.getByRole('region', { name: 'Mes espaces' });
    expect(await within(spaces).findByText('Agence Les Tilleuls')).toBeTruthy();
    expect(within(spaces).getByText('Agence · Titulaire')).toBeTruthy();
    expect(within(spaces).getByText('Espace locataire')).toBeTruthy();
    expect(api.count('GET', '/api/v1/me')).toBe(1);
    expect(api.calls.every((call) => call.method === 'GET')).toBe(true);
    await expectNoA11yViolations(container);
  });

  it('renvoie vers Mon compte pour l’e-mail, sans champ modifiable ni appel d’écriture', async () => {
    const api = stubApi({ 'GET /api/v1/me': { body: meResponse }, 'GET /api/v1/me/profiles': { body: profilesResponse } });

    renderPanel();

    const identity = await screen.findByRole('region', { name: 'Identité' });
    await within(identity).findByText('Jeanne Martin');
    const link = within(identity).getByRole('link', { name: /Modifier l’adresse e-mail/ });
    expect(link.getAttribute('href')).toBe('http://localhost:3040/compte/securite');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(within(identity).queryAllByRole('textbox')).toHaveLength(0);
    expect(api.calls.some((call) => call.method !== 'GET')).toBe(false);
  });

  it('signale une adresse non vérifiée et une première connexion sans précédente', async () => {
    stubApi({
      'GET /api/v1/me': { body: { data: { ...meResponse.data, email_verified_at: null, previous_login_at: null } } },
      'GET /api/v1/me/profiles': { body: noProfilesResponse },
    });

    renderPanel();

    const identity = await screen.findByRole('region', { name: 'Identité' });
    expect(await within(identity).findByText('Non vérifiée')).toBeTruthy();
    expect(within(identity).getByText('—')).toBeTruthy();
    expect(await screen.findByText('Aucun espace')).toBeTruthy();
  });

  it('propose la connexion avec retour quand la session a expiré (401)', async () => {
    stubApi({
      'GET /api/v1/me': { status: 401, body: unauthenticatedProblem },
      'GET /api/v1/me/profiles': { status: 401, body: unauthenticatedProblem },
    });

    renderPanel();

    const identity = await screen.findByRole('region', { name: 'Identité' });
    expect(await within(identity).findByText('Votre session a expiré. Reconnectez-vous pour continuer.')).toBeTruthy();
    const href = within(identity).getByRole('link', { name: 'Se connecter' }).getAttribute('href') ?? '';
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe('http://localhost:3040/connexion');
    expect(url.searchParams.get('return_to')).toBe(window.location.href);
  });

  it('isole la panne des espaces : l’identité reste affichée et la lecture peut être relancée', async () => {
    let attempts = 0;
    stubApi({
      'GET /api/v1/me': { body: meResponse },
      'GET /api/v1/me/profiles': () => {
        attempts += 1;
        return attempts === 1 ? { status: 500, body: serverErrorProblem } : { body: profilesResponse };
      },
    });

    const { user } = renderPanel();

    const spaces = await screen.findByRole('region', { name: 'Mes espaces' });
    expect(await within(spaces).findByText('Vos espaces n’ont pas pu être chargés')).toBeTruthy();
    expect(within(spaces).getByText('Une erreur interne est survenue. Réessayez plus tard.')).toBeTruthy();
    expect(await screen.findByText('Jeanne Martin')).toBeTruthy();
    await user.click(within(spaces).getByRole('button', { name: 'Réessayer' }));
    expect(await within(spaces).findByText('Agence Les Tilleuls')).toBeTruthy();
  });

  it('traduit le 429 avec son délai et le réseau coupé en français', async () => {
    stubApi({
      'GET /api/v1/me': { status: 429, body: tooManyRequestsProblem, headers: { 'Retry-After': '42' } },
      'GET /api/v1/me/profiles': { network: true },
    });

    renderPanel();

    expect(await screen.findByText('Trop de demandes en peu de temps. Patientez 42 s avant de réessayer.')).toBeTruthy();
    expect(await screen.findByText('Le serveur est injoignable. Vérifiez votre connexion et réessayez.')).toBeTruthy();
  });

  it('refuse une réponse mal formée au lieu d’afficher des données vides', async () => {
    stubApi({ 'GET /api/v1/me': { body: { data: { name: 'Jeanne' } } }, 'GET /api/v1/me/profiles': { body: profilesResponse } });

    renderPanel();

    expect(await screen.findByText('Le serveur a répondu de façon inattendue. Réessayez dans un instant.')).toBeTruthy();
    expect(screen.queryByText('Jeanne')).toBeNull();
  });
});
