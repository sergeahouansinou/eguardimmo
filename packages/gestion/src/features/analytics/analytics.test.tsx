import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { saveBlob } from '../finances/rent/download';
import { AnalyticsHubPage } from './AnalyticsHubPage';
import { ForecastPage } from './ForecastPage';
import { OccupancyPage } from './OccupancyPage';
import { ForecastScreen, ProfitabilityScreen } from './index';
import { RevenueExpensesPage } from './RevenueExpensesPage';
import * as api from './api/fixtures';
import { problem, renderAnalytics, reportingUrl } from './testing';

vi.mock('../finances/rent/download', () => ({ saveBlob: vi.fn(), safeFilename: (name: string) => name }));

const SLOW = { timeout: 4000 };
const revenue = `GET ${reportingUrl('/finance/revenue-expenses')}`;
const occupancy = `GET ${reportingUrl('/finance/occupancy')}`;
const profitability = `GET ${reportingUrl('/finance/profitability')}`;
const forecast = `GET ${reportingUrl('/finance/forecast')}`;
const assumptions = `PUT ${reportingUrl('/finance/forecast/assumptions')}`;
const saveButton = () => screen.getByRole('button', { name: 'Enregistrer les hypothèses' });

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(saveBlob).mockClear();
});

describe('hub de l’analytique', () => {
  it('propose les quatre écrans à un bailleur autonome', () => {
    renderAnalytics(<AnalyticsHubPage />, {});
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/analytique/revenus-depenses', '/analytique/occupation', '/analytique/rentabilite', '/analytique/previsionnel']));
  });

  it('masque la rentabilité et le prévisionnel à une agence', () => {
    renderAnalytics(<AnalyticsHubPage />, {}, { kind: 'agency' });
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/analytique/revenus-depenses');
    expect(hrefs).not.toContain('/analytique/rentabilite');
    expect(hrefs).not.toContain('/analytique/previsionnel');
  });

  it('remplace la rentabilité par un message pour une agence, sans appel serveur', () => {
    const { calls } = renderAnalytics(<ProfitabilityScreen />, {}, { kind: 'agency' });
    expect(screen.getByText('Réservé aux bailleurs autonomes')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('remplace le prévisionnel par un message pour une agence, sans appel serveur', () => {
    const { calls } = renderAnalytics(<ForecastScreen />, {}, { kind: 'agency' });
    expect(screen.getByText('Réservé aux bailleurs autonomes')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});

describe('revenus et dépenses', () => {
  it('demande la période par défaut dans le fuseau de l’organisation et affiche totaux et tableaux', async () => {
    const { calls, container } = renderAnalytics(<RevenueExpensesPage />, { [revenue]: { body: api.revenueExpenses } });
    expect(await screen.findByText('Recettes et dépenses par mois', {}, SLOW)).toBeTruthy();
    const call = calls.find((entry) => entry.path.endsWith('/revenue-expenses'));
    expect(call?.search.get('from')).toBe('2025-12-01');
    expect(call?.search.get('to')).toBe('2026-11-30');
    const months = await screen.findByRole('region', { name: 'Revenus et dépenses par mois, défilement horizontal' });
    expect(within(months).getByRole('table').textContent).toMatch(/novembre 2026/);
    expect(screen.getByText('Sans lot')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('affiche l’état vide', async () => {
    renderAnalytics(<RevenueExpensesPage />, { [revenue]: { body: api.revenueExpensesEmpty } });
    expect(await screen.findByText('Aucune donnée sur la période', {}, SLOW)).toBeTruthy();
  });

  it('refuse une période de plus de 36 mois avant tout appel', async () => {
    const { calls } = renderAnalytics(<RevenueExpensesPage />, { [revenue]: { body: api.revenueExpenses } });
    await screen.findByText('Recettes et dépenses par mois', {}, SLOW);
    const before = calls.length;
    const from = screen.getByLabelText('Du mois');
    await userEvent.clear(from);
    await userEvent.type(from, '2020-01');
    await userEvent.click(screen.getByRole('button', { name: 'Afficher' }));
    expect(await screen.findByText('La période ne peut pas dépasser 36 mois.')).toBeTruthy();
    expect(calls).toHaveLength(before);
  });

  it('recharge avec la période choisie', async () => {
    const { calls } = renderAnalytics(<RevenueExpensesPage />, { [revenue]: { body: api.revenueExpenses } });
    await screen.findByText('Recettes et dépenses par mois', {}, SLOW);
    const from = screen.getByLabelText('Du mois');
    await userEvent.clear(from);
    await userEvent.type(from, '2026-01');
    await userEvent.click(screen.getByRole('button', { name: 'Afficher' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('from') === '2026-01-01')).toBe(true); }, SLOW);
  });

  it.each([
    [429, 'throttled'],
    [500, 'server_error'],
  ])('affiche l’erreur %i avec Réessayer', async (status, code) => {
    renderAnalytics(<RevenueExpensesPage />, { [revenue]: problem(status, code) });
    expect(await screen.findByText(/Impossible de charger les revenus et dépenses/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('affiche l’accès refusé 403', async () => {
    renderAnalytics(<RevenueExpensesPage />, { [revenue]: problem(403, 'forbidden') });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
  });

  it('exporte les prêts pour un bailleur autonome', async () => {
    const { callsTo } = renderAnalytics(<RevenueExpensesPage />, { [revenue]: { body: api.revenueExpenses }, [`GET ${reportingUrl('/exports/prets-immobiliers')}`]: { csv: 'a;b' } });
    await userEvent.click(await screen.findByRole('button', { name: /Exporter les prêts/ }, SLOW));
    await waitFor(() => { expect(saveBlob).toHaveBeenCalledTimes(1); }, SLOW);
    expect(callsTo('GET', reportingUrl('/exports/prets-immobiliers'))[0]?.search.get('to')).toBe('2026-11-30');
  });

  it('n’offre pas l’export des prêts à une agence', async () => {
    renderAnalytics(<RevenueExpensesPage />, { [revenue]: { body: api.revenueExpenses } }, { kind: 'agency' });
    await screen.findByText('Recettes et dépenses par mois', {}, SLOW);
    expect(screen.queryByRole('button', { name: /Exporter les prêts/ })).toBeNull();
  });

  it('n’offre pas l’export au rôle gestionnaire', async () => {
    renderAnalytics(<RevenueExpensesPage />, { [revenue]: { body: api.revenueExpenses } }, { role: 'manager' });
    await screen.findByText('Recettes et dépenses par mois', {}, SLOW);
    expect(screen.queryByRole('button', { name: /Exporter les prêts/ })).toBeNull();
  });

  it('affiche l’erreur 422 d’un export trop long', async () => {
    renderAnalytics(<RevenueExpensesPage />, { [revenue]: { body: api.revenueExpenses }, [`GET ${reportingUrl('/exports/prets-immobiliers')}`]: problem(422, 'validation_failed', 'La période dépasse 36 mois.') });
    await userEvent.click(await screen.findByRole('button', { name: /Exporter les prêts/ }, SLOW));
    expect(await screen.findByText('Export impossible', {}, SLOW)).toBeTruthy();
    expect(saveBlob).not.toHaveBeenCalled();
  });
});

describe('occupation', () => {
  it('affiche taux et état par lot avec un équivalent texte des symboles', async () => {
    const { container } = renderAnalytics(<OccupancyPage />, { [occupancy]: { body: api.occupancy } });
    expect(await screen.findByRole('heading', { name: 'Taux d’occupation' }, SLOW)).toBeTruthy();
    expect(screen.getByText('100,00 %')).toBeTruthy();
    expect(screen.getByText('Vacant, 0 jours sur 30')).toBeTruthy();
    expect(screen.getByText('Occupé, 31 jours sur 31')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('affiche l’état vide sans lot', async () => {
    renderAnalytics(<OccupancyPage />, { [occupancy]: { body: api.occupancyEmpty } });
    expect(await screen.findByText('Aucun lot', {}, SLOW)).toBeTruthy();
  });

  it('affiche l’erreur serveur', async () => {
    renderAnalytics(<OccupancyPage />, { [occupancy]: problem(500, 'server_error') });
    expect(await screen.findByText(/Impossible de charger l’occupation/, {}, SLOW)).toBeTruthy();
  });
});

describe('rentabilité par bien', () => {
  it('affiche les rendements fournis par le serveur et le coût manquant', async () => {
    const { container, calls } = renderAnalytics(<ProfitabilityScreen />, { [profitability]: { body: api.profitability } });
    expect(await screen.findByText('Année en cours', {}, SLOW)).toBeTruthy();
    expect(calls.find((call) => call.path.endsWith('/profitability'))?.search.get('year')).toBe('2026');
    expect(screen.getByText('4,80 %')).toBeTruthy();
    expect(screen.getByText('2,64 %')).toBeTruthy();
    expect(screen.getByText(/coût de revient manquant/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Renseigner le coût' }).getAttribute('href')).toBe('/finances/cout-de-revient');
    expect(screen.getByText(/ne sont rattachées à aucun bien/)).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('exporte la rentabilité de l’année', async () => {
    const { callsTo } = renderAnalytics(<ProfitabilityScreen />, { [profitability]: { body: api.profitability }, [`GET ${reportingUrl('/exports/rentabilite-par-bien')}`]: { csv: 'a;b' } });
    await userEvent.click(await screen.findByRole('button', { name: /Exporter la rentabilité/ }, SLOW));
    await waitFor(() => { expect(saveBlob).toHaveBeenCalledTimes(1); }, SLOW);
    expect(callsTo('GET', reportingUrl('/exports/rentabilite-par-bien'))[0]?.search.get('year')).toBe('2026');
  });

  it('affiche le 403 réservé aux bailleurs si le serveur le renvoie', async () => {
    renderAnalytics(<ProfitabilityScreen />, { [profitability]: problem(403, 'reporting_landlord_only') });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/réservé aux bailleurs autonomes/)).toBeTruthy();
  });
});

describe('prévisionnel de trésorerie', () => {
  const base = { [forecast]: { body: api.forecast }, [occupancy]: { body: api.occupancy } };
  const rateLabel = 'Indexation annuelle des loyers (%)';

  it('présente la projection comme telle, avec les avertissements du serveur', async () => {
    const { container } = renderAnalytics(<ForecastPage />, base);
    expect(await screen.findByText(api.forecast.data.notice, {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/2 baux dans une autre devise sont ignorés/)).toBeTruthy();
    expect(screen.getByText(/Banque au/)).toBeTruthy();
    expect(screen.getByText('maintenance')).toBeTruthy();
    expect((await screen.findByLabelText<HTMLInputElement>(rateLabel, {}, SLOW)).value).toBe('1,500');
    await expectNoA11yViolations(container);
  });

  it('enregistre les hypothèses avec lock_version et montants en unités mineures', async () => {
    const { callsTo } = renderAnalytics(<ForecastPage />, { ...base, [assumptions]: { body: api.assumptionsSaved } });
    const rate = await screen.findByLabelText(rateLabel, {}, SLOW);
    await userEvent.clear(rate);
    await userEvent.type(rate, '2');
    await userEvent.click(saveButton());
    await waitFor(() => { expect(callsTo('PUT', reportingUrl('/finance/forecast/assumptions'))).toHaveLength(1); }, SLOW);
    expect(callsTo('PUT', reportingUrl('/finance/forecast/assumptions'))[0]?.body).toMatchObject({ lock_version: 3, indexation_rate: '2', one_off_expenses: [{ month: '2027-03', label: 'Ravalement', amount: 300_000 }] });
  });

  it('refuse un taux supérieur à 10 % sans appeler le serveur', async () => {
    const { callsTo } = renderAnalytics(<ForecastPage />, base);
    const rate = await screen.findByLabelText(rateLabel, {}, SLOW);
    await userEvent.clear(rate);
    await userEvent.type(rate, '12');
    await userEvent.click(saveButton());
    expect(await screen.findByText(/de 0 à 10 %/)).toBeTruthy();
    expect(callsTo('PUT', reportingUrl('/finance/forecast/assumptions'))).toHaveLength(0);
  });

  it('409 forecast_assumptions_stale : message et rechargement des hypothèses', async () => {
    const { callsTo } = renderAnalytics(<ForecastPage />, { ...base, [assumptions]: problem(409, 'forecast_assumptions_stale') });
    await screen.findByLabelText(rateLabel, {}, SLOW);
    const before = callsTo('GET', reportingUrl('/finance/forecast')).length;
    await userEvent.click(saveButton());
    expect(await screen.findByText(/viennent d’être rechargées/, {}, SLOW)).toBeTruthy();
    await waitFor(() => { expect(callsTo('GET', reportingUrl('/finance/forecast')).length).toBeGreaterThan(before); }, SLOW);
  });

  it('422 : affiche le détail du serveur', async () => {
    renderAnalytics(<ForecastPage />, { ...base, [assumptions]: problem(422, 'validation_failed', 'Le taux d’indexation dépasse 10 %.') });
    await screen.findByLabelText(rateLabel, {}, SLOW);
    await userEvent.click(saveButton());
    expect(await screen.findByText(/dépasse 10 %/, {}, SLOW)).toBeTruthy();
  });

  it('403 à l’enregistrement : erreur affichée', async () => {
    renderAnalytics(<ForecastPage />, { ...base, [assumptions]: problem(403, 'forbidden') });
    await screen.findByLabelText(rateLabel, {}, SLOW);
    await userEvent.click(saveButton());
    expect(await screen.findByText('Hypothèses non enregistrées', {}, SLOW)).toBeTruthy();
  });

  it('lecture seule pour le gestionnaire : pas de formulaire', async () => {
    renderAnalytics(<ForecastPage />, base, { role: 'manager' });
    expect(await screen.findByText('Hypothèses en lecture seule', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer les hypothèses' })).toBeNull();
  });

  it('affiche l’erreur de chargement', async () => {
    renderAnalytics(<ForecastPage />, { ...base, [forecast]: problem(429, 'throttled') });
    expect(await screen.findByText(/Impossible de charger le prévisionnel/, {}, SLOW)).toBeTruthy();
  });
});
