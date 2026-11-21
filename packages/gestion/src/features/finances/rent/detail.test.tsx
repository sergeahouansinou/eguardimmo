import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { InstallmentDetailPage } from './InstallmentDetailPage';
import { renderRent, rentUrl } from './testing';

const installmentPath = rentUrl(`/installments/${api.IDS.installment}`);
const balancePath = rentUrl(`/leases/${api.IDS.lease}/balance`);
const baseRoutes = { [`GET ${installmentPath}`]: { body: api.paidDetail }, [`GET ${balancePath}`]: { body: api.balanceAdvance } };
const pendingReceipt = { data: { ...api.paidDetail.data, receipt: null, receipt_state: 'pending' } };

let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
let clicks: MockInstance<() => void>;

beforeEach(() => {
  createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:pdf');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
  clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  clicks.mockRestore();
  vi.unstubAllGlobals();
});

describe('détail d’une échéance', () => {
  it('affiche montants, lignes, documents et solde du bail', async () => {
    const { container } = renderRent(<InstallmentDetailPage id={api.IDS.installment} />, baseRoutes);

    expect(await screen.findByRole('heading', { level: 1, name: 'Échéance de Novembre 2026' })).toBeTruthy();
    const lines = within(screen.getByRole('table', { name: 'Lignes de l’échéance' }));
    expect(lines.getAllByRole('row').map((row) => norm(row.textContent))).toEqual([
      'LibelléPériodeJoursMontant mensuelMontantTVA',
      'Loyer de novembre 202601/11/2026 au 30/11/202630/30650 €650 €0 €',
      'Provision sur charges de novembre 202601/11/2026 au 30/11/202630/3050 €50 €0 €',
    ]);
    expect(norm(screen.getByText('Total appelé').closest('div')?.parentElement?.textContent)).toContain('700 €');
    expect(screen.getByText('AV-2026-0001, émis le 16/11/2026')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'QT-2026-0001, émise le 16/11/2026' }).getAttribute('href')).toBe(`/finances/loyers/quittances/${api.IDS.receipt}`);
    const balance = await screen.findByRole('region', { name: 'Solde du bail' });
    expect(await within(balance).findByText('Avance du locataire')).toBeTruthy();
    expect(norm(balance.textContent)).toContain('Solde au grand livre-1 000 €');
    expect(norm(balance.textContent)).toContain('Avance du locataire1 000 €');
    await expectNoA11yViolations(container);
  });

  it('signale une échéance introuvable', async () => {
    renderRent(<InstallmentDetailPage id={api.IDS.installment} />, { [`GET ${installmentPath}`]: { status: 404, body: api.problemNotFound } });
    expect(await screen.findByText('Cette échéance n’existe pas')).toBeTruthy();
  });

  it('signale une erreur de chargement avec le message traduit', async () => {
    renderRent(<InstallmentDetailPage id={api.IDS.installment} />, { [`GET ${installmentPath}`]: { status: 403, body: api.problemForbidden } });
    expect(await screen.findByText('Votre rôle ne permet pas cette action sur les loyers.')).toBeTruthy();
  });

  it('télécharge l’avis par le client authentifié', async () => {
    const { callsTo } = renderRent(<InstallmentDetailPage id={api.IDS.installment} />, { ...baseRoutes, [`GET ${installmentPath}/notice/download`]: { pdf: api.PDF_BYTES } });
    await screen.findByRole('heading', { level: 1, name: 'Échéance de Novembre 2026' });

    await userEvent.click(screen.getByRole('button', { name: 'Télécharger l’avis (PDF)' }));

    await waitFor(() => { expect(callsTo('GET', `${installmentPath}/notice/download`)).toHaveLength(1); });
    await waitFor(() => { expect(clicks).toHaveBeenCalledTimes(1); });
    expect(createObjectURL.mock.calls[0]?.[0].type).toBe('application/pdf');
  });

  it('annonce l’indisponibilité du service PDF sans rien télécharger', async () => {
    renderRent(<InstallmentDetailPage id={api.IDS.installment} />, { ...baseRoutes, [`GET ${installmentPath}/notice/download`]: { status: 503, body: api.problemPdfUnavailable, headers: { 'Retry-After': '30' } } });
    await screen.findByRole('heading', { level: 1, name: 'Échéance de Novembre 2026' });

    await userEvent.click(screen.getByRole('button', { name: 'Télécharger l’avis (PDF)' }));

    expect(await screen.findByText(/réessayez dans 30 secondes/)).toBeTruthy();
    expect(clicks).not.toHaveBeenCalled();
  });
});

describe('quittance en attente', () => {
  it('permet au gestionnaire de l’émettre', async () => {
    const { callsTo } = renderRent(<InstallmentDetailPage id={api.IDS.installment} />, { ...baseRoutes, [`GET ${installmentPath}`]: { body: pendingReceipt }, [`POST ${installmentPath}/receipt`]: { status: 201, body: api.receiptDetail } });
    expect(await screen.findByText('Quittance en attente d’émission')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Émettre la quittance' }));

    await waitFor(() => { expect(callsTo('POST', `${installmentPath}/receipt`)).toHaveLength(1); });
    expect(await screen.findByText('Quittance QT-2026-0001.')).toBeTruthy();
  });

  it('masque l’émission au comptable', async () => {
    renderRent(<InstallmentDetailPage id={api.IDS.installment} />, { ...baseRoutes, [`GET ${installmentPath}`]: { body: pendingReceipt } }, { role: 'accountant' });
    await screen.findByText('Quittance en attente d’émission');
    expect(screen.queryByRole('button', { name: 'Émettre la quittance' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler l’échéance' })).toBeNull();
  });
});

describe('échéance ouverte', () => {
  const issued = { data: api.issuedDetail.data };

  it('propose l’annulation au gestionnaire et le paiement au comptable', async () => {
    renderRent(<InstallmentDetailPage id={api.IDS.installment} />, { ...baseRoutes, [`GET ${installmentPath}`]: { body: issued } }, { role: 'manager' });
    expect(await screen.findByRole('button', { name: 'Annuler l’échéance' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Enregistrer un paiement' }).getAttribute('href')).toBe(`/finances/loyers/paiements/nouveau?bail=${api.IDS.lease}`);
  });

  it('ne laisse au comptable que le paiement', async () => {
    renderRent(<InstallmentDetailPage id={api.IDS.installment} />, { ...baseRoutes, [`GET ${installmentPath}`]: { body: issued } }, { role: 'accountant' });
    expect(await screen.findByRole('link', { name: 'Enregistrer un paiement' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Annuler l’échéance' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Émettre l’avis d’échéance' })).toBeNull();
  });

  it('affiche le motif d’une échéance annulée', async () => {
    renderRent(<InstallmentDetailPage id={api.IDS.janInstallment} />, { [`GET ${rentUrl(`/installments/${api.IDS.janInstallment}`)}`]: { body: api.cancelledDetail }, [`GET ${balancePath}`]: { body: api.balanceAdvance } });
    expect(await screen.findByText('Annulée le 10/01/2027 : Erreur de génération.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Enregistrer un paiement' })).toBeNull();
  });
});
