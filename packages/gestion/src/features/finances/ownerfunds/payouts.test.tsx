import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { PayoutsPage } from './PayoutsPage';
import { ownerFundsPaths } from './paths';
import { orgUrl, ownerFundsUrl, payoutsRoutes, renderOwnerFunds } from './testing';

const previewPath = ownerFundsUrl('/payouts/preview');
const SLOW = { timeout: 4000 };
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);

describe('aperçu des reversements', () => {
  it('affiche les montants du serveur, le compte masqué et le motif d’exclusion', async () => {
    const { container } = renderOwnerFunds(<PayoutsPage />, payoutsRoutes());

    const table = await screen.findByRole('table', { name: 'Net à reverser par mandant' });
    await waitFor(() => { expect(within(table).getByRole('link', { name: 'Awa Diallo' })).toBeTruthy(); });
    const first = norm(rowsOf(table)[0]?.textContent);
    expect(first).toContain('1 200 €');
    expect(first).toContain('96 €');
    expect(first).toContain('1 068 €');
    expect(first).toContain('IBAN •••• 4321');
    expect(first).toContain('Reversible');
    const second = norm(rowsOf(table)[1]?.textContent);
    expect(second).toContain('SCI Les Tilleuls');
    expect(second).toContain('Aucun compte');
    expect(second).toContain('Aucun compte de paiement valide');
    expect(within(table).getByRole('link', { name: 'Awa Diallo' }).getAttribute('href')).toBe(ownerFundsPaths.mandant(api.IDS.mandantA));
    await expectNoA11yViolations(container);
  });

  it('ne montre jamais un IBAN complet', async () => {
    const { container } = renderOwnerFunds(<PayoutsPage />, payoutsRoutes());
    await screen.findByRole('table', { name: 'Net à reverser par mandant' });
    expect(container.textContent).not.toMatch(/FR76|[A-Z]{2}\d{2}[A-Z0-9]{10,}/);
  });

  it('présélectionne les mandants reversibles et prépare le lot avec leurs identifiants et une clé', async () => {
    const { callsTo, push } = renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`POST ${ownerFundsUrl('/batches')}`]: { status: 201, body: api.batchDraft } });
    const prepare = await screen.findByRole('button', { name: 'Préparer un lot (1 mandant)' });

    await userEvent.click(prepare);

    await waitFor(() => { expect(push).toHaveBeenCalledWith(ownerFundsPaths.batch(api.IDS.batchDraft)); });
    const call = callsTo('POST', ownerFundsUrl('/batches'))[0];
    expect(call?.body).toEqual({ mandant_ids: [api.IDS.mandantA] });
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-[0-9a-f-]{36}$/);
  });

  it('permet d’ajouter un mandant exclu au lot : le serveur reste juge', async () => {
    const { callsTo } = renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`POST ${ownerFundsUrl('/batches')}`]: { status: 201, body: api.batchDraft } });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Inclure SCI Les Tilleuls dans le lot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Préparer un lot (2 mandants)' }));

    await waitFor(() => { expect(callsTo('POST', ownerFundsUrl('/batches'))).toHaveLength(1); });
    expect((callsTo('POST', ownerFundsUrl('/batches'))[0]?.body as { mandant_ids: string[] }).mandant_ids).toEqual([api.IDS.mandantA, api.IDS.mandantB]);
  });

  it('affiche l’erreur du serveur et reste sur la page', async () => {
    const { push } = renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`POST ${ownerFundsUrl('/batches')}`]: { status: 409, body: api.problemNotValidatable } });
    await userEvent.click(await screen.findByRole('button', { name: 'Préparer un lot (1 mandant)' }));

    expect(await screen.findByText('Lot non préparé')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('signale un aperçu tronqué', async () => {
    renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`GET ${previewPath}`]: { body: api.previewTruncated } });
    expect(await screen.findByText('Aperçu limité')).toBeTruthy();
  });

  it('affiche l’état vide', async () => {
    renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`GET ${previewPath}`]: { body: { data: [], meta: { limit: 20, truncated: false } } } });
    expect(await screen.findByText('Aucun mandant à reverser')).toBeTruthy();
  });

  it('signale l’erreur de chargement au lieu d’une liste vide', async () => {
    renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`GET ${previewPath}`]: { status: 403, body: api.problemAgencyOnly } });
    expect(await screen.findByText(/réservés aux organisations de type agence/)).toBeTruthy();
    expect(screen.queryByText('Aucun mandant à reverser')).toBeNull();
  });

  it('affiche le chargement avant la réponse', () => {
    renderOwnerFunds(<PayoutsPage />, payoutsRoutes());
    expect(screen.getByRole('status', { name: 'Chargement de l’aperçu des reversements' })).toBeTruthy();
  });

  it('un gestionnaire prépare un lot comme les autres rôles', async () => {
    renderOwnerFunds(<PayoutsPage />, payoutsRoutes(), { role: 'manager' });
    await screen.findByRole('table', { name: 'Net à reverser par mandant' });
    expect(screen.getByRole('button', { name: 'Préparer un lot (1 mandant)' })).toBeTruthy();
  });

  it('une organisation autonome voit un message, sans appel réseau', () => {
    const { callsTo, calls } = renderOwnerFunds(<PayoutsPage />, payoutsRoutes(), { kind: 'individual', role: 'owner' });
    expect(screen.getByText('Fonds des mandants indisponibles pour ce compte')).toBeTruthy();
    expect(callsTo('GET', previewPath)).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe('lots', () => {
  it('liste les lots avec leur état et l’indication du second approbateur', async () => {
    renderOwnerFunds(<PayoutsPage />, payoutsRoutes());
    const table = await screen.findByRole('table', { name: 'Lots de reversement' });
    const rows = rowsOf(table).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('Brouillon');
    expect(rows[1]).toContain('RV-2026-0001');
    expect(rows[1]).toContain('Validé');
    expect(rows[1]).toContain('Second approbateur requis');
    expect(within(table).getByRole('link', { name: 'RV-2026-0001' }).getAttribute('href')).toBe(ownerFundsPaths.batch(api.IDS.batchValidated));
  });

  it('pagine avec le curseur du serveur', async () => {
    const batches = ownerFundsUrl('/batches');
    const { callsTo } = renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`GET ${batches}`]: (call) => ({ body: call.search.get('cursor') === null ? api.batchesPageNext : api.batchesPage }) });
    await screen.findByRole('table', { name: 'Lots de reversement' });
    await userEvent.click(await screen.findByRole('button', { name: 'Suivant' }));
    await waitFor(() => { expect(callsTo('GET', batches).at(-1)?.search.get('cursor')).toBe('curseur-2'); });
  });

  it('affiche l’état vide', async () => {
    renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`GET ${ownerFundsUrl('/batches')}`]: { body: api.batchesEmpty } });
    expect(await screen.findByText('Aucun lot')).toBeTruthy();
  });
});

describe('retenues', () => {
  it('liste les retenues actives avec leur motif', async () => {
    renderOwnerFunds(<PayoutsPage />, payoutsRoutes());
    const table = await screen.findByRole('table', { name: 'Retenues actives' });
    await waitFor(() => { expect(within(table).getByText('Awa Diallo')).toBeTruthy(); });
    const rows = rowsOf(table).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('Réserve');
    expect(rows[0]).toContain('200 €');
    expect(rows[0]).toContain('Réserve pour travaux');
    expect(rows[1]).toContain('Blocage total');
    expect(rows[1]).toContain('Tout le net');
  });

  it('lève une retenue avec une clé d’idempotence après confirmation', async () => {
    const release = ownerFundsUrl(`/holds/${api.IDS.hold}/release`);
    const { callsTo } = renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`POST ${release}`]: { body: api.holdReleased } });
    await userEvent.click(await screen.findByRole('button', { name: /Lever la retenue de Awa Diallo/ }, SLOW));
    await userEvent.click(await screen.findByRole('button', { name: 'Lever la retenue' }));

    await waitFor(() => { expect(callsTo('POST', release)).toHaveLength(1); });
    expect(callsTo('POST', release)[0]?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('un gestionnaire ne peut pas lever une retenue', async () => {
    renderOwnerFunds(<PayoutsPage />, payoutsRoutes(), { role: 'manager' });
    await screen.findByRole('table', { name: 'Retenues actives' });
    expect(screen.queryByRole('button', { name: /Lever/ })).toBeNull();
  });

  it('pose une retenue totale sur un mandant', async () => {
    const holds = ownerFundsUrl('/holds');
    const { callsTo } = renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`POST ${holds}`]: { status: 201, body: api.holdCreated } });
    await userEvent.click(await screen.findByRole('button', { name: /Retenue sur Awa Diallo/ }, SLOW));
    await userEvent.click(await screen.findByRole('button', { name: 'Poser la retenue' }));

    await waitFor(() => { expect(callsTo('POST', holds)).toHaveLength(1); });
    expect(callsTo('POST', holds)[0]?.body).toEqual({ mandant_party_id: api.IDS.mandantA, kind: 'full', reason: 'dispute' });
  });

  it('exige le montant d’une réserve avant tout appel', async () => {
    const holds = ownerFundsUrl('/holds');
    const { callsTo } = renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`POST ${holds}`]: { status: 201, body: api.holdCreated } });
    await userEvent.click(await screen.findByRole('button', { name: /Retenue sur Awa Diallo/ }, SLOW));
    await userEvent.click(await screen.findByRole('combobox', { name: /^Type de retenue/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Réserve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Poser la retenue' }));

    expect(await screen.findByText(/Indiquez le montant à réserver/)).toBeTruthy();
    expect(callsTo('POST', holds)).toHaveLength(0);
  });
});

describe('noms de mandants', () => {
  it('retombe sur « Mandant » quand le nom ne se charge pas, sans bloquer l’écran', async () => {
    renderOwnerFunds(<PayoutsPage />, { ...payoutsRoutes(), [`GET ${orgUrl(`/parties/${api.IDS.mandantA}`)}`]: { status: 404, body: api.problemMandantNotFound } });
    const table = await screen.findByRole('table', { name: 'Net à reverser par mandant' });
    expect(within(table).getAllByRole('link', { name: 'Mandant' }).length).toBeGreaterThan(0);
  });
});
