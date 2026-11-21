import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { NoticesPage } from './NoticesPage';
import { installmentRows, installmentsPage, leaseReference, pageOf, renderRent, rentUrl, rowAt } from './testing';

const listRoutes = { [`GET ${rentUrl('/installments')}`]: { body: installmentsPage() } };
const rowMenu = async (row: HTMLElement) => { await userEvent.click(within(row).getByRole('button', { name: /^Actions pour l’avis/ })); };
const MONTH = { search: 'mois=2026-11' };

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('page des avis d’échéance', () => {
  it('liste les échéances du mois demandé avec l’état de leur avis', async () => {
    const { container, callsTo } = renderRent(<NoticesPage />, listRoutes, MONTH);

    const table = await screen.findByRole('table', { name: 'Avis d’échéance' });
    expect(Object.fromEntries(callsTo('GET', rentUrl('/installments'))[0]?.search ?? [])).toEqual({ per_page: '25', due_from: '2026-11-01', due_to: '2026-11-30' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toEqual(['Bail', 'Échéance', 'Montant charges comprises', 'État de l’avis', 'Actions']);
    const [upcoming, partial, paid] = installmentRows.map((_, index) => norm(rowAt(table, index).textContent));
    expect(upcoming).toContain(leaseReference);
    expect(upcoming).toContain('700 €');
    expect(upcoming).toContain('À émettre');
    expect(partial).toContain('Avis AV-2026-0001, émis le 16/11/2026');
    expect(partial).toContain('En retard');
    expect(paid).toContain('Avis AV-2026-0001');
    expect(document.body.textContent).not.toContain('Sophie Delmas');
    await expectNoA11yViolations(container);
  });

  it('change de mois côté serveur et revient à la première page', async () => {
    const { callsTo } = renderRent(<NoticesPage />, listRoutes, MONTH);
    await screen.findByRole('table', { name: 'Avis d’échéance' });

    await userEvent.click(screen.getByRole('combobox', { name: /^Mois d’échéance/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Décembre 2026' }));

    await waitFor(() => {
      expect(Object.fromEntries(callsTo('GET', rentUrl('/installments')).at(-1)?.search ?? [])).toEqual({ per_page: '25', due_from: '2026-12-01', due_to: '2026-12-31' });
    });
  });

  it('pagine avec le curseur du serveur', async () => {
    const { callsTo } = renderRent(<NoticesPage />, {
      [`GET ${rentUrl('/installments')}`]: (call) => (call.search.get('cursor') === null ? { body: installmentsPage('curseur-2') } : { body: pageOf(api.upcomingPage, [installmentRows[2]]) }),
    }, MONTH);
    await screen.findByRole('table', { name: 'Avis d’échéance' });

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => { expect(callsTo('GET', rentUrl('/installments')).at(-1)?.search.get('cursor')).toBe('curseur-2'); });
  });

  it('émet l’avis d’une échéance à venir après confirmation', async () => {
    const path = rentUrl(`/installments/${api.IDS.janInstallment}/issue`);
    const { callsTo } = renderRent(<NoticesPage />, { ...listRoutes, [`POST ${path}`]: { body: { data: { ...api.issuedDetail.data, id: api.IDS.janInstallment } } } }, MONTH);
    const table = await screen.findByRole('table', { name: 'Avis d’échéance' });

    await rowMenu(rowAt(table, 0));
    expect(screen.queryByRole('menuitem', { name: 'Annuler l’échéance' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Enregistrer un paiement' })).toBeNull();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Émettre l’avis d’échéance' }));
    expect(callsTo('POST', path)).toHaveLength(0);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Émettre l’avis' }));

    await waitFor(() => { expect(callsTo('POST', path)).toHaveLength(1); });
    expect(await screen.findByText('Avis d’échéance émis')).toBeTruthy();
  });

  it('télécharge le PDF d’un avis émis', async () => {
    const path = rentUrl(`/installments/${api.IDS.installment}/notice/download`);
    const { callsTo } = renderRent(<NoticesPage />, { ...listRoutes, [`GET ${path}`]: { pdf: api.PDF_BYTES } }, MONTH);
    const table = await screen.findByRole('table', { name: 'Avis d’échéance' });

    await rowMenu(rowAt(table, 1));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Télécharger l’avis (PDF)' }));

    await waitFor(() => { expect(callsTo('GET', path)).toHaveLength(1); });
    expect(callsTo('GET', path)[0]?.headers.get('Accept')).toBe('application/pdf');
  });

  it('signale l’indisponibilité du service PDF', async () => {
    const path = rentUrl(`/installments/${api.IDS.installment}/notice/download`);
    renderRent(<NoticesPage />, { ...listRoutes, [`GET ${path}`]: { status: 503, body: api.problemPdfUnavailable, headers: { 'Retry-After': '30' } } }, MONTH);
    const table = await screen.findByRole('table', { name: 'Avis d’échéance' });

    await rowMenu(rowAt(table, 1));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Télécharger l’avis (PDF)' }));

    expect(await screen.findByText('Téléchargement impossible')).toBeTruthy();
    expect(screen.getByText(/Le service de génération des PDF est momentanément indisponible/)).toBeTruthy();
  });

  it('émet les avis échus par lot et résume les échecs', async () => {
    const { callsTo } = renderRent(<NoticesPage />, { ...listRoutes, [`POST ${rentUrl('/installments/issue-due')}`]: { body: api.batchFailed } }, MONTH);
    await screen.findByRole('table', { name: 'Avis d’échéance' });

    await userEvent.click(screen.getByRole('button', { name: 'Émettre les avis échus' }));
    expect(callsTo('POST', rentUrl('/installments/issue-due'))).toHaveLength(0);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Émettre les avis' }));

    expect(await screen.findByText(/1 en échec/)).toBeTruthy();
  });

  it('ne propose au comptable ni émission ni lot, seulement le téléchargement', async () => {
    renderRent(<NoticesPage />, listRoutes, { role: 'accountant', ...MONTH });
    const table = await screen.findByRole('table', { name: 'Avis d’échéance' });

    expect(screen.queryByRole('button', { name: 'Émettre les avis échus' })).toBeNull();
    expect(within(rowAt(table, 0)).queryByRole('button', { name: /^Actions pour l’avis/ })).toBeNull();
    await rowMenu(rowAt(table, 1));
    expect(await screen.findByRole('menuitem', { name: 'Télécharger l’avis (PDF)' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Émettre l’avis d’échéance' })).toBeNull();
  });

  it('affiche l’état vide du mois', async () => {
    renderRent(<NoticesPage />, { [`GET ${rentUrl('/installments')}`]: { body: pageOf(api.upcomingPage, []) } }, MONTH);

    expect(await screen.findByText('Aucun avis')).toBeTruthy();
    expect(screen.getByText(/Aucune échéance n’est appelée pour novembre 2026/)).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Avis d’échéance' })).toBeNull();
  });

  it('signale l’erreur du serveur au lieu d’une liste vide', async () => {
    renderRent(<NoticesPage />, { [`GET ${rentUrl('/installments')}`]: { status: 403, body: api.problemForbidden } }, MONTH);

    expect(await screen.findByText('Votre rôle ne permet pas cette action sur les loyers.')).toBeTruthy();
    expect(screen.queryByText('Aucun avis')).toBeNull();
  });

  it('affiche le chargement avant la réponse', () => {
    renderRent(<NoticesPage />, listRoutes, MONTH);

    expect(screen.getByRole('status', { name: 'Chargement des avis d’échéance' })).toBeTruthy();
  });
});
