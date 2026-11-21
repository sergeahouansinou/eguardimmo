import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { norm } from '../../../test/lots';
import * as api from './api/responses.fixtures';
import { StatementPage } from './StatementPage';
import { renderReporting, reportingUrl } from './testing';

const SLOW = { timeout: 4000 };
const path = `/mandants/${api.IDS.mandantA}/statement`;
const STATEMENT = `GET ${reportingUrl(path)}`;
const search = `mandant=${api.IDS.mandantA}&du=2026-10-01&au=2026-10-31`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('relevé d’un mandant', () => {
  it('sans mandant choisi, ne lit rien', async () => {
    const { callsTo } = renderReporting(<StatementPage />, {});
    expect(await screen.findByText('Choisissez un mandant et une période pour afficher le relevé.', undefined, SLOW)).toBeTruthy();
    expect(callsTo('GET', reportingUrl(path))).toHaveLength(0);
  });

  it('affiche les soldes et les mouvements du serveur, contrepassation comprise', async () => {
    const { container, callsTo } = renderReporting(<StatementPage />, { [STATEMENT]: { body: api.statement } }, { search });
    const table = await screen.findByRole('table', { name: 'Mouvements du compte du mandant' }, SLOW);
    const rows = within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('PAY-0001');
    expect(rows[0]).toContain('700 €');
    expect(rows[1]).toContain('Contrepassation');
    expect(rows[1]).toContain('641,20 €');
    expect(norm(container.textContent)).toContain('58,80 €');
    const call = callsTo('GET', reportingUrl(path))[0];
    expect([call?.search.get('from'), call?.search.get('to'), call?.search.get('format')]).toEqual(['2026-10-01', '2026-10-31', 'json']);
    await expectNoA11yViolations(container);
  });

  it('une période sans mouvement le dit', async () => {
    renderReporting(<StatementPage />, { [STATEMENT]: { body: { data: { ...api.statement.data, lines: [] } } } }, { search });
    expect(await screen.findByText('Aucun mouvement', undefined, SLOW)).toBeTruthy();
  });

  it('exporte le relevé en CSV pour la période affichée', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:csv');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const { callsTo } = renderReporting(<StatementPage />, {
      [STATEMENT]: (call) => (call.search.get('format') === 'csv' ? { csv: 'date;reference\n' } : { body: api.statement }),
    }, { search });
    const user = userEvent.setup();
    await screen.findByRole('table', { name: 'Mouvements du compte du mandant' }, SLOW);
    await user.click(screen.getByRole('button', { name: 'Exporter (CSV)' }));
    await waitFor(() => { expect(createObjectURL).toHaveBeenCalledTimes(1); }, SLOW);
    expect(callsTo('GET', reportingUrl(path)).some((call) => call.search.get('format') === 'csv')).toBe(true);
  });

  it('un relevé trop long est expliqué', async () => {
    renderReporting(<StatementPage />, { [STATEMENT]: { status: 422, body: api.problem('statement_too_long', 'x') } }, { search });
    expect(await screen.findByText('Le relevé dépasse le nombre de lignes autorisé : réduisez la période.', undefined, SLOW)).toBeTruthy();
  });

  it('un export refusé sans double authentification renvoie vers la sécurité du compte', async () => {
    renderReporting(<StatementPage />, {
      [STATEMENT]: (call) => (call.search.get('format') === 'csv' ? { status: 403, body: api.problem('two_factor_required', 'x') } : { body: api.statement }),
    }, { search });
    const user = userEvent.setup();
    await screen.findByRole('table', { name: 'Mouvements du compte du mandant' }, SLOW);
    await user.click(screen.getByRole('button', { name: 'Exporter (CSV)' }));
    expect(await screen.findByRole('link', { name: 'Ouvrir Connexion et sécurité' }, SLOW)).toBeTruthy();
  });

  it('une fin avant le début n’appelle pas le serveur', async () => {
    const { callsTo } = renderReporting(<StatementPage />, { [STATEMENT]: { body: api.statement } }, { search: `mandant=${api.IDS.mandantA}&du=2026-10-31&au=2026-10-01` });
    expect(await screen.findByText('La date de fin doit suivre la date de début.', undefined, SLOW)).toBeTruthy();
    expect(callsTo('GET', reportingUrl(path))).toHaveLength(0);
  });

  it('une organisation de type particulier ne lit rien', async () => {
    const { callsTo } = renderReporting(<StatementPage />, { [STATEMENT]: { body: api.statement } }, { kind: 'individual', search });
    expect(await screen.findByText('Comptes rendus indisponibles pour ce compte', undefined, SLOW)).toBeTruthy();
    expect(callsTo('GET', reportingUrl(path))).toHaveLength(0);
  });
});
