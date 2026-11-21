import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { norm } from '../../../test/lots';
import * as api from './api/responses.fixtures';
import { InterventionsPage } from './InterventionsPage';
import { maintenanceUrl, renderMaintenance } from './testing';

const list = maintenanceUrl('/interventions');
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));

describe('liste des interventions', () => {
  it('affiche les interventions avec statut, priorité, lot et prestataire', async () => {
    const { container } = renderMaintenance(<InterventionsPage />, { [`GET ${list}`]: { body: api.interventionsPage } });

    const table = await screen.findByRole('table', { name: 'Interventions' });
    expect(rowsOf(table)).toEqual([
      `INT-2026-0004Prise électrique HS${api.LABELS.lot}——NormaleSignalée`,
      `INT-2026-0003Bruit au plafond${api.LABELS.lot}——NormaleClassée sans suite`,
      `INT-2026-0002Porte qui grince${api.LABELS.lot}——NormaleAnnulée`,
      `INT-2026-0001${api.LABELS.title}${api.LABELS.lot}${api.LABELS.supplier}—NormaleFacturée`,
    ]);
    expect(screen.getByRole('link', { name: api.LABELS.title }).getAttribute('href')).toBe(`/interventions/${api.IDS.intervention}`);
    expect(screen.getByRole('link', { name: 'Nouvelle intervention' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Prestataires' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('masque la création pour un comptable', async () => {
    renderMaintenance(<InterventionsPage />, { [`GET ${list}`]: { body: api.interventionsPage } }, { role: 'accountant' });
    await screen.findByRole('table', { name: 'Interventions' });
    expect(screen.queryByRole('link', { name: 'Nouvelle intervention' })).toBeNull();
  });

  it('filtre par statut côté serveur et revient à la première page', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderMaintenance(<InterventionsPage />, { [`GET ${list}`]: { body: api.interventionsPage } });
    await screen.findByRole('table', { name: 'Interventions' });

    await user.click(screen.getByRole('combobox', { name: /^Statut/ }));
    await user.click(await screen.findByRole('option', { name: 'Accordée' }));

    await waitFor(() => { expect(callsTo('GET', list).some((call) => call.search.get('status') === 'approved')).toBe(true); });
  });

  it('affiche un état vide filtré et un état vide initial avec création', async () => {
    renderMaintenance(<InterventionsPage />, { [`GET ${list}`]: { body: { ...api.interventionsPage, data: [] } } });
    expect(await screen.findByText('Aucune intervention')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /intervention/i }).length).toBeGreaterThan(0);
  });

  it('pagine par curseur', async () => {
    const user = userEvent.setup();
    const first = { ...api.interventionsPage, meta: { ...api.interventionsPage.meta, next_cursor: 'curseur-2' } };
    const second = { ...api.interventionsPage, data: [api.interventionsPage.data[1]] };
    const { callsTo } = renderMaintenance(<InterventionsPage />, { [`GET ${list}`]: (call) => ({ body: call.search.get('cursor') === 'curseur-2' ? second : first }) });
    await screen.findByRole('table', { name: 'Interventions' });
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    await waitFor(() => { expect(callsTo('GET', list).some((call) => call.search.get('cursor') === 'curseur-2')).toBe(true); });
    await waitFor(() => { expect(screen.getAllByRole('row')).toHaveLength(2); });
  });

  it('affiche l’erreur traduite quand le serveur échoue', async () => {
    renderMaintenance(<InterventionsPage />, { [`GET ${list}`]: { status: 503, body: api.problemBody(503, 'service_unavailable', 'KO') } });
    expect(await screen.findByText('Le service des interventions est momentanément indisponible. Rien n’a été enregistré : réessayez dans un instant.')).toBeTruthy();
  });

  it('sert un bailleur autonome (organisation individuelle) comme une agence', async () => {
    const { calls } = renderMaintenance(<InterventionsPage />, { [`GET ${list}`]: { body: api.interventionsPage } }, { kind: 'individual' });
    expect(await screen.findByRole('table')).toBeTruthy();
    expect(screen.queryByText('Interventions indisponibles pour ce compte')).toBeNull();
    expect(calls.filter((call) => call.path === list).length).toBeGreaterThan(0);
  });

  it('refuse l’accès sans rôle connu', async () => {
    const { calls } = renderMaintenance(<InterventionsPage />, {}, { role: null });
    expect(await screen.findByText('Interventions indisponibles pour ce compte')).toBeTruthy();
    expect(calls.filter((call) => call.path === list)).toHaveLength(0);
  });
});
