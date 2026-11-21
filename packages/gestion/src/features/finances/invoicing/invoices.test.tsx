import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { InvoicesPage } from './InvoicesPage';
import { invoicingUrl, renderInvoicing, rowAt } from './testing';

const listPath = invoicingUrl('/invoices');
const listRoutes = { [`GET ${listPath}`]: { body: api.invoicesPage } };

let clicks: MockInstance<() => void>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() }));
  clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  clicks.mockRestore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('liste des factures et avoirs', () => {
  it('affiche numéro, destinataire, dates, totaux, reste dû et statut', async () => {
    const { container } = renderInvoicing(<InvoicesPage />, listRoutes);

    const table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    await within(table).findAllByText('SCI Les Tilleuls');
    const [draft, overdue, partial, paid, credit] = [0, 1, 2, 3, 4].map((index) => norm(rowAt(table, index).textContent));
    expect(draft).toContain('Brouillon');
    expect(draft).toContain('0 €');
    expect(overdue).toContain('FA-2026-0001');
    expect(overdue).toContain('16/11/2026');
    expect(overdue).toContain('05/11/2026');
    expect(overdue).toContain('120 €');
    expect(overdue).toContain('En retard');
    expect(partial).toContain('70 €');
    expect(partial).toContain('Partiellement réglée');
    expect(paid).toContain('Réglée');
    expect(credit).toContain('AF-2026-0001');
    expect(credit).toContain('Avoir');
    expect(screen.getByRole('link', { name: 'FA-2026-0001' }).getAttribute('href')).toBe(`/finances/factures/${api.IDS.issued}`);
    await expectNoA11yViolations(container);
  });

  it('filtre par type, statut, année, destinataire, retard et numéro, côté serveur', async () => {
    const { callsTo } = renderInvoicing(<InvoicesPage />, listRoutes);
    await screen.findByRole('table', { name: 'Factures et avoirs' });

    await userEvent.click(screen.getByRole('combobox', { name: /^Type/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Avoirs' }));
    await userEvent.click(screen.getByRole('combobox', { name: /^Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Réglée' }));
    await userEvent.click(screen.getByRole('combobox', { name: /^Année/ }));
    await userEvent.click(await screen.findByRole('option', { name: '2026' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'En retard seulement' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un numéro' }), 'FA-2026');

    await waitFor(() => { expect(Object.fromEntries(callsTo('GET', listPath).at(-1)?.search ?? [])).toEqual({ per_page: '25', kind: 'credit_note', status: 'paid', year: '2026', overdue: '1', search: 'FA-2026' }); });
  });

  it('reprend le destinataire depuis l’adresse', async () => {
    const { callsTo } = renderInvoicing(<InvoicesPage />, listRoutes, { search: `destinataire=${api.IDS.party}` });
    await screen.findByRole('table', { name: 'Factures et avoirs' });
    expect(callsTo('GET', listPath)[0]?.search.get('party')).toBe(api.IDS.party);
    expect(screen.getByRole('link', { name: 'Nouvelle facture' }).getAttribute('href')).toBe(`/finances/factures/nouvelle?destinataire=${api.IDS.party}`);
  });

  it('pagine par curseur', async () => {
    const { callsTo } = renderInvoicing(<InvoicesPage />, { [`GET ${listPath}`]: (call) => ({ body: { ...api.invoicesPage, meta: { ...api.invoicesPage.meta, next_cursor: call.search.get('cursor') === null ? 'suite' : null } } }) });
    await screen.findByRole('table', { name: 'Factures et avoirs' });

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => { expect(callsTo('GET', listPath).at(-1)?.search.get('cursor')).toBe('suite'); });
  });

  it('affiche l’état vide, avec ou sans filtre', async () => {
    const empty = { [`GET ${listPath}`]: { body: { ...api.invoicesPage, data: [] } } };
    const first = renderInvoicing(<InvoicesPage />, empty);
    expect(await screen.findByText('Les factures et avoirs apparaissent ici dès qu’un brouillon est créé.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Créer une facture' })).toBeTruthy();
    first.unmount();

    renderInvoicing(<InvoicesPage />, empty, { search: `destinataire=${api.IDS.party}` });
    expect(await screen.findByText('Aucune facture ne correspond à ces filtres.')).toBeTruthy();
  });

  it.each([
    [403, api.problemForbidden, 'Votre rôle ne permet pas cette action sur la facturation.'],
    [429, api.problemThrottled, 'Trop de requêtes en peu de temps. Patientez quelques secondes puis réessayez.'],
    [403, api.problemAgencyOnly, 'La facturation est réservée aux organisations de type agence.'],
  ] as const)('traduit l’erreur %i du serveur', async (status, body, message) => {
    renderInvoicing(<InvoicesPage />, { [`GET ${listPath}`]: { status, body } });
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it('traduit un 503 avec le délai de reprise', async () => {
    renderInvoicing(<InvoicesPage />, { [`GET ${listPath}`]: { status: 503, body: api.problemPdfUnavailable, headers: { 'Retry-After': '30' } } });
    expect(await screen.findByText('Le service de génération des PDF est momentanément indisponible. Rien n’a été enregistré : réessayez dans 30 secondes.')).toBeTruthy();
  });

  it('télécharge le PDF d’une facture émise par le client authentifié', async () => {
    const { callsTo } = renderInvoicing(<InvoicesPage />, { ...listRoutes, [`GET ${listPath}/${api.IDS.issued}/pdf`]: { pdf: api.PDF_BYTES } });
    const table = await screen.findByRole('table', { name: 'Factures et avoirs' });

    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: 'Actions pour Facture FA-2026-0001' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Télécharger le PDF' }));

    await waitFor(() => { expect(callsTo('GET', `${listPath}/${api.IDS.issued}/pdf`)).toHaveLength(1); });
    await waitFor(() => { expect(clicks).toHaveBeenCalledTimes(1); });
  });

  it('propose l’avoir au comptable mais le masque au gestionnaire', async () => {
    const accountant = renderInvoicing(<InvoicesPage />, listRoutes);
    let table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: /^Actions pour/ }));
    expect(await screen.findByRole('menuitem', { name: 'Émettre un avoir' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Enregistrer un règlement' })).toBeTruthy();
    accountant.unmount();

    renderInvoicing(<InvoicesPage />, listRoutes, { role: 'manager' });
    table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: /^Actions pour/ }));
    expect(await screen.findByRole('menuitem', { name: 'Enregistrer un règlement' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Émettre un avoir' })).toBeNull();
  });

  it('propose émission et abandon d’un brouillon, jamais règlement ni avoir', async () => {
    renderInvoicing(<InvoicesPage />, listRoutes);
    const table = await screen.findByRole('table', { name: 'Factures et avoirs' });
    await userEvent.click(within(rowAt(table, 0)).getByRole('button', { name: /^Actions pour le brouillon/ }));
    const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
    expect(items).toEqual(['Modifier le brouillon', 'Émettre la facture', 'Abandonner le brouillon']);
  });

  it('explique que la facturation est réservée aux agences, sans appeler la liste', async () => {
    const { callsTo } = renderInvoicing(<InvoicesPage />, listRoutes, { kind: 'individual', role: 'owner' });
    expect(await screen.findByText('Facturation indisponible pour ce compte')).toBeTruthy();
    expect(screen.getByText('La facturation est réservée aux organisations de type agence.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(callsTo('GET', listPath)).toHaveLength(0);
    expect(callsTo('GET', invoicingUrl('/parties'))).toHaveLength(0);
  });
});
