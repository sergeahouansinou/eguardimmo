import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { json, renderPlatform } from '../../../test/platform';
import { problem } from '@/platform/fixtures';
import { plansResponse } from '@/platform/plans/planFixtures';
import { consolePath, withOperator } from '@/screens/abonnements/testSupport';
import { ModuleScreen } from './ModuleScreen';

function mount(feature: string, plans: () => Response = () => json(200, plansResponse())) {
  return renderPlatform(
    <ModuleScreen feature={feature} />,
    withOperator({ roles: ['admin'] }, (request) => (request.method === 'GET' && consolePath(request) === '/plans' ? plans() : undefined)),
  );
}

describe('écran d’un module (mode API)', () => {
  it('montre la fonction, sa couverture et la limite par plan publié, sans erreur d’accessibilité', async () => {
    const view = mount('leases');

    expect(await screen.findByRole('heading', { level: 1, name: 'Baux' })).toBeTruthy();
    expect(screen.getByText('Quota chiffré')).toBeTruthy();
    expect(screen.getByText('Réservée à certains plans')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Plans publiés du module' });
    expect(within(table).getByRole('row', { name: /Gold.*v2.*Incluse.*200/ })).toBeTruthy();
    expect(within(table).getByRole('row', { name: /Silver.*v1.*Non incluse/ })).toBeTruthy();
    expect(within(table).getByRole('link', { name: 'Gold' }).getAttribute('href')).toBe('/abonnements/plans/gold');
    expect(screen.getByRole('link', { name: 'Modules' }).getAttribute('href')).toBe('/modules');
    await expectNoA11yViolations(view.container);
  });

  it('signale une fonction incluse dans tous les plans publiés, sans colonne de limite', async () => {
    mount('rent');

    expect(await screen.findByRole('heading', { level: 1, name: 'Loyers' })).toBeTruthy();
    expect(screen.getByText('Incluse dans tous les plans publiés')).toBeTruthy();
    expect(screen.getByText('Fonction activable')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Limite' })).toBeNull();
  });

  it('présente un module inconnu avec un retour à la liste', async () => {
    mount('inconnu');

    expect(await screen.findByRole('heading', { name: 'Module introuvable' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour aux modules' }).getAttribute('href')).toBe('/modules');
  });

  it('présente un registre vide comme un module introuvable', async () => {
    mount('properties', () => json(200, { data: [] }));

    expect(await screen.findByRole('heading', { name: 'Module introuvable' })).toBeTruthy();
  });

  it('affiche le refus 403 et l’erreur serveur avec reprise', async () => {
    const forbidden = mount('properties', () => json(403, problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.')));
    expect(await screen.findByText('Accès réservé')).toBeTruthy();
    forbidden.unmount();

    const user = userEvent.setup();
    let calls = 0;
    mount('properties', () => {
      calls += 1;
      return calls <= 2 ? json(500, problem(500, 'server_error', 'Erreur interne.')) : json(200, plansResponse());
    });
    await user.click(await screen.findByRole('button', { name: 'Réessayer' }, { timeout: 4000 }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Lots' })).toBeTruthy();
  });
});
