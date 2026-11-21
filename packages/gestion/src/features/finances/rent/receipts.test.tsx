import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { ReceiptDetailPage } from './ReceiptDetailPage';
import { ReceiptsPage } from './ReceiptsPage';
import { pageOf, renderRent, rentUrl } from './testing';

const receiptsPath = rentUrl('/receipts');
const receiptPath = rentUrl(`/receipts/${api.IDS.receipt}`);
const listRoutes = { [`GET ${receiptsPath}`]: { body: api.receiptsPage } };
const voided = { data: { ...api.receiptDetail.data, is_void: true, voided_at: '2026-11-17T09:30:00+00:00', void_reason: 'Paiement annulé : chèque rejeté' } };

let clicks: MockInstance<() => void>;
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() }));
  clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  clicks.mockRestore();
  vi.unstubAllGlobals();
});

describe('liste des quittances', () => {
  it('affiche numéro, locataire, lot, période, total et validité', async () => {
    const { container } = renderRent(<ReceiptsPage />, listRoutes);

    const table = await screen.findByRole('table', { name: 'Quittances de loyer' });
    const row = norm(within(table).getAllByRole('row')[1]?.textContent);
    expect(row).toContain('QT-2026-0001');
    expect(row).toContain('Danielle Martin');
    expect(row).toContain('LOT-48419, Résidence Didier');
    expect(row).toContain('Novembre 2026');
    expect(row).toContain('700 €');
    expect(row).toContain('16/11/2026');
    expect(row).toContain('Valable');
    expect(screen.getByRole('link', { name: 'QT-2026-0001' }).getAttribute('href')).toBe(`/finances/loyers/quittances/${api.IDS.receipt}`);
    await expectNoA11yViolations(container);
  });

  it('filtre par bail depuis l’adresse', async () => {
    const { callsTo } = renderRent(<ReceiptsPage />, listRoutes, { search: `bail=${api.IDS.lease}` });
    await screen.findByRole('table', { name: 'Quittances de loyer' });
    expect(callsTo('GET', receiptsPath)[0]?.search.get('lease')).toBe(api.IDS.lease);
  });

  it('affiche l’état vide', async () => {
    renderRent(<ReceiptsPage />, { [`GET ${receiptsPath}`]: { body: pageOf(api.receiptsPage, []) } });
    expect(await screen.findByText('Aucune quittance')).toBeTruthy();
  });

  it('signale l’erreur du serveur', async () => {
    renderRent(<ReceiptsPage />, { [`GET ${receiptsPath}`]: { status: 403, body: api.problemForbidden } });
    expect(await screen.findByText('Votre rôle ne permet pas cette action sur les loyers.')).toBeTruthy();
  });

  it('télécharge le PDF par le client authentifié', async () => {
    const { callsTo } = renderRent(<ReceiptsPage />, { ...listRoutes, [`GET ${receiptPath}/download`]: { pdf: api.PDF_BYTES } });
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger la quittance QT-2026-0001 (PDF)' }));

    await waitFor(() => { expect(callsTo('GET', `${receiptPath}/download`)).toHaveLength(1); });
    expect(callsTo('GET', `${receiptPath}/download`)[0]?.headers.get('Accept')).toBe('application/pdf');
    await waitFor(() => { expect(clicks).toHaveBeenCalledTimes(1); });
  });

  it('émet les quittances en attente après confirmation', async () => {
    const { callsTo } = renderRent(<ReceiptsPage />, { ...listRoutes, [`POST ${receiptsPath}/issue-pending`]: { body: api.batchIssued } });
    await screen.findByRole('table', { name: 'Quittances de loyer' });

    await userEvent.click(screen.getByRole('button', { name: 'Émettre les quittances en attente' }));
    expect(callsTo('POST', `${receiptsPath}/issue-pending`)).toHaveLength(0);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Émettre les quittances' }));

    await waitFor(() => { expect(callsTo('POST', `${receiptsPath}/issue-pending`)[0]?.body).toEqual({ limit: 100 }); });
    expect(await screen.findByText('Quittances en attente traitées')).toBeTruthy();
  });

  it('masque l’émission groupée au comptable', async () => {
    renderRent(<ReceiptsPage />, listRoutes, { role: 'accountant' });
    await screen.findByRole('table', { name: 'Quittances de loyer' });
    expect(screen.queryByRole('button', { name: 'Émettre les quittances en attente' })).toBeNull();
  });
});

describe('détail d’une quittance', () => {
  it('affiche les montants, l’instantané et le lien vers l’échéance', async () => {
    const { container } = renderRent(<ReceiptDetailPage id={api.IDS.receipt} />, { [`GET ${receiptPath}`]: { body: api.receiptDetail } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Quittance QT-2026-0001' })).toBeTruthy();
    const lines = within(screen.getByRole('table', { name: 'Lignes de la quittance' }));
    expect(lines.getAllByRole('row').map((row) => norm(row.textContent)).slice(1)).toEqual(['Loyer de novembre 2026650 €', 'Provision sur charges de novembre 202650 €']);
    const payments = within(screen.getByRole('table', { name: 'Paiements pris en compte' }));
    expect(payments.getAllByRole('row').map((row) => norm(row.textContent)).slice(1)).toEqual(['16/11/2026Virement300 €', '16/11/2026Virement400 €']);
    expect(screen.getByText('Agence du Port')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir l’échéance' }).getAttribute('href')).toBe(`/finances/loyers/${api.IDS.installment}`);
    expect(screen.getByText('Valable')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('signale une quittance nulle avec son motif', async () => {
    renderRent(<ReceiptDetailPage id={api.IDS.receipt} />, { [`GET ${receiptPath}`]: { body: voided } });
    expect(await screen.findByText('Quittance déclarée nulle')).toBeTruthy();
    expect(screen.getByText(/Paiement annulé : chèque rejeté \(le 17\/11\/2026\)/)).toBeTruthy();
    expect(screen.getByText('Nulle')).toBeTruthy();
  });

  it('signale une quittance introuvable', async () => {
    renderRent(<ReceiptDetailPage id={api.IDS.receipt} />, { [`GET ${receiptPath}`]: { status: 404, body: api.problemNotFound } });
    expect(await screen.findByText('Cette quittance n’existe pas')).toBeTruthy();
  });

  it('télécharge le PDF', async () => {
    const { callsTo } = renderRent(<ReceiptDetailPage id={api.IDS.receipt} />, { [`GET ${receiptPath}`]: { body: api.receiptDetail }, [`GET ${receiptPath}/download`]: { pdf: api.PDF_BYTES } });
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger le PDF' }));
    await waitFor(() => { expect(callsTo('GET', `${receiptPath}/download`)).toHaveLength(1); });
    await waitFor(() => { expect(clicks).toHaveBeenCalledTimes(1); });
  });
});
