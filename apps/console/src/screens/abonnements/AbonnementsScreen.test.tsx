import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import type { RecordedRequest } from '../../../test/platform';
import { problem } from '@/platform/fixtures';
import { PLAN_IDS, plansResponse, subscriptionData, subscriptionsResponse } from '@/platform/plans/planFixtures';
import { AbonnementsScreen } from './AbonnementsScreen';
import { chooseOption, consolePath, withOperator } from './testSupport';

interface Setup {
  plans?: (request: RecordedRequest) => Response | undefined;
  subscriptions?: (request: RecordedRequest) => Response | undefined;
}

function mount({ plans, subscriptions }: Setup = {}) {
  return renderPlatform(
    <AbonnementsScreen />,
    withOperator({ roles: ['billing'] }, (request) => {
      const path = consolePath(request);
      if (path === '/plans') return plans?.(request) ?? json(200, plansResponse());
      if (path === '/subscriptions') return subscriptions?.(request) ?? json(200, subscriptionsResponse());
      return undefined;
    }),
  );
}

const subscriptionCalls = (requests: RecordedRequest[]) => requests.filter((request) => consolePath(request) === '/subscriptions');

describe('écran des abonnements', () => {
  it('liste les plans avec leur version publiée et leur brouillon, sans aucun montant de revenu', async () => {
    const view = mount();

    const table = await screen.findByRole('table', { name: 'Plans' });
    expect(within(table).getAllByRole('link', { name: /Gold/ }).map((link) => link.getAttribute('href'))).toEqual(['/abonnements/plans/gold', '/abonnements/plans/gold']);
    expect(within(table).getByText(/v2/)).toBeTruthy();
    expect(within(table).getByText(/Brouillon v3/)).toBeTruthy();
    expect(screen.getByText('Facturation et encaissement : bientôt disponible')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/MRR|ARR|revenu récurrent annuel/i);
    await expectNoA11yViolations(view.container);
  });

  it('affiche l’état vide quand aucun plan n’existe', async () => {
    mount({ plans: () => json(200, { data: [] }) });

    expect(await screen.findByText('Aucun plan')).toBeTruthy();
  });

  it.each([
    [403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.'), 'Accès réservé'],
    [429, problem(429, 'too_many_requests', 'Trop de requêtes.'), 'Trop de requêtes'],
    [500, problem(500, 'server_error', 'Erreur interne.'), 'Les plans n’a pas pu être chargé'],
  ])('affiche l’erreur %i des plans', async (status, body, title) => {
    mount({ plans: () => json(status, body, status === 429 ? { 'Retry-After': '8' } : {}) });

    expect(await screen.findByText(title, {}, { timeout: 4000 })).toBeTruthy();
  });

  it('recharge les plans par « Réessayer » après une panne', async () => {
    let calls = 0;
    mount({ plans: () => (++calls === 1 ? json(429, problem(429, 'too_many_requests', 'Trop de requêtes.')) : json(200, plansResponse())) });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('table', { name: 'Plans' })).toBeTruthy();
  });

  describe('onglet des abonnements', () => {
    const openTab = async (user: ReturnType<typeof userEvent.setup>) => {
      await screen.findByRole('table', { name: 'Plans' });
      await user.click(screen.getByRole('tab', { name: 'Abonnements' }));
    };

    it('liste les abonnements avec statut français et lien vers l’organisation', async () => {
      const view = mount();
      const user = userEvent.setup();
      await openTab(user);

      const table = await screen.findByRole('table', { name: 'Abonnements' });
      expect(within(table).getByText('En essai')).toBeTruthy();
      expect(within(table).getByText('Actif')).toBeTruthy();
      expect(within(table).getAllByRole('link')[0]?.getAttribute('href')).toBe(`/organisations/${PLAN_IDS.org}`);
      await expectNoA11yViolations(view.container);
    });

    it('transmet statut, plan et essais finissants au serveur et revient à la première page', async () => {
      const view = mount({ subscriptions: () => json(200, subscriptionsResponse(undefined, { has_more: true, next_cursor: 'curseur-2' })) });
      const user = userEvent.setup();
      await openTab(user);
      await screen.findByRole('table', { name: 'Abonnements' });
      await user.click(screen.getByRole('button', { name: 'Page suivante' }));
      await waitFor(() => { expect(subscriptionCalls(view.requests).some((request) => request.url.searchParams.get('cursor') === 'curseur-2')).toBe(true); });
      await chooseOption(user, /^Statut/, 'En essai');
      await chooseOption(user, /^Plan/, 'gold');
      await user.click(screen.getByLabelText('Essais finissant sous 3 jours'));

      await waitFor(() => {
        const last = subscriptionCalls(view.requests).at(-1);
        expect(last?.url.searchParams.get('status')).toBe('trialing');
        expect(last?.url.searchParams.get('plan')).toBe('gold');
        expect(last?.url.searchParams.get('trial_ending')).toBe('1');
        expect(last?.url.searchParams.has('cursor')).toBe(false);
      });
    });

    it('affiche l’état vide quand aucun abonnement ne correspond', async () => {
      mount({ subscriptions: () => json(200, subscriptionsResponse([])) });
      await openTab(userEvent.setup());

      expect(await screen.findByText('Aucun abonnement')).toBeTruthy();
    });

    it.each([
      [403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.'), 'Accès réservé'],
      [429, problem(429, 'too_many_requests', 'Trop de requêtes.'), 'Trop de requêtes'],
    ])('affiche l’erreur %i des abonnements', async (status, body, title) => {
      mount({ subscriptions: () => json(status, body, status === 429 ? { 'Retry-After': '5' } : {}) });
      await openTab(userEvent.setup());

      expect(await screen.findByText(title, {}, { timeout: 4000 })).toBeTruthy();
    });

    it('ne montre pas de ligne pour un statut inconnu mais affiche l’erreur de contrat', async () => {
      mount({ subscriptions: () => json(200, subscriptionsResponse([subscriptionData({ status: 'inconnu' })])) });
      await openTab(userEvent.setup());

      expect(await screen.findByText('Les abonnements n’a pas pu être chargé')).toBeTruthy();
    });
  });
});
