import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { recoveryPaths } from './paths';
import { LEASE_REFERENCE, recoveryUrl, renderRecovery, unpaidRoutes } from './testing';
import { UnpaidPage } from './UnpaidPage';

const unpaidPath = recoveryUrl('/unpaid');
const openPath = recoveryUrl('/cases');
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
let consoleErrors: MockInstance;

beforeEach(() => {
  consoleErrors = vi.spyOn(console, 'error');
});
afterEach(() => {
  const invalidNesting = consoleErrors.mock.calls.flat().map(String).filter((message) => /cannot be a descendant|cannot contain a nested/.test(message));
  consoleErrors.mockRestore();
  expect(invalidNesting).toEqual([]);
});

const checkboxes = () => screen.queryAllByRole<HTMLInputElement>('checkbox');

describe('liste des impayés', () => {
  it('affiche ancienneté, total et reste dû lus du serveur', async () => {
    const { container } = renderRecovery(<UnpaidPage />, unpaidRoutes());

    const table = await screen.findByRole('table', { name: 'Créances impayées' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toEqual(['Sélection', 'Locataire', 'Bail', 'Créance', 'Échéance', 'Ancienneté', 'Total', 'Reste dû', 'Dossier']);
    const [partial, issued, recent] = rowsOf(table).map((row) => norm(row.textContent));
    expect(partial).toContain('Célina Barre');
    expect(partial).toContain(LEASE_REFERENCE);
    expect(partial).toContain('72 jours');
    expect(partial).toContain('700 €');
    expect(partial).toContain('450 €');
    expect(partial).toContain('Aucun');
    expect(issued).toContain('42 jours');
    expect(recent).toContain('11 jours');
    expect(document.body.textContent).not.toContain('Sophie Delmas');
    await expectNoA11yViolations(container);
  });

  it('affiche une facture échue avec son numéro, sa date d’émission et son reste dû, parmi les échéances', async () => {
    const { container } = renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body: api.unpaidWithInvoice } });

    const table = await screen.findByRole('table', { name: 'Créances impayées' });
    const rows = rowsOf(table).map((row) => norm(row.textContent));
    expect(rows).toHaveLength(4);
    expect(rows[3]).toContain('Facture FA-2026-0001');
    expect(rows[3]).toContain('émise le 01/10/2026');
    expect(rows[3]).toContain('15/10/2026');
    expect(rows[3]).toContain('32 jours');
    expect(rows[3]).toContain('120 €');
    expect(rows[3]).toContain('100 €');
    expect(rows[3]).toContain('Aucun');
    expect(rows[0]).not.toContain('Facture');
    await expectNoA11yViolations(container);
  });

  it('ouvre un dossier mêlant échéances et facture avec les deux listes d’identifiants', async () => {
    const { callsTo, push } = renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body: api.unpaidWithInvoice }, [`POST ${openPath}`]: { status: 201, body: api.openCaseWithInvoice } });
    await screen.findByRole('table', { name: 'Créances impayées' });

    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner l’échéance de Septembre 2026/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner la facture FA-2026-0001 de Célina Barre' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un dossier (2)' }));
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('2 créances, 550 € restant dû au grand livre');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir le dossier' }));

    await waitFor(() => { expect(callsTo('POST', openPath)).toHaveLength(1); });
    expect(callsTo('POST', openPath)[0]?.body).toEqual({
      lease_id: api.IDS.lease,
      debtor_party_id: api.IDS.party,
      installment_ids: [api.IDS.installments[0]],
      invoice_ids: [api.IDS.invoice],
    });
    await waitFor(() => { expect(push).toHaveBeenCalledWith(recoveryPaths.case(api.IDS.case)); });
  });

  it('ouvre un dossier de facture seule sans liste d’échéances', async () => {
    const { callsTo } = renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body: api.unpaidInvoiceOnly }, [`POST ${openPath}`]: { status: 201, body: api.openCaseWithInvoice } });
    await screen.findByRole('table', { name: 'Créances impayées' });

    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner la facture FA-2026-0001/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un dossier (1)' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ouvrir le dossier' }));

    await waitFor(() => { expect(callsTo('POST', openPath)).toHaveLength(1); });
    expect(callsTo('POST', openPath)[0]?.body).toEqual({ lease_id: api.IDS.lease, debtor_party_id: api.IDS.party, invoice_ids: [api.IDS.invoice] });
  });

  it('refuse une facture d’un autre locataire mêlée à une échéance, sans appeler le serveur', async () => {
    const other = { ...api.unpaidInvoiceOnly.data[0], party: { id: '01a1e981-cbef-7399-91eb-cb5d1d9d2c99', name: 'Paul Martin' } };
    const body = { ...api.unpaidAll, data: [api.unpaidAll.data[0], other] };
    const { callsTo } = renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body }, [`POST ${openPath}`]: { status: 201, body: api.openCase } });
    await screen.findByRole('table', { name: 'Créances impayées' });

    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner l’échéance de Septembre 2026/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner la facture FA-2026-0001/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un dossier (2)' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Sélection invalide')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Ouvrir le dossier' })).toBeNull();
    expect(callsTo('POST', openPath)).toHaveLength(0);
  });

  it('ne propose pas de case pour une facture déjà dans un dossier', async () => {
    const taken = { ...api.unpaidInvoiceOnly.data[0], case: { id: api.IDS.case, number: 'RC-2026-0001' } };
    renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body: { data: [taken], meta: { next_after: null } } } });
    const table = await screen.findByRole('table', { name: 'Créances impayées' });

    expect(checkboxes()).toHaveLength(0);
    expect(within(table).getByRole('link', { name: 'RC-2026-0001' }).getAttribute('href')).toBe(recoveryPaths.case(api.IDS.case));
  });

  it('ouvre un dossier avec exactement les créances cochées, après confirmation', async () => {
    const { callsTo, push } = renderRecovery(<UnpaidPage />, { ...unpaidRoutes(), [`POST ${openPath}`]: { status: 201, body: api.openCase } });
    await screen.findByRole('table', { name: 'Créances impayées' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Ouvrir un dossier' }).disabled).toBe(true);

    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner l’échéance de Septembre 2026/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner l’échéance de Octobre 2026/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un dossier (2)' }));

    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('2 créances, 1 150 € restant dû au grand livre');
    expect(callsTo('POST', openPath)).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ouvrir le dossier' }));

    await waitFor(() => { expect(callsTo('POST', openPath)).toHaveLength(1); });
    expect(callsTo('POST', openPath)[0]?.body).toEqual({
      lease_id: api.IDS.lease,
      debtor_party_id: api.IDS.party,
      installment_ids: [api.IDS.installments[0], api.IDS.installments[1]],
    });
    await waitFor(() => { expect(push).toHaveBeenCalledWith(recoveryPaths.case(api.IDS.case)); });
  });

  it('n’envoie pas la troisième créance quand elle n’est pas cochée', async () => {
    const { callsTo } = renderRecovery(<UnpaidPage />, { ...unpaidRoutes(), [`POST ${openPath}`]: { status: 201, body: api.openCase } });
    await screen.findByRole('table', { name: 'Créances impayées' });

    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner l’échéance de Novembre 2026/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un dossier (1)' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ouvrir le dossier' }));

    await waitFor(() => { expect(callsTo('POST', openPath)).toHaveLength(1); });
    expect((callsTo('POST', openPath)[0]?.body as { installment_ids: string[] }).installment_ids).toEqual([api.IDS.installments[2]]);
  });

  it('refuse une sélection qui mélange deux locataires sans appeler le serveur', async () => {
    const other = { ...api.unpaidAll.data[1], party: { id: '01a1e981-cbef-7399-91eb-cb5d1d9d2c99', name: 'Paul Martin' } };
    const body = { ...api.unpaidAll, data: [api.unpaidAll.data[0], other] };
    const { callsTo } = renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body }, [`POST ${openPath}`]: { status: 201, body: api.openCase } });
    await screen.findByRole('table', { name: 'Créances impayées' });

    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner l’échéance de Septembre 2026/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner l’échéance de Octobre 2026/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un dossier (2)' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Sélection invalide')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Ouvrir le dossier' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Compris' }));
    expect(callsTo('POST', openPath)).toHaveLength(0);
    await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  });

  it('ne propose pas de case pour une créance déjà dans un dossier et renvoie vers lui', async () => {
    renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body: api.unpaidPage1 } });
    const table = await screen.findByRole('table', { name: 'Créances impayées' });

    expect(checkboxes()).toHaveLength(0);
    const link = within(table).getAllByRole('link', { name: 'RC-2026-0001' })[0];
    expect(link?.getAttribute('href')).toBe(recoveryPaths.case(api.IDS.case));
  });

  it('masque la sélection et l’ouverture pour le comptable, qui garde la lecture', async () => {
    renderRecovery(<UnpaidPage />, unpaidRoutes(), { role: 'accountant' });
    const table = await screen.findByRole('table', { name: 'Créances impayées' });

    expect(rowsOf(table)).toHaveLength(3);
    expect(checkboxes()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Ouvrir un dossier/ })).toBeNull();
  });

  it('affiche l’erreur du serveur sans fermer la liste quand l’ouverture échoue', async () => {
    renderRecovery(<UnpaidPage />, { ...unpaidRoutes(), [`POST ${openPath}`]: { status: 409, body: api.problemCaseExists } });
    await screen.findByRole('table', { name: 'Créances impayées' });
    await userEvent.click(screen.getByRole('checkbox', { name: /Sélectionner l’échéance de Septembre 2026/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un dossier (1)' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ouvrir le dossier' }));

    expect(await screen.findByText('Ouverture impossible')).toBeTruthy();
    expect(screen.getByText(/Un dossier est déjà ouvert pour ce bail et ce locataire/)).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Créances impayées' })).toBeTruthy();
  });

  it('pagine avec le curseur after du serveur', async () => {
    const { callsTo } = renderRecovery(<UnpaidPage />, {
      [`GET ${unpaidPath}`]: (call) => (call.search.get('after') === null ? { body: api.unpaidPage1 } : { body: api.unpaidPage2 }),
    });
    await screen.findByRole('table', { name: 'Créances impayées' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Précédent' }).disabled).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => { expect(callsTo('GET', unpaidPath).at(-1)?.search.get('after')).toBe(api.IDS.installments[1]); });
    await waitFor(() => { expect(rowsOf(screen.getByRole('table', { name: 'Créances impayées' }))).toHaveLength(1); });
  });

  it('filtre par bail côté serveur', async () => {
    const { callsTo } = renderRecovery(<UnpaidPage />, unpaidRoutes());
    await screen.findByRole('table', { name: 'Créances impayées' });

    await userEvent.click(screen.getByRole('combobox', { name: /^Bail/ }));
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(LEASE_REFERENCE) }));

    await waitFor(() => { expect(callsTo('GET', unpaidPath).at(-1)?.search.get('lease')).toBe(api.IDS.lease); });
  });

  it('affiche les montants en francs CFA sans décimale', async () => {
    const xof = (amount: number) => ({ amount, currency: 'XOF' });
    const data = api.unpaidAll.data.map((row) => ({ ...row, total: xof(450000), outstanding: xof(300000) }));
    renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body: { ...api.unpaidAll, data } } });
    const table = await screen.findByRole('table', { name: 'Créances impayées' });

    const text = norm(rowsOf(table)[0]?.textContent);
    expect(text).toContain('450');
    expect(text).toMatch(/450\s?000/);
    expect(text).toMatch(/300\s?000/);
    expect(text).not.toContain('4 500');
  });

  it('affiche l’état vide', async () => {
    renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { body: { data: [], meta: { next_after: null } } } });
    expect(await screen.findByText('Aucun impayé')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Créances impayées' })).toBeNull();
  });

  it('signale l’erreur du serveur au lieu d’une liste vide', async () => {
    renderRecovery(<UnpaidPage />, { [`GET ${unpaidPath}`]: { status: 403, body: api.problemForbidden } });
    expect(await screen.findByText('Votre rôle ne permet pas cette action sur le recouvrement.')).toBeTruthy();
    expect(screen.queryByText('Aucun impayé')).toBeNull();
  });

  it('affiche le chargement avant la réponse', () => {
    renderRecovery(<UnpaidPage />, unpaidRoutes());
    expect(screen.getByRole('status', { name: 'Chargement des impayés' })).toBeTruthy();
  });
});
