import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { FeesPage } from './FeesPage';
import { MandantAccountPage } from './MandantAccountPage';
import { ownerFundsPaths } from './paths';
import { ownerFundsUrl, renderOwnerFunds } from './testing';

const SLOW = { timeout: 4000 };
const feesUrl = ownerFundsUrl('/fees');
const accountUrl = ownerFundsUrl(`/mandants/${api.IDS.mandantA}/account`);
const holdsUrl = ownerFundsUrl('/holds');

const feesRoutes = (page: unknown = api.feesPage) => ({ [`GET ${feesUrl}`]: { body: page } });
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));

describe('honoraires', () => {
  it('affiche les relevés calculés par le serveur sans rien recalculer', async () => {
    const { container } = renderOwnerFunds(<FeesPage />, feesRoutes());
    const table = await screen.findByRole('table', { name: 'Honoraires de gestion' }, SLOW);
    await waitFor(() => { expect(within(table).getByRole('link', { name: 'Awa Diallo' })).toBeTruthy(); }, SLOW);
    const rows = rowsOf(table);
    expect(rows[0]).toContain('Octobre 2026');
    expect(rows[0]).toContain('1 200 €');
    expect(rows[0]).toContain('96 €');
    expect(rows[0]).toContain('19,20 €');
    expect(rows[0]).toContain('115,20 €');
    expect(rows[0]).toContain('8');
    expect(rows[1]).toContain('Minimum appliqué');
    expect(rows[1]).toContain('15 €');
    expect(rows[1]).toContain('Pas encore facturée');
    await expectNoA11yViolations(container);
  });

  it('renvoie vers la facture d’honoraires émise', async () => {
    renderOwnerFunds(<FeesPage />, feesRoutes());
    const link = await screen.findByRole('link', { name: /Facture d’honoraires de Awa Diallo/ }, SLOW);
    expect(link.getAttribute('href')).toBe(ownerFundsPaths.invoice(api.IDS.invoice));
  });

  it('filtre par mois côté serveur', async () => {
    const { callsTo } = renderOwnerFunds(<FeesPage />, feesRoutes());
    await screen.findByRole('table', { name: 'Honoraires de gestion' }, SLOW);
    const field = screen.getByLabelText('Mois');
    await userEvent.type(field, '2026-10');
    await waitFor(() => { expect(callsTo('GET', feesUrl).some((call) => call.search.get('month') === '2026-10')).toBe(true); });
  });

  it('affiche l’état vide', async () => {
    renderOwnerFunds(<FeesPage />, feesRoutes(api.feesEmpty));
    expect(await screen.findByText('Aucun honoraire calculé', {}, SLOW)).toBeTruthy();
  });

  it('affiche l’erreur de chargement', async () => {
    renderOwnerFunds(<FeesPage />, { [`GET ${feesUrl}`]: { status: 500, body: { detail: 'panne' } } });
    expect(await screen.findByRole('alert', {}, SLOW)).toBeTruthy();
  });

  it('une organisation non agence n’accède pas aux honoraires', async () => {
    renderOwnerFunds(<FeesPage />, {}, { kind: 'individual' });
    expect(await screen.findByText(/réservés aux organisations de type agence/)).toBeTruthy();
  });
});

describe('compte d’un mandant', () => {
  const accountRoutes = (account: unknown = api.account) => ({
    [`GET ${accountUrl}`]: { body: account },
    [`GET ${holdsUrl}`]: { body: api.holdsEmpty },
    [`GET ${feesUrl}`]: { body: api.feesPage },
  });

  it('affiche le dû, les virements en cours, les honoraires, le net et le IBAN masqué', async () => {
    const { container } = renderOwnerFunds(<MandantAccountPage id={api.IDS.mandantA} />, accountRoutes());
    const region = await screen.findByRole('region', { name: 'Compte du mandant' }, SLOW);
    const text = norm(region.textContent);
    expect(text).toContain('1 200 €');
    expect(text).toContain('450 €');
    expect(text).toContain('96 €');
    expect(text).toContain('36 €');
    expect(text).toContain('1 068 €');
    expect(text).toContain('IBAN •••• 4321');
    expect(container.textContent).not.toMatch(/FR76/);
    await waitFor(() => { expect(screen.getByRole('heading', { name: 'Compte de Awa Diallo' })).toBeTruthy(); }, SLOW);
    await expectNoA11yViolations(container);
  });

  it('un mandant non reversible affiche son motif', async () => {
    const blocked = { data: { ...api.evaluationB, mandant_party_id: api.IDS.mandantA } };
    renderOwnerFunds(<MandantAccountPage id={api.IDS.mandantA} />, accountRoutes(blocked));
    expect(await screen.findByText('Ce mandant n’est pas reversible', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Aucun compte valide')).toBeTruthy();
  });

  it('un blocage total est affiché', async () => {
    renderOwnerFunds(<MandantAccountPage id={api.IDS.mandantA} />, accountRoutes({ data: { ...api.evaluationA, full_hold: true, net_payable: api.eur(0) } }));
    expect((await screen.findAllByText('Blocage total', {}, SLOW)).length).toBeGreaterThan(0);
  });

  it('pose une retenue depuis le compte', async () => {
    const { callsTo } = renderOwnerFunds(<MandantAccountPage id={api.IDS.mandantA} />, { ...accountRoutes(), [`POST ${holdsUrl}`]: { status: 201, body: api.holdCreated } });
    await userEvent.click(await screen.findByRole('button', { name: 'Poser une retenue' }, SLOW));
    await userEvent.click(await screen.findByRole('button', { name: 'Poser la retenue' }));
    await waitFor(() => { expect(callsTo('POST', holdsUrl)).toHaveLength(1); });
    expect(callsTo('POST', holdsUrl)[0]?.body).toMatchObject({ mandant_party_id: api.IDS.mandantA });
  });

  it('un mandant inconnu est introuvable', async () => {
    renderOwnerFunds(<MandantAccountPage id={api.IDS.mandantA} />, { ...accountRoutes(), [`GET ${accountUrl}`]: { status: 404, body: api.problemMandantNotFound } });
    expect(await screen.findByText('Ce mandant n’existe pas dans votre organisation.', {}, SLOW)).toBeTruthy();
  });

  it('sans rôle connu, le compte du mandant reste fermé', async () => {
    renderOwnerFunds(<MandantAccountPage id={api.IDS.mandantA} />, {}, { role: null });
    expect(await screen.findByText(/réservés aux organisations de type agence/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Poser une retenue' })).toBeNull();
  });
});
