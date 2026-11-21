import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { norm } from '../../../test/lots';
import * as api from './api/responses.fixtures';
import { ReportsPage } from './ReportsPage';
import { renderReporting, reportingUrl } from './testing';

const SLOW = { timeout: 4000 };
const LIST = `GET ${reportingUrl('/management-reports')}`;

async function waitForTable() {
  const table = await screen.findByRole('table', { name: 'Comptes rendus de gestion' }, SLOW);
  await waitFor(() => { expect(within(table).getByText('SCI Les Tilleuls')).toBeTruthy(); }, SLOW);
  return table;
}

describe('liste des comptes rendus', () => {
  it('affiche chaque état avec les montants du serveur et les tirets d’un brouillon', async () => {
    const { container } = renderReporting(<ReportsPage />, { [LIST]: { body: api.reportsPage } });
    const table = await waitForTable();
    const rows = within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));
    expect(rows[0]).toContain('Brouillon');
    expect(rows[0]).toContain('Brouillon————Reprendre');
    expect(rows[1]).toContain('Awa Diallo');
    expect(rows[1]).toContain('700 €');
    expect(rows[1]).toContain('58,80 €');
    expect(rows[1]).toContain('641,20 €');
    expect(rows[2]).toContain('CR-2026-0001');
    expect(rows[2]).toContain('Publié le');
    await expectNoA11yViolations(container);
  });

  it('annonce les comptes rendus à générer avec un lien vers la génération pré-remplie', async () => {
    renderReporting(<ReportsPage />, { [LIST]: { body: api.reportsPage } });
    expect(await screen.findByText(/1 compte rendu à générer pour/, undefined, SLOW)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Générer maintenant' });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('/comptes-rendus/nouveau?');
    expect(href).toContain('du=2026-10-01');
    expect(href).toContain(`mandants=${api.IDS.mandantA}`);
  });

  it('une liste vide propose la génération', async () => {
    renderReporting(<ReportsPage />, { [LIST]: { body: api.reportsEmpty } });
    expect(await screen.findByText('Aucun compte rendu', undefined, SLOW)).toBeTruthy();
    expect(screen.queryByText(/à générer pour/)).toBeNull();
  });

  it('filtre par état côté serveur et pagine par curseur', async () => {
    const { callsTo } = renderReporting(<ReportsPage />, {
      [LIST]: (call) => ({ body: call.search.get('cursor') === 'curseur-2' ? api.reportsPageNext : api.reportsPageFirst }),
    });
    const user = userEvent.setup();
    await screen.findByRole('table', { name: 'Comptes rendus de gestion' }, SLOW);
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await waitFor(() => { expect(callsTo('GET', reportingUrl('/management-reports')).some((call) => call.search.get('cursor') === 'curseur-2')).toBe(true); }, SLOW);
    await waitFor(() => { expect(screen.getByText('CR-2026-0001')).toBeTruthy(); }, SLOW);
  });

  it('une panne est signalée', async () => {
    renderReporting(<ReportsPage />, { [LIST]: { status: 500, body: api.problem('server_error', 'x') } });
    expect(await screen.findByRole('alert', undefined, SLOW)).toBeTruthy();
  });

  it('une organisation de type particulier voit l’indisponibilité et ne lit rien', async () => {
    const { callsTo } = renderReporting(<ReportsPage />, { [LIST]: { body: api.reportsPage } }, { kind: 'individual' });
    expect(await screen.findByText('Comptes rendus indisponibles pour ce compte', undefined, SLOW)).toBeTruthy();
    expect(callsTo('GET', reportingUrl('/management-reports'))).toHaveLength(0);
  });
});
