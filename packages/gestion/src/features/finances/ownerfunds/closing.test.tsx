import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import type { MockRoute } from './api/testing';
import { CLOSING_REASON_MESSAGES, CLOSING_WARNING_MESSAGES } from './api/ownerFundsErrors';
import { ClosingPage } from './ClosingPage';
import { ownerFundsPaths } from './paths';
import { orgUrl, renderOwnerFunds } from './testing';

const SLOW = { timeout: 4000 };
const periodsUrl = orgUrl('/accounting/periods');
const closeUrl = orgUrl('/accounting/periods/close');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
});

afterEach(() => { vi.useRealTimers(); });

async function openClosing(routes: Record<string, MockRoute>, options: Parameters<typeof renderOwnerFunds>[2] = {}) {
  const view = renderOwnerFunds(<ClosingPage />, { [`GET ${periodsUrl}`]: { body: api.periods }, ...routes }, options);
  await screen.findByRole('table', { name: 'Mois clos' }, SLOW);
  return view;
}

describe('clôture mensuelle', () => {
  it('liste les mois clos et propose le mois suivant le dernier clos', async () => {
    const { container } = await openClosing({});
    const rows = within(screen.getByRole('table', { name: 'Mois clos' })).getAllByRole('row').slice(1).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('Octobre 2026');
    expect(rows[1]).toContain('Septembre 2026');
    expect(screen.getByLabelText<HTMLInputElement>('Mois à clôturer').value).toBe('2026-11');
    await expectNoA11yViolations(container);
  });

  it('sans mois clos, propose le mois précédent', async () => {
    renderOwnerFunds(<ClosingPage />, { [`GET ${periodsUrl}`]: { body: api.periodsEmpty } });
    expect(await screen.findByText('Aucun mois clos', {}, SLOW)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Mois à clôturer').value).toBe('2026-10');
  });

  it('clôture le mois choisi et affiche les avertissements du serveur', async () => {
    const { callsTo } = await openClosing({ [`POST ${closeUrl}`]: { status: 201, body: api.closedWithWarning } });
    await userEvent.click(screen.getByRole('button', { name: 'Clôturer ce mois' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clôturer le mois' }));

    await waitFor(() => { expect(callsTo('POST', closeUrl)).toHaveLength(1); });
    expect(callsTo('POST', closeUrl)[0]?.body).toEqual({ month: '2026-11' });
    expect(callsTo('POST', closeUrl)[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await screen.findByText(/est clos/)).toBeTruthy();
    expect(screen.getByText(CLOSING_WARNING_MESSAGES.pending_payouts_older_than_threshold ?? '')).toBeTruthy();
  });

  it('une clôture sans avertissement le dit', async () => {
    await openClosing({ [`POST ${closeUrl}`]: { status: 201, body: api.closed } });
    await userEvent.click(screen.getByRole('button', { name: 'Clôturer ce mois' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clôturer le mois' }));
    expect(await screen.findByText('Aucun avertissement.')).toBeTruthy();
  });

  it('traduit les motifs bloquants d’une clôture refusée', async () => {
    await openClosing({ [`POST ${closeUrl}`]: { status: 409, body: api.problemNotClosable } });
    await userEvent.click(screen.getByRole('button', { name: 'Clôturer ce mois' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clôturer le mois' }));
    expect(await within(dialog).findByText('Mois non clos')).toBeTruthy();
    expect(dialog.textContent).not.toMatch(/trust_funds_gap|payouts_in_transit_mismatch/);
    expect(dialog.textContent).toContain(CLOSING_REASON_MESSAGES.trust_funds_gap);
  });

  it('indique que le mois n’est pas terminé', async () => {
    await openClosing({ [`POST ${closeUrl}`]: { status: 409, body: api.problemNotClosableMonthNotOver } });
    await userEvent.click(screen.getByRole('button', { name: 'Clôturer ce mois' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clôturer le mois' }));
    expect(await within(dialog).findByText(/pas (encore )?terminé|n’est pas terminé/i)).toBeTruthy();
  });

  it('rappelle l’ordre des clôtures', async () => {
    await openClosing({ [`POST ${closeUrl}`]: { status: 409, body: api.problemPeriodOrder } });
    await userEvent.click(screen.getByRole('button', { name: 'Clôturer ce mois' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clôturer le mois' }));
    expect(await within(dialog).findByText(/ordre/i)).toBeTruthy();
  });

  it('sans double authentification, renvoie vers Connexion et sécurité', async () => {
    await openClosing({ [`POST ${closeUrl}`]: { status: 403, body: api.problemTwoFactor } });
    await userEvent.click(screen.getByRole('button', { name: 'Clôturer ce mois' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Clôturer le mois' }));
    expect((await within(dialog).findByRole('link', { name: 'Ouvrir Connexion et sécurité' })).getAttribute('href')).toBe(ownerFundsPaths.security);
  });

  it('désactive la clôture quand le mois saisi est invalide', async () => {
    await openClosing({});
    await userEvent.clear(screen.getByLabelText('Mois à clôturer'));
    expect(screen.getByRole('button', { name: 'Clôturer ce mois' }).hasAttribute('disabled')).toBe(true);
  });

  it('un gestionnaire ne peut pas clôturer', async () => {
    await openClosing({}, { role: 'manager' });
    expect(screen.queryByRole('button', { name: 'Clôturer ce mois' })).toBeNull();
    expect(screen.getByText(/La clôture d’un mois est réservée/)).toBeTruthy();
  });

  it('une organisation non agence n’accède pas à la clôture', async () => {
    renderOwnerFunds(<ClosingPage />, {}, { kind: 'individual' });
    expect(await screen.findByText(/réservés aux organisations de type agence/)).toBeTruthy();
  });

  it('affiche l’erreur de chargement des mois clos', async () => {
    renderOwnerFunds(<ClosingPage />, { [`GET ${periodsUrl}`]: { status: 500, body: { detail: 'panne' } } });
    expect(await screen.findByRole('alert', {}, SLOW)).toBeTruthy();
  });
});
