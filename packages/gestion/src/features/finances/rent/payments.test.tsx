import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { PaymentFormPage } from './PaymentFormPage';
import { PaymentsPage } from './PaymentsPage';
import { leaseReference, pageOf, renderRent, rentUrl, rowAt } from './testing';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const paymentsPath = rentUrl('/payments');
const balancePath = rentUrl(`/leases/${api.IDS.lease}/balance`);
const listRoutes = { [`GET ${paymentsPath}`]: { body: api.paymentsPage } };
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);

describe('liste des paiements', () => {
  it('affiche les paiements avec leur imputation et l’avance conservée', async () => {
    const { container } = renderRent(<PaymentsPage />, listRoutes);

    const table = await screen.findByRole('table', { name: 'Paiements de loyer' });
    const [advance, imputed] = rowsOf(table).map((row) => norm(row.textContent));
    expect(advance).toContain('Chèque');
    expect(advance).toContain('1 000 €');
    expect(advance).toContain('1 000 € en avance');
    expect(advance).toContain(leaseReference);
    expect(imputed).toContain('Virement');
    expect(imputed).toContain('400 € imputés');
    expect(imputed).toContain('Enregistré');
    await expectNoA11yViolations(container);
  });

  it('filtre par bail depuis l’adresse et par statut', async () => {
    const { callsTo } = renderRent(<PaymentsPage />, listRoutes, { search: `bail=${api.IDS.lease}` });
    await screen.findByRole('table', { name: 'Paiements de loyer' });
    expect(callsTo('GET', paymentsPath)[0]?.search.get('lease')).toBe(api.IDS.lease);

    await userEvent.click(screen.getByRole('combobox', { name: /^Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Annulé' }));

    await waitFor(() => { expect(callsTo('GET', paymentsPath).at(-1)?.search.get('status')).toBe('cancelled'); });
  });

  it('montre un paiement annulé avec son motif et sans action', async () => {
    renderRent(<PaymentsPage />, { [`GET ${paymentsPath}`]: { body: pageOf(api.paymentsPage, [api.paymentCancelled.data]) } });
    const table = await screen.findByRole('table', { name: 'Paiements de loyer' });
    const row = rowAt(table, 0);
    expect(norm(row.textContent)).toContain('Annulé : Chèque rejeté');
    expect(within(row).queryByRole('button', { name: /^Actions pour/ })).toBeNull();
  });

  it('annule un paiement avec un motif, après confirmation', async () => {
    const { callsTo } = renderRent(<PaymentsPage />, { ...listRoutes, [`POST ${paymentsPath}/${api.IDS.paymentFull}/cancel`]: { body: api.paymentCancelled } });
    const table = await screen.findByRole('table', { name: 'Paiements de loyer' });

    await userEvent.click(within(rowAt(table, 1)).getByRole('button', { name: /^Actions pour le paiement/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Annuler le paiement' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motif *' }), 'Chèque rejeté');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler le paiement' }));

    await waitFor(() => { expect(callsTo('POST', `${paymentsPath}/${api.IDS.paymentFull}/cancel`)[0]?.body).toEqual({ reason: 'Chèque rejeté' }); });
    expect(await screen.findByText('Paiement annulé')).toBeTruthy();
  });

  it('masque l’annulation au comptable', async () => {
    renderRent(<PaymentsPage />, listRoutes, { role: 'accountant' });
    const table = await screen.findByRole('table', { name: 'Paiements de loyer' });
    expect(within(table).queryByRole('button', { name: /^Actions pour/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Enregistrer un paiement' })).toBeTruthy();
  });

  it('signale l’erreur du serveur', async () => {
    renderRent(<PaymentsPage />, { [`GET ${paymentsPath}`]: { status: 403, body: api.problemForbidden } });
    expect(await screen.findByText('Votre rôle ne permet pas cette action sur les loyers.')).toBeTruthy();
  });
});

async function chooseLease() {
  await userEvent.click(screen.getByRole('combobox', { name: /^Bail/ }));
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(leaseReference) }));
  await screen.findByText('Situation du bail');
}

const formRoutes = { [`GET ${balancePath}`]: { body: api.balanceAdvance }, [`POST ${paymentsPath}`]: { status: 201, body: api.paymentPartial } };

describe('formulaire de paiement', () => {
  it('enregistre un paiement en unités mineures et revient à la liste des paiements du bail', async () => {
    const { callsTo, push, container } = renderRent(<PaymentFormPage />, formRoutes, { role: 'accountant' });
    await chooseLease();
    expect(norm(screen.getByText('Situation du bail').parentElement?.textContent)).toContain('Avance déjà détenue1 000 €');

    await userEvent.type(screen.getByRole('textbox', { name: /^Montant reçu \(€\)/ }), '300');
    await userEvent.type(screen.getByRole('textbox', { name: 'Référence' }), 'VIR-123');
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));

    await waitFor(() => { expect(callsTo('POST', paymentsPath)).toHaveLength(1); });
    expect(callsTo('POST', paymentsPath)[0]?.body).toMatchObject({ lease_id: api.IDS.lease, amount: 30000, method: 'transfer', reference: 'VIR-123', note: null });
    expect(callsTo('POST', paymentsPath)[0]?.body).not.toHaveProperty('currency');
    expect((callsTo('POST', paymentsPath)[0]?.body as { idempotency_key: string }).idempotency_key).toMatch(/^[A-Za-z0-9._:-]{8,120}$/);
    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/loyers/paiements?bail=${api.IDS.lease}`); });
  });

  it('préremplit le bail depuis l’adresse', async () => {
    renderRent(<PaymentFormPage />, formRoutes, { search: `bail=${api.IDS.lease}` });
    expect(await screen.findByText('Situation du bail')).toBeTruthy();
  });

  it('refuse les champs invalides sans appeler le serveur', async () => {
    const { callsTo } = renderRent(<PaymentFormPage />, formRoutes);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    expect(screen.getByText('Choisissez le bail concerné.')).toBeTruthy();
    expect(screen.getByText('Indiquez un montant strictement positif. Ex. 850 ou 850,50.')).toBeTruthy();

    await chooseLease();
    await userEvent.type(screen.getByRole('textbox', { name: /^Montant reçu/ }), '12,345');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));

    expect(screen.getByText('Indiquez un montant strictement positif. Ex. 850 ou 850,50.')).toBeTruthy();
    expect(callsTo('POST', paymentsPath)).toHaveLength(0);
  });

  it('refuse les centimes pour un bail en FCFA', async () => {
    const xof = { data: { ...api.balanceAdvance.data, balance: { amount: 0, currency: 'XOF' }, overdue: { amount: 0, currency: 'XOF' }, advance: { amount: 0, currency: 'XOF' } } };
    const { callsTo } = renderRent(<PaymentFormPage />, { ...formRoutes, [`GET ${balancePath}`]: { body: xof } });
    await chooseLease();
    await userEvent.type(screen.getByRole('textbox', { name: /^Montant reçu \(FCFA\)/ }), '1000,5');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));

    expect(screen.getByText('Indiquez un montant strictement positif. Ex. 450000.')).toBeTruthy();
    expect(callsTo('POST', paymentsPath)).toHaveLength(0);
  });

  it('affiche l’erreur du serveur et garde la saisie', async () => {
    renderRent(<PaymentFormPage />, { ...formRoutes, [`POST ${paymentsPath}`]: { status: 409, body: api.problemKeyReused } });
    await chooseLease();
    await userEvent.type(screen.getByRole('textbox', { name: /^Montant reçu/ }), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));

    expect(await screen.findByText('Paiement non enregistré')).toBeTruthy();
    expect(screen.getByText('Cet encaissement a déjà été saisi avec un contenu différent. Rechargez le formulaire pour en saisir un nouveau.')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: /^Montant reçu/ }).value).toBe('300');
  });

  it('place l’erreur de validation du serveur sous le champ concerné', async () => {
    renderRent(<PaymentFormPage />, { ...formRoutes, [`POST ${paymentsPath}`]: { status: 422, body: api.problemInvalidAmount } });
    await chooseLease();
    await userEvent.type(screen.getByRole('textbox', { name: /^Montant reçu/ }), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));

    await waitFor(() => { expect(screen.getAllByText('Le montant est invalide : indiquez un montant strictement positif.').length).toBeGreaterThan(0); });
  });

  it('rejoue la même clé pour une nouvelle tentative identique, et en change si la saisie change', async () => {
    let attempts = 0;
    const { callsTo } = renderRent(<PaymentFormPage />, {
      ...formRoutes,
      [`POST ${paymentsPath}`]: () => {
        attempts += 1;
        return attempts < 3 ? { status: 500, body: { detail: 'Erreur interne.' } } : { status: 201, body: api.paymentPartial };
      },
    });
    await chooseLease();
    await userEvent.type(screen.getByRole('textbox', { name: /^Montant reçu/ }), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    await screen.findByText('Paiement non enregistré');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    await waitFor(() => { expect(callsTo('POST', paymentsPath)).toHaveLength(2); });
    await userEvent.type(screen.getByRole('textbox', { name: /^Montant reçu/ }), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le paiement' }));
    await waitFor(() => { expect(callsTo('POST', paymentsPath)).toHaveLength(3); });

    const keys = callsTo('POST', paymentsPath).map((call) => (call.body as { idempotency_key: string }).idempotency_key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('bloque l’envoi tant que le solde du bail n’est pas connu', async () => {
    renderRent(<PaymentFormPage />, { ...formRoutes, [`GET ${balancePath}`]: { status: 404, body: api.problemNotFound } });
    await userEvent.click(screen.getByRole('combobox', { name: /^Bail/ }));
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(leaseReference) }));

    expect(await screen.findByText('Le solde du bail n’a pas pu être chargé')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Enregistrer le paiement' }).disabled).toBe(true);
  });
});
