import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { ActivityEntityHistory } from './ActivityEntityHistory';
import * as api from './api/fixtures';
import { activityUrl, problem, renderActivity, twice } from './testing';

const SLOW = { timeout: 4000 };
const list = `GET ${activityUrl()}`;
const subject = { subjectType: 'lease', subjectId: api.IDS.lease };

describe('historique d’une fiche', () => {
  it('liste l’historique de l’élément demandé et rien d’autre', async () => {
    const { container, calls } = renderActivity(<ActivityEntityHistory {...subject} />, { [list]: { body: api.page([api.row]) } });
    const entries = await screen.findByRole('list', { name: 'Historique des modifications' }, SLOW);

    expect(entries.textContent).toContain('Enregistrement d\'un paiement de loyer');
    expect(calls.find((call) => call.path === activityUrl())?.search.get('subject_type')).toBe('lease');
    expect(calls.find((call) => call.path === activityUrl())?.search.get('subject_id')).toBe(api.IDS.lease);
    await expectNoA11yViolations(container);
  });

  it('un gestionnaire voit l’historique sans détail', async () => {
    renderActivity(<ActivityEntityHistory {...subject} />, { [list]: { body: api.page([api.historyRow]) } }, { role: 'manager' });
    const entries = await screen.findByRole('list', { name: 'Historique des modifications' }, SLOW);
    expect(entries.textContent).toContain('Modification de bail');
    expect(screen.queryByRole('button', { name: /Détails/ })).toBeNull();
  });

  it('un propriétaire peut ouvrir le détail d’une ligne', async () => {
    renderActivity(<ActivityEntityHistory {...subject} />, { [list]: { body: api.page([api.row]) }, [`GET ${activityUrl(`/${api.IDS.entry}`)}`]: { body: { data: api.detail } } });
    await userEvent.click(await screen.findByRole('button', { name: /Détails/ }, SLOW));
    const dialog = await screen.findByRole('dialog', { name: 'Détail de l’entrée' });
    expect(await within(dialog).findByText('REQ-4242', {}, SLOW)).toBeTruthy();
  });

  it('un comptable ne voit rien et aucune requête n’est émise', async () => {
    const { container, calls } = renderActivity(<ActivityEntityHistory {...subject} />, {}, { role: 'accountant' });
    await waitFor(() => { expect(screen.queryByRole('status')).toBeNull(); }, SLOW);
    expect(container.textContent).toBe('');
    expect(calls).toHaveLength(0);
  });

  it('explique l’absence d’activité', async () => {
    renderActivity(<ActivityEntityHistory {...subject} />, { [list]: { body: api.page([]) } });
    expect(await screen.findByText('Aucune activité enregistrée pour cet élément.', {}, SLOW)).toBeTruthy();
  });

  it('affiche l’échec, propose Réessayer, puis la liste', async () => {
    renderActivity(<ActivityEntityHistory {...subject} />, { [list]: twice(problem(500, 'server_error'), { body: api.page([api.row]) }) });
    expect(await screen.findByText(/Impossible de charger le journal d’activité/, {}, SLOW)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('list', { name: 'Historique des modifications' }, SLOW)).toBeTruthy();
  });

  it('un 403 du serveur est annoncé comme un accès refusé', async () => {
    renderActivity(<ActivityEntityHistory {...subject} />, { [list]: problem(403, 'role_forbidden') });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
  });
});
