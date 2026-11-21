import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { CasesPage } from './CasesPage';
import { recoveryPaths } from './paths';
import { LEASE_REFERENCE, recoveryUrl, renderRecovery } from './testing';

const casesPath = recoveryUrl('/cases');
const listRoutes = { [`GET ${casesPath}`]: { body: api.caseList } };
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);

describe('liste des dossiers de recouvrement', () => {
  it('affiche numéro, locataire, bail, créances, reste dû et statut', async () => {
    const { container } = renderRecovery(<CasesPage />, listRoutes);

    const table = await screen.findByRole('table', { name: 'Dossiers de recouvrement' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toEqual(['Dossier', 'Locataire', 'Bail', 'Ouvert le', 'Créances', 'Reste dû', 'Statut']);
    const row = norm(rowsOf(table)[0]?.textContent);
    expect(row).toContain('RC-2026-0001');
    expect(row).toContain('Célina Barre');
    expect(row).toContain(LEASE_REFERENCE);
    expect(row).toContain('16/11/2026');
    expect(row).toContain('1 150 €');
    expect(row).toContain('Ouvert');
    expect(within(table).getByRole('link', { name: 'RC-2026-0001' }).getAttribute('href')).toBe(recoveryPaths.case(api.IDS.case));
    await expectNoA11yViolations(container);
  });

  it('envoie le statut choisi au serveur', async () => {
    const { callsTo } = renderRecovery(<CasesPage />, listRoutes);
    await screen.findByRole('table', { name: 'Dossiers de recouvrement' });

    await userEvent.click(screen.getByRole('combobox', { name: /^Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Plan de paiement' }));

    await waitFor(() => { expect(callsTo('GET', casesPath).at(-1)?.search.get('status')).toBe('in_plan'); });
  });

  it('pagine avec le curseur du serveur', async () => {
    const withNext = { ...api.caseList, meta: { ...api.caseList.meta, next_cursor: 'curseur-2' } };
    const { callsTo } = renderRecovery(<CasesPage />, { [`GET ${casesPath}`]: (call) => ({ body: call.search.get('cursor') === null ? withNext : api.caseList }) });
    await screen.findByRole('table', { name: 'Dossiers de recouvrement' });

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => { expect(callsTo('GET', casesPath).at(-1)?.search.get('cursor')).toBe('curseur-2'); });
  });

  it('affiche l’état vide', async () => {
    renderRecovery(<CasesPage />, { [`GET ${casesPath}`]: { body: { ...api.caseList, data: [] } } });
    expect(await screen.findByText('Aucun dossier de recouvrement')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Dossiers de recouvrement' })).toBeNull();
  });

  it('signale l’erreur du serveur au lieu d’une liste vide', async () => {
    renderRecovery(<CasesPage />, { [`GET ${casesPath}`]: { status: 422, body: api.problemBadStatusFilter } });
    expect(await screen.findByText('Le statut choisi est invalide.')).toBeTruthy();
    expect(screen.queryByText('Aucun dossier de recouvrement')).toBeNull();
  });

  it('affiche le chargement avant la réponse', () => {
    renderRecovery(<CasesPage />, listRoutes);
    expect(screen.getByRole('status', { name: 'Chargement des dossiers' })).toBeTruthy();
  });
});
