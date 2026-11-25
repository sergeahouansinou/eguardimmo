import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import { problem } from '@/platform/fixtures';
import { plansResponse } from '@/platform/plans/planFixtures';
import { consolePath, withOperator } from '@/screens/abonnements/testSupport';
import { ModulesScreen } from './ModulesScreen';

function mount(plans: () => Response = () => json(200, plansResponse())) {
  return renderPlatform(
    <ModulesScreen />,
    withOperator({ roles: ['billing'] }, (request) => (request.method === 'GET' && consolePath(request) === '/plans' ? plans() : undefined)),
  );
}

describe('écran des modules (mode API)', () => {
  it('liste les fonctions des versions publiées avec les plans qui les incluent, sans erreur d’accessibilité', async () => {
    const view = mount();

    const table = await screen.findByRole('table', { name: 'Modules' });
    const lots = within(table).getByRole('row', { name: /Lots/ });
    expect(within(lots).getByText('Gold')).toBeTruthy();
    expect(within(table).getByRole('row', { name: /Comptes rendus.*Aucun plan/ })).toBeTruthy();
    expect(within(table).getByRole('row', { name: /Mandats/ })).toBeTruthy();
    expect(within(table).getAllByRole('link', { name: /Lots/ })[0]?.getAttribute('href')).toBe('/modules/properties');
    expect(document.body.textContent).not.toMatch(/version\s+\d|responsable|pause des envois/i);
    await expectNoA11yViolations(view.container);
  });

  it('filtre par groupe puis par texte, et signale l’absence de résultat', async () => {
    const user = userEvent.setup();
    mount();
    const table = await screen.findByRole('table', { name: 'Modules' });

    await user.click(screen.getByRole('combobox', { name: /Groupe/ }));
    await user.click(await screen.findByRole('option', { name: 'Gestion' }));
    await waitFor(() => { expect(within(screen.getByRole('table', { name: 'Modules' })).queryByRole('row', { name: /Lots/ })).toBeNull(); });
    expect(within(screen.getByRole('table', { name: 'Modules' })).getByRole('row', { name: /Mandats/ })).toBeTruthy();
    expect(table).toBeTruthy();

    await user.type(screen.getByRole('textbox', { name: 'Fonction' }), 'zzz');
    expect(await screen.findByText('Aucun résultat')).toBeTruthy();
  });

  it('affiche l’état vide quand aucune version n’est publiée', async () => {
    mount(() => json(200, { data: [] }));

    expect(await screen.findByText('Aucun module')).toBeTruthy();
  });

  it('affiche un loader pendant le chargement', () => {
    mount();

    expect(screen.getByRole('status', { name: /Chargement/ })).toBeTruthy();
  });

  it.each([
    [403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.'), 'Accès réservé'],
    [429, problem(429, 'too_many_requests', 'Trop de requêtes.'), 'Trop de requêtes'],
    [500, problem(500, 'server_error', 'Erreur interne.'), 'Les modules n’a pas pu être chargé'],
  ])('affiche l’erreur %i', async (status, body, title) => {
    mount(() => json(status, body, status === 429 ? { 'Retry-After': '8' } : {}));

    expect(await screen.findByText(title, {}, { timeout: 4000 })).toBeTruthy();
  });

  it('recharge par « Réessayer » après une panne', async () => {
    const user = userEvent.setup();
    let calls = 0;
    mount(() => {
      calls += 1;
      return calls <= 2 ? json(500, problem(500, 'server_error', 'Erreur interne.')) : json(200, plansResponse());
    });

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }, { timeout: 4000 }));

    expect(await screen.findByRole('table', { name: 'Modules' })).toBeTruthy();
  });
});
