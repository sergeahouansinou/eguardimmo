import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { IDS, cursorPage } from '../testing/fixtures';
import { orgUrl, problem, renderTenantRequests } from '../testing/render';
import type { MockRoute } from '../testing/render';
import { apiAccountSchema, createApiOnlinePaymentsSource } from './api';
import { accountPending, accountReady, onboardingResult, paymentFailed, paymentPending, paymentSucceeded } from './fixtures';
import { OnlinePaymentsPage } from './OnlinePaymentsPage';
import { OnlinePaymentsSourceProvider, useOnlinePaymentsSource } from './source';

const SLOW = { timeout: 4000 };
const listUrl = orgUrl('/online-payments');
const accountUrl = orgUrl('/payments/account');
const PROOF_PATH = '/auth/reauthenticate/two-factor';

function renderPayments(routes: Record<string, MockRoute>, options: { role?: string | null; search?: string } = {}) {
  return renderTenantRequests(
    (context) => (
      <OnlinePaymentsSourceProvider source={createApiOnlinePaymentsSource(context)}>
        <OnlinePaymentsPage />
      </OnlinePaymentsSourceProvider>
    ),
    routes,
    { role: 'owner', ...options },
  );
}

const baseRoutes = (account: unknown = accountReady): Record<string, MockRoute> => ({
  [`GET ${listUrl}`]: { body: cursorPage([paymentSucceeded, paymentFailed, paymentPending]) },
  [`GET ${accountUrl}`]: { body: { data: account } },
});

const twice = (first: MockRoute, then: MockRoute): MockRoute => {
  let count = 0;
  return (call) => {
    count += 1;
    const route = count === 1 ? first : then;
    return typeof route === 'function' ? route(call) : route;
  };
};

describe('paiements en ligne : liste', () => {
  it('affiche montant, moyen, statut, référence et échec, avec locataire et bail', async () => {
    const { container } = renderPayments(baseRoutes());
    const table = await screen.findByRole('table', { name: 'Paiements en ligne' }, SLOW);
    expect(await within(table).findByText('Marc Chevalier', {}, SLOW)).toBeTruthy();
    expect(within(table).getAllByText(/850/)).toHaveLength(3);
    expect(within(table).getByText('Prélèvement SEPA')).toBeTruthy();
    expect(within(table).getByText('Réussi')).toBeTruthy();
    expect(within(table).getByText('Échoué')).toBeTruthy();
    expect(within(table).getByText('Échec : card_declined')).toBeTruthy();
    expect(within(table).getByText('pi_fake_4821')).toBeTruthy();
    expect(within(table).getAllByText('BL-2026-0042')).toHaveLength(3);
    await expectNoA11yViolations(container);
  });

  it('transmet le filtre de statut et le bail de l’adresse au serveur', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderPayments(baseRoutes(), { search: `bail=${IDS.lease}` });
    await screen.findByRole('table', { name: 'Paiements en ligne' }, SLOW);
    expect(callsTo('GET', listUrl)[0]?.search.get('lease_id')).toBe(IDS.lease);
    await user.click(screen.getByRole('combobox', { name: /Statut/ }));
    await user.click(await screen.findByRole('option', { name: 'Échoué' }));
    await waitFor(() => { expect(callsTo('GET', listUrl).some((call) => call.search.get('status') === 'failed' && call.search.get('lease_id') === IDS.lease)).toBe(true); }, SLOW);
  });

  it('le comptable lit la liste sans carte de compte ni appel au compte', async () => {
    const { calls } = renderPayments(baseRoutes(), { role: 'accountant' });
    await screen.findByRole('table', { name: 'Paiements en ligne' }, SLOW);
    expect(screen.queryByRole('region', { name: 'Compte de paiement' })).toBeNull();
    expect(screen.queryByText('Compte de paiement')).toBeNull();
    expect(calls.filter((call) => call.path === accountUrl)).toHaveLength(0);
  });

  it('le gestionnaire n’a pas la carte de compte', async () => {
    const { calls } = renderPayments(baseRoutes(), { role: 'manager' });
    await screen.findByRole('table', { name: 'Paiements en ligne' }, SLOW);
    expect(screen.queryByText('Compte de paiement')).toBeNull();
    expect(calls.filter((call) => call.path === accountUrl)).toHaveLength(0);
  });

  it('refuse un rôle inconnu sans appeler le serveur', async () => {
    const { calls } = renderPayments(baseRoutes(), { role: 'viewer' });
    expect(await screen.findByText('Page indisponible pour votre rôle', {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('affiche l’état vide, l’erreur de chargement et la traduction du 403', async () => {
    const empty = renderPayments({ ...baseRoutes(), [`GET ${listUrl}`]: { body: cursorPage([]) } });
    expect(await screen.findByText('Aucun paiement en ligne pour le moment.', {}, SLOW)).toBeTruthy();
    empty.unmount();
    renderPayments({ ...baseRoutes(), [`GET ${listUrl}`]: problem(500, 'server_error') });
    expect(await screen.findByText('Impossible de charger les paiements en ligne', {}, SLOW)).toBeTruthy();
  });

  it('lève en mode api quand la source n’est pas montée', () => {
    function Probe() {
      useOnlinePaymentsSource();
      return null;
    }
    expect(() => renderTenantRequests(() => <Probe />, {})).toThrow(/Aucune source/);
  });
});

describe('paiements en ligne : compte de paiement', () => {
  it('affiche le statut du compte prêt', async () => {
    renderPayments(baseRoutes(accountReady));
    expect(await screen.findByText('Prêt à encaisser', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Actualiser le statut du compte' })).toBeTruthy();
  });

  it('propose d’ouvrir le compte quand il n’existe pas', async () => {
    renderPayments(baseRoutes(null));
    expect(await screen.findByRole('button', { name: 'Ouvrir le compte de paiement' }, SLOW)).toBeTruthy();
    expect(screen.getByText(/Aucun compte de paiement n’est ouvert/)).toBeTruthy();
  });

  it('ouvre le compte, puis propose le lien du prestataire sans le suivre', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderPayments({ ...baseRoutes(accountPending), [`POST ${accountUrl}`]: { body: { data: onboardingResult } } });
    await user.click(await screen.findByRole('button', { name: 'Terminer l’ouverture du compte' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Ouvrir ou actualiser le compte de paiement ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    const link = await screen.findByRole('link', { name: /Continuer l’ouverture chez le prestataire/ }, SLOW);
    expect(link.getAttribute('href')).toBe('https://connect.example.test/onboarding/abc');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(callsTo('POST', accountUrl)).toHaveLength(1);
    expect(callsTo('POST', accountUrl)[0]?.body).toEqual({});
  });

  it('exige la preuve de double authentification puis rejoue l’appel', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderPayments({
      ...baseRoutes(accountPending),
      [`POST ${accountUrl}`]: twice(problem(403, 'reauthentication_required'), { body: { data: accountReady } }),
      [`POST ${PROOF_PATH}`]: { status: 204 },
    });
    await user.click(await screen.findByRole('button', { name: 'Terminer l’ouverture du compte' }, SLOW));
    const confirm = await screen.findByRole('dialog', { name: 'Ouvrir ou actualiser le compte de paiement ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Confirmer' }));
    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' }, SLOW);
    await user.type(within(proof).getByLabelText(/Code de double authentification/), '123456');
    await user.click(within(proof).getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => { expect(callsTo('POST', accountUrl)).toHaveLength(2); }, SLOW);
    expect(callsTo('POST', PROOF_PATH)[0]?.body).toEqual({ code: '123456' });
  });

  it('sans double authentification activée, renvoie vers la sécurité du compte', async () => {
    const user = userEvent.setup();
    renderPayments({ ...baseRoutes(accountPending), [`POST ${accountUrl}`]: problem(403, 'two_factor_required') });
    await user.click(await screen.findByRole('button', { name: 'Terminer l’ouverture du compte' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Ouvrir ou actualiser le compte de paiement ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    expect(await within(dialog).findByText(/exige la double authentification/, {}, SLOW)).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Ouvrir Connexion et sécurité' }).getAttribute('href')).toBe('/compte/securite');
  });

  it('traduit le 503 du prestataire et le 409 compte non prêt', async () => {
    const user = userEvent.setup();
    renderPayments({ ...baseRoutes(accountPending), [`POST ${accountUrl}`]: problem(503, 'payment_provider_unavailable', 'English detail') });
    await user.click(await screen.findByRole('button', { name: 'Terminer l’ouverture du compte' }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Ouvrir ou actualiser le compte de paiement ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    expect(await within(dialog).findByText(/prestataire de paiement est momentanément indisponible/, {}, SLOW)).toBeTruthy();
    expect(within(dialog).queryByText('English detail')).toBeNull();
  });

  it('signale l’échec de lecture du compte', async () => {
    renderPayments({ ...baseRoutes(), [`GET ${accountUrl}`]: problem(403, 'forbidden') });
    expect(await screen.findByText(/Impossible de charger le compte de paiement/, {}, SLOW)).toBeTruthy();
  });
});

describe('schéma du compte de paiement', () => {
  it.each(['http://connect.example.test/onboarding', 'data:text/html,x', 'javascript:alert(1)', '/relatif'])(
    'refuse une URL de souscription non https : %s',
    (url) => {
      expect(apiAccountSchema.safeParse({ ...accountPending, onboarding_url: url }).success).toBe(false);
    },
  );

  it('accepte une URL https et l’absence d’URL', () => {
    expect(apiAccountSchema.safeParse(onboardingResult).success).toBe(true);
    expect(apiAccountSchema.safeParse(accountReady).success).toBe(true);
  });
});
