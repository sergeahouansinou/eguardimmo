import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import type { MockRoute } from './api/testing';
import { CaseDetailPage } from './CaseDetailPage';
import { caseRoutes, recoveryUrl, renderRecovery } from './testing';

const casePath = recoveryUrl(`/cases/${api.IDS.case}`);
const bundlePath = recoveryUrl(`/bundles/${api.IDS.bundle}`);
const unpaidPath = recoveryUrl('/unpaid');

const withRoutes = (extra: Record<string, MockRoute>, base: Record<string, MockRoute> = caseRoutes()): Record<string, MockRoute> => ({ ...base, ...extra });

describe('dossier avec factures', () => {
  it('affiche la facture du dossier avec son numéro, sa date d’émission et ses montants propres', async () => {
    const { container } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, caseRoutes(api.caseWithInvoice));

    const items = within(await screen.findByRole('table', { name: 'Créances du dossier' }));
    const rows = items.getAllByRole('row').slice(1).map((row) => norm(row.textContent));
    expect(rows).toHaveLength(3);
    expect(rows[2]).toContain('Facture FA-2026-0001');
    expect(rows[2]).toContain('émise le 01/10/2026');
    expect(rows[2]).toContain('15/10/2026');
    expect(rows[2]).toContain('120 €');
    expect(rows[2]).toContain('100 €');
    expect(rows[0]).toContain('Septembre 2026');
    await expectNoA11yViolations(container);
  });

  it('retire une facture du dossier par son identifiant de ligne, après confirmation', async () => {
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`DELETE ${casePath}/items/${api.IDS.invoiceLine}`]: { body: api.removeItem } }, caseRoutes(api.caseWithInvoice)));
    await screen.findByRole('table', { name: 'Créances du dossier' });

    await userEvent.click(screen.getByRole('button', { name: 'Retirer la facture FA-2026-0001' }));
    const dialog = await screen.findByRole('dialog');
    expect(norm(dialog.textContent)).toContain('La facture FA-2026-0001 sort du dossier');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retirer' }));

    await waitFor(() => { expect(callsTo('DELETE', `${casePath}/items/${api.IDS.invoiceLine}`)).toHaveLength(1); });
    expect(await screen.findByText('La facture FA-2026-0001 n’est plus dans le dossier.')).toBeTruthy();
  });

  it('ajoute une facture du même locataire avec invoice_ids', async () => {
    const body = { ...api.unpaidAll, data: [api.unpaidInvoiceOnly.data[0]] };
    const { callsTo } = renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`GET ${unpaidPath}`]: { body }, [`POST ${casePath}/items`]: { status: 200, body: api.addItemsInvoice } }));
    await screen.findByRole('table', { name: 'Créances du dossier' });

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter des créances' }));
    const dialog = await screen.findByRole('dialog');
    const list = await within(dialog).findByRole('list', { name: 'Créances disponibles' });
    await userEvent.click(within(list).getByRole('checkbox', { name: /Facture FA-2026-0001, reste dû 100\s€/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter au dossier' }));

    await waitFor(() => { expect(callsTo('POST', `${casePath}/items`)).toHaveLength(1); });
    expect(callsTo('POST', `${casePath}/items`)[0]?.body).toEqual({ invoice_ids: [api.IDS.invoice] });
    expect(await screen.findByText('Créances ajoutées')).toBeTruthy();
  });

  it('liste la facture parmi les pièces de l’envoi', async () => {
    renderRecovery(<CaseDetailPage id={api.IDS.case} />, withRoutes({ [`GET ${bundlePath}`]: { body: api.bundleWithInvoice } }));

    const bundle = await screen.findByRole('region', { name: 'Pièces du dossier' });
    const pieces = await within(bundle).findByRole('list', { name: 'Pièces de l’envoi EP-2026-0001' });
    expect(within(pieces).getAllByRole('listitem')).toHaveLength(6);
    expect(norm(pieces.textContent)).toContain('Facture FA-2026-0001');
    expect(norm(pieces.textContent)).toContain('facture-FA-2026-0001.pdf');
  });
});
