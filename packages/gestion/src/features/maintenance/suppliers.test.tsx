import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import * as api from './api/responses.fixtures';
import { SuppliersPage } from './SuppliersPage';
import { maintenanceUrl, renderMaintenance } from './testing';

const list = maintenanceUrl('/suppliers');

describe('prestataires', () => {
  it('liste les prestataires avec métiers, délai et statut', async () => {
    const preferred = { ...api.suppliersPage, data: [{ ...api.suppliersPage.data[0], preferred: true, payment_terms_days: 30, trade_term_ids: [api.IDS.electrical] }] };
    const { container } = renderMaintenance(<SuppliersPage />, { [`GET ${list}`]: { body: preferred } });
    const table = await screen.findByRole('table', { name: 'Prestataires' });
    expect(within(table).getByText(api.LABELS.supplier)).toBeTruthy();
    expect(within(table).getByText('Électricité')).toBeTruthy();
    expect(within(table).getByText('30 j')).toBeTruthy();
    expect(within(table).getByText('Actif')).toBeTruthy();
    expect(within(table).getByText('Préféré')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('crée un prestataire à partir d’un tiers', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<SuppliersPage />, { [`GET ${list}`]: { body: api.suppliersPage }, [`POST ${list}`]: { status: 201, body: api.supplierShow } });
    await user.click(await screen.findByRole('button', { name: 'Ajouter un prestataire' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter un prestataire' });
    await user.click(within(dialog).getByRole('combobox', { name: /^Société ou personne/ }));
    await user.click(await screen.findByRole('option', { name: api.LABELS.supplier }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Plomberie' }));
    await user.type(within(dialog).getByLabelText('Délai de règlement (jours)'), '45');
    await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => { expect(callsTo('POST', list)).toHaveLength(1); });
    expect(callsTo('POST', list)[0]?.body).toEqual({ trade_term_ids: [api.IDS.nature], preferred: false, payment_terms_days: 45, internal_note: null, party_id: api.IDS.supplierParty });
  });

  it('suspend un prestataire actif', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<SuppliersPage />, { [`GET ${list}`]: { body: api.suppliersPage }, [`POST ${list}/${api.IDS.supplier}/suspend`]: { body: api.supplierShow } });
    await user.click(await screen.findByRole('button', { name: `Actions pour ${api.LABELS.supplier}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Suspendre' }));
    await waitFor(() => { expect(callsTo('POST', `${list}/${api.IDS.supplier}/suspend`)).toHaveLength(1); });
  });

  it('masque toute écriture pour un comptable', async () => {
    renderMaintenance(<SuppliersPage />, { [`GET ${list}`]: { body: api.suppliersPage } }, { role: 'accountant' });
    await screen.findByRole('table', { name: 'Prestataires' });
    expect(screen.queryByRole('button', { name: 'Ajouter un prestataire' })).toBeNull();
    expect(screen.queryByRole('button', { name: `Actions pour ${api.LABELS.supplier}` })).toBeNull();
  });

  it('traduit un prestataire non assignable renvoyé par le serveur', async () => {
    const user = userEvent.setup();
    renderMaintenance(<SuppliersPage />, { [`GET ${list}`]: { body: api.suppliersPage }, [`POST ${list}/${api.IDS.supplier}/archive`]: { status: 409, body: api.problemBody(409, 'supplier_status_invalid', 'x') } });
    await user.click(await screen.findByRole('button', { name: `Actions pour ${api.LABELS.supplier}` }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    expect(await screen.findByText('L’état de ce prestataire ne permet pas cette action.')).toBeTruthy();
  });
});
