import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { ownerFundsPaths } from './paths';
import { ownerFundsUrl, renderOwnerFunds } from './testing';
import { TrustPage } from './TrustPage';

const SLOW = { timeout: 4000 };
const coverageUrl = ownerFundsUrl('/trust/coverage');
const depositsUrl = ownerFundsUrl('/trust/deposits');
const withdrawalsUrl = ownerFundsUrl('/trust/withdrawals');
const confirmUrl = ownerFundsUrl(`/trust/deposits/${api.IDS.deposit}/confirm`);

const trustRoutes = (coverage = api.coverage, deposits = api.depositsPage) => ({
  [`GET ${coverageUrl}`]: { body: coverage },
  [`GET ${depositsUrl}`]: { body: deposits },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
});

afterEach(() => { vi.useRealTimers(); });

describe('fonds de tiers : cantonnement', () => {
  it('affiche la couverture calculée par le serveur', async () => {
    const { container } = renderOwnerFunds(<TrustPage />, trustRoutes());
    const region = await screen.findByRole('region', { name: 'Couverture du cantonnement' });
    await waitFor(() => { expect(within(region).getByText('Couvert')).toBeTruthy(); }, SLOW);
    const text = norm(region.textContent);
    expect(text).toContain('9 000 €');
    expect(text).toContain('7 600 €');
    expect(text).toContain('1 400 €');
    await expectNoA11yViolations(container);
  });

  it('un écart de cantonnement est signalé et bloque le prélèvement', async () => {
    renderOwnerFunds(<TrustPage />, trustRoutes(api.coverageGap));
    expect(await screen.findByText('Écart de cantonnement', { selector: 'strong' }, SLOW)).toBeTruthy();
    const withdraw = screen.getByRole('button', { name: 'Prélever les honoraires' });
    expect(withdraw.hasAttribute('disabled')).toBe(true);
  });

  it('un gestionnaire ne voit ni prélèvement ni apport', async () => {
    renderOwnerFunds(<TrustPage />, trustRoutes(), { role: 'manager' });
    await screen.findByRole('table', { name: 'Apports au compte de tiers' }, SLOW);
    expect(screen.queryByRole('button', { name: /Prélever|apport|Confirmer/i })).toBeNull();
    expect(screen.getAllByText(/réservés au propriétaire, à l’administrateur et au comptable/).length).toBeGreaterThan(0);
  });

  it('une organisation non agence n’accède pas aux fonds de tiers', async () => {
    renderOwnerFunds(<TrustPage />, {}, { kind: 'individual' });
    expect(await screen.findByText(/réservés aux organisations de type agence/)).toBeTruthy();
  });

  it('affiche l’erreur de chargement de la couverture', async () => {
    renderOwnerFunds(<TrustPage />, { ...trustRoutes(), [`GET ${coverageUrl}`]: { status: 500, body: { detail: 'panne' } } });
    expect(await screen.findByText(/couverture du cantonnement n’a pas pu être chargée|Une erreur est survenue|panne/i, {}, SLOW)).toBeTruthy();
  });
});

describe('fonds de tiers : prélèvement des honoraires', () => {
  it('envoie le montant saisi en unités mineures avec une clé d’idempotence', async () => {
    const { callsTo } = renderOwnerFunds(<TrustPage />, { ...trustRoutes(), [`POST ${withdrawalsUrl}`]: { status: 201, body: api.transferCreated } });
    await userEvent.click(await screen.findByRole('button', { name: 'Prélever les honoraires' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Montant/ }), '500');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Référence bancaire/ }), 'VIR-1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le prélèvement' }));

    await waitFor(() => { expect(callsTo('POST', withdrawalsUrl)).toHaveLength(1); });
    expect(callsTo('POST', withdrawalsUrl)[0]?.body).toEqual({ amount: 50000, executed_on: '2026-11-16', reference: 'VIR-1' });
    expect(callsTo('POST', withdrawalsUrl)[0]?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('refuse un montant nul avant tout appel', async () => {
    const { callsTo } = renderOwnerFunds(<TrustPage />, { ...trustRoutes(), [`POST ${withdrawalsUrl}`]: { status: 201, body: api.transferCreated } });
    await userEvent.click(await screen.findByRole('button', { name: 'Prélever les honoraires' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Montant/ }), '0');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le prélèvement' }));

    expect(await within(dialog).findByText(/montant strictement positif/)).toBeTruthy();
    expect(callsTo('POST', withdrawalsUrl)).toHaveLength(0);
  });

  it('affiche le refus du serveur quand le prélèvement dépasse l’excédent', async () => {
    renderOwnerFunds(<TrustPage />, { ...trustRoutes(), [`POST ${withdrawalsUrl}`]: { status: 409, body: api.problemExceedsSurplus } });
    await userEvent.click(await screen.findByRole('button', { name: 'Prélever les honoraires' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Montant/ }), '99999');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le prélèvement' }));
    expect(await within(dialog).findByText('Prélèvement non enregistré')).toBeTruthy();
    expect(within(dialog).getAllByText(/excédent/i).length).toBeGreaterThan(0);
  });

  it('sans double authentification, renvoie vers Connexion et sécurité', async () => {
    renderOwnerFunds(<TrustPage />, { ...trustRoutes(), [`POST ${withdrawalsUrl}`]: { status: 403, body: api.problemTwoFactor } });
    await userEvent.click(await screen.findByRole('button', { name: 'Prélever les honoraires' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Montant/ }), '10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le prélèvement' }));
    expect(await within(dialog).findByRole('link', { name: 'Ouvrir Connexion et sécurité' })).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Ouvrir Connexion et sécurité' }).getAttribute('href')).toBe(ownerFundsPaths.security);
  });
});

describe('fonds de tiers : apports', () => {
  it('liste les apports et leur contrôle', async () => {
    renderOwnerFunds(<TrustPage />, trustRoutes());
    const table = await screen.findByRole('table', { name: 'Apports au compte de tiers' }, SLOW);
    const rows = within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('1 600 €');
    expect(rows[0]).toContain('VIR-20261115-07');
    expect(rows[0]).toContain('Second approbateur requis');
    expect(rows[1]).toContain('confirmé sans second approbateur');
  });

  it('demande un apport avec une référence obligatoire', async () => {
    const { callsTo } = renderOwnerFunds(<TrustPage />, { ...trustRoutes(api.coverage, api.depositsEmpty), [`POST ${depositsUrl}`]: { status: 201, body: api.depositCreated } });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer un apport' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Montant/ }), '1600');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Demander l’apport' }));
    expect(await within(dialog).findByText(/La référence bancaire compte 3 à 64 caractères/)).toBeTruthy();
    expect(callsTo('POST', depositsUrl)).toHaveLength(0);

    await userEvent.type(within(dialog).getByRole('textbox', { name: /Référence bancaire/ }), 'VIR-20261115-07');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Demander l’apport' }));
    await waitFor(() => { expect(callsTo('POST', depositsUrl)).toHaveLength(1); });
    expect(callsTo('POST', depositsUrl)[0]?.body).toEqual({ amount: 160000, executed_on: '2026-11-16', reference: 'VIR-20261115-07' });
  });

  it('confirme un apport en attente', async () => {
    const { callsTo } = renderOwnerFunds(<TrustPage />, { ...trustRoutes(), [`POST ${confirmUrl}`]: { body: api.depositConfirmed } });
    await userEvent.click(await screen.findByRole('button', { name: /Confirmer l’apport de/ }, SLOW));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmer l’apport' }));

    await waitFor(() => { expect(callsTo('POST', confirmUrl)).toHaveLength(1); });
    expect(callsTo('POST', confirmUrl)[0]?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('n’autorise pas le demandeur à confirmer son propre apport quand le serveur refuse', async () => {
    renderOwnerFunds(<TrustPage />, { ...trustRoutes(), [`POST ${confirmUrl}`]: { status: 403, body: api.problemSecondApprover } });
    await userEvent.click(await screen.findByRole('button', { name: /Confirmer l’apport de/ }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmer l’apport' }));
    expect(await within(dialog).findByText('Apport non confirmé')).toBeTruthy();
  });

  it('un apport déjà confirmé n’offre plus de bouton', async () => {
    renderOwnerFunds(<TrustPage />, trustRoutes(api.coverage, { ...api.depositsPage, data: [api.deposit({ status: 'confirmed', confirmed_solo: true })] }));
    await screen.findByRole('table', { name: 'Apports au compte de tiers' }, SLOW);
    expect(screen.queryByRole('button', { name: /Confirmer l’apport de/ })).toBeNull();
  });

  it('affiche l’état vide', async () => {
    renderOwnerFunds(<TrustPage />, trustRoutes(api.coverage, api.depositsEmpty));
    expect(await screen.findByText('Aucun apport', {}, SLOW)).toBeTruthy();
  });
});
