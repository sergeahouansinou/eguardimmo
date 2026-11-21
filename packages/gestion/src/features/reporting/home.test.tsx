import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { norm } from '../../../test/lots';
import { AgencyHomePage } from './AgencyHomePage';
import * as api from './api/responses.fixtures';
import { LandlordHomePage } from './LandlordHomePage';
import { homeRoutes, renderReporting, reportingUrl } from './testing';

const SLOW = { timeout: 4000 };

describe('accueil agence', () => {
  it('affiche les cartes avec les montants du serveur, sans calcul local', async () => {
    const { container, callsTo } = renderReporting(<AgencyHomePage />, homeRoutes());
    expect(await screen.findByText('Bonjour Marc', undefined, SLOW)).toBeTruthy();
    expect(await screen.findByText('Honoraires du mois', undefined, SLOW)).toBeTruthy();
    const text = await waitFor(() => {
      const body = norm(container.textContent);
      expect(body).toContain('49 €');
      expect(body).toContain('1 300 €');
      return body;
    }, SLOW);
    expect(text).toContain('sur 700 € appelés');
    expect(text).toContain('Mois clos en comptabilité');
    expect(text).toContain('2 mandants');
    expect(text).toContain('800 €');
    expect(text).toContain('Awa Diallo');
    expect(callsTo('GET', reportingUrl('/home/landlord'))).toHaveLength(0);
    await expectNoA11yViolations(container);
  });

  it('résout le nom d’un mandant que la carte ne nomme pas', async () => {
    renderReporting(<AgencyHomePage />, homeRoutes());
    const table = await screen.findByRole('table', { name: 'Principaux soldes à reverser' }, SLOW);
    await waitFor(() => { expect(within(table).getByText('SCI Les Tilleuls')).toBeTruthy(); }, SLOW);
  });

  it('classe les impayés par tranche et liste les alertes', async () => {
    renderReporting(<AgencyHomePage />, homeRoutes());
    const table = await screen.findByRole('table', { name: 'Impayés par ancienneté' }, SLOW);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(norm(rows[0]?.textContent)).toContain('500 €');
    expect(await screen.findByText('2 comptes rendus à générer', undefined, SLOW)).toBeTruthy();
    expect(screen.getByText('1 mandat à renouveler')).toBeTruthy();
    expect(screen.getByText('3 pièces de conformité à renouveler')).toBeTruthy();
  });

  it('propose la génération aux rôles de gestion et la masque à un organisation sans type agence', async () => {
    const first = renderReporting(<AgencyHomePage />, homeRoutes());
    expect(await screen.findByRole('link', { name: /Générer les comptes rendus/ }, SLOW)).toBeTruthy();
    first.unmount();
    renderReporting(<AgencyHomePage />, homeRoutes(), { kind: 'individual' });
    await screen.findByText('Bonjour Marc', undefined, SLOW);
    expect(screen.queryByRole('link', { name: /Générer les comptes rendus/ })).toBeNull();
  });

  it('une carte en erreur n’empêche pas les autres de s’afficher', async () => {
    const routes = { ...homeRoutes(), [`GET ${reportingUrl('/home/agency-kpis')}`]: { status: 500, body: api.problem('server_error', 'x') } };
    const { container } = renderReporting(<AgencyHomePage />, routes);
    expect(await screen.findByText('Les loyers du mois n’ont pas pu être chargés', undefined, SLOW)).toBeTruthy();
    expect(await screen.findByText('Reversements en attente', undefined, SLOW)).toBeTruthy();
    await screen.findByRole('table', { name: 'Impayés par ancienneté' }, SLOW);
    await expectNoA11yViolations(container);
  });

  it('une organisation de type particulier reçoit le refus du serveur sur les cartes d’agence', async () => {
    const refusal = { status: 403, body: api.problem('reporting_agency_only', 'x') };
    renderReporting(<AgencyHomePage />, {
      ...homeRoutes(),
      [`GET ${reportingUrl('/home/agency-kpis')}`]: refusal,
      [`GET ${reportingUrl('/home/agency-payouts')}`]: refusal,
      [`GET ${reportingUrl('/home/agency-alerts')}`]: refusal,
    }, { kind: 'individual' });
    expect((await screen.findAllByText(/réservés aux organisations de type agence/, undefined, SLOW)).length).toBeGreaterThan(0);
  });
});

describe('valeurs financières', () => {
  it('ne reste pas en cache au-delà de la requête : un nouvel affichage relit le serveur', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const first = renderReporting(<AgencyHomePage />, homeRoutes(), { queryClient });
    await screen.findByRole('table', { name: 'Impayés par ancienneté' }, SLOW);
    expect(first.callsTo('GET', reportingUrl('/finance/aging'))).toHaveLength(1);
    first.unmount();
    await waitFor(() => { expect(queryClient.getQueryCache().findAll({ queryKey: ['gestion', 'reporting'] })).toHaveLength(0); }, SLOW);
    const second = renderReporting(<AgencyHomePage />, homeRoutes(), { queryClient });
    await screen.findByRole('table', { name: 'Impayés par ancienneté' }, SLOW);
    expect(second.callsTo('GET', reportingUrl('/finance/aging'))).toHaveLength(1);
  });
});

describe('accueil bailleur autonome', () => {
  it('affiche les faits du serveur : loyers, impayés, lots vacants, baux, suivi', async () => {
    const { container, callsTo } = renderReporting(<LandlordHomePage />, homeRoutes(), { kind: 'individual' });
    const text = await waitFor(() => {
      const body = norm(container.textContent);
      expect(body).toContain('Lots vacants');
      expect(body).toContain('Baux arrivant à échéance');
      expect(body).toContain('3 interventions ouvertes');
      return body;
    }, SLOW);
    expect(text).toContain('sur 700 € appelés');
    expect(text).toContain('4 pièces de conformité à renouveler');
    await screen.findByRole('table', { name: 'Impayés par ancienneté' }, SLOW);
    expect(callsTo('GET', reportingUrl('/home/agency-kpis'))).toHaveLength(0);
    await expectNoA11yViolations(container);
  });

  it('une panne de la carte bailleur est signalée sans masquer les impayés', async () => {
    const routes = { ...homeRoutes(), [`GET ${reportingUrl('/home/landlord')}`]: { status: 503, body: api.problem('x', 'x') } };
    renderReporting(<LandlordHomePage />, routes, { kind: 'individual' });
    expect(await screen.findByText('Les lots vacants n’ont pas pu être chargés', undefined, SLOW)).toBeTruthy();
    await screen.findByRole('table', { name: 'Impayés par ancienneté' }, SLOW);
  });
});
