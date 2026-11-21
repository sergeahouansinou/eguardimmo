import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@eguardimmo/api';
import { expectNoA11yViolations } from '../../../../test/axe';
import { consolePageOf, fakeConsoleSource, renderConsoleSupport } from '../../../../test/console';
import { ORGANIZATION_ID, OTHER_OPERATOR_ID, SECOND_TICKET_ID, TICKET_ID, consoleTicketFixture } from '../testing';
import { ConsoleSupportBoardPage } from './BoardPage';

const unread = consoleTicketFixture({ id: TICKET_ID, subject: 'Quittance manquante', priority: 'high', first_response_overdue: true });
const read = consoleTicketFixture({ id: SECOND_TICKET_ID, subject: 'Facture en double', reference: 'SUP-2026-0002', status: 'waiting', organization_id: null, organization: null, assignee: { id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' }, support_last_read_at: '2026-11-19T10:00:00+00:00' });

afterEach(() => {
  vi.useRealTimers();
});

describe('tableau du support, côté équipe', () => {
  it('liste les demandes avec non-lu, retard de première réponse, assignation et comptes d’onglets', async () => {
    const source = fakeConsoleSource({ listTickets: () => Promise.resolve(consolePageOf([unread, read], { total: 2 })) });
    const { container } = renderConsoleSupport(<ConsoleSupportBoardPage />, { source });
    const list = await screen.findByRole('list', { name: 'Demandes de support' });
    const [first, second] = within(list).getAllByRole('listitem');
    if (first === undefined || second === undefined) throw new Error('deux lignes attendues');
        expect(within(first).getByText('Non lue,', { exact: false })).toBeTruthy();
    expect(within(first).getByText('Première réponse en retard')).toBeTruthy();
    expect(within(first).getByText('Priorité haute')).toBeTruthy();
    expect(within(first).getByText('Non assignée')).toBeTruthy();
    expect(within(second).getByText('Assignée à Hugo Bernard')).toBeTruthy();
    expect(within(second).queryByText('Non lue,', { exact: false })).toBeNull();
    expect(within(first).getByRole('link').getAttribute('href')).toBe(`/support/${TICKET_ID}`);
    expect(screen.getByText('1 demande non lue sur cette page.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Ouvertes/ })).toBeTruthy();
    expect((await screen.findAllByText('Première réponse en retard')).length).toBeGreaterThan(1);
    expect(screen.getByText(/Les conversations des utilisateurs ne sont jamais lisibles/)).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('envoie les filtres au serveur et revient à la page 1', async () => {
    const source = fakeConsoleSource({ listTickets: () => Promise.resolve(consolePageOf([unread], { total: 45, last_page: 3 })) });
    renderConsoleSupport(<ConsoleSupportBoardPage />, { source });
    await screen.findByRole('list', { name: 'Demandes de support' });
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => { expect(source.listTickets.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 }); });
    await userEvent.click(screen.getByRole('tab', { name: /Résolues/ }));
    await waitFor(() => { expect(source.listTickets.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'resolved', page: 1 }); });
  });

  it('filtre sur l’organisation d’une ligne puis retire le filtre', async () => {
    const source = fakeConsoleSource({ listTickets: () => Promise.resolve(consolePageOf([unread])) });
    renderConsoleSupport(<ConsoleSupportBoardPage />, { source });
    await userEvent.click(await screen.findByRole('button', { name: /Filtrer sur l’organisation/ }));
    await waitFor(() => { expect(source.listTickets.mock.calls.at(-1)?.[0]).toMatchObject({ organization: ORGANIZATION_ID }); });
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le filtre d’organisation' }));
    await waitFor(() => { expect(source.listTickets.mock.calls.at(-1)?.[0]).toMatchObject({ organization: null }); });
  });

  it('débounce la recherche', async () => {
    const source = fakeConsoleSource({ listTickets: () => Promise.resolve(consolePageOf([unread])) });
    renderConsoleSupport(<ConsoleSupportBoardPage />, { source });
    await screen.findByRole('list', { name: 'Demandes de support' });
    const before = source.listTickets.mock.calls.length;
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher une demande' }), 'quit');
    await waitFor(() => { expect(source.listTickets.mock.calls.at(-1)?.[0]).toMatchObject({ search: 'quit', page: 1 }); });
    expect(source.listTickets.mock.calls.length - before).toBeLessThanOrEqual(2);
  });

  it('affiche un état vide', async () => {
    renderConsoleSupport(<ConsoleSupportBoardPage />);
    expect(await screen.findByText('Aucune demande ne correspond')).toBeTruthy();
  });

  it('traduit une erreur du serveur et permet de réessayer', async () => {
    const listTickets = vi.fn().mockRejectedValueOnce(new ApiError(503, 'unavailable', 'brut')).mockResolvedValue(consolePageOf([unread]));
    renderConsoleSupport(<ConsoleSupportBoardPage />, { source: fakeConsoleSource({ listTickets }) });
    expect(await screen.findByText(/momentanément indisponible/)).toBeTruthy();
    expect(screen.queryByText('brut')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByText('Quittance manquante')).toBeTruthy();
  });

  it('actualise la liste toutes les 30 secondes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const source = fakeConsoleSource({ listTickets: () => Promise.resolve(consolePageOf([unread])) });
    renderConsoleSupport(<ConsoleSupportBoardPage />, { source });
    await screen.findByText('Quittance manquante');
    const before = source.listTickets.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30_500); });
    expect(source.listTickets.mock.calls.length).toBeGreaterThan(before);
  });

  it('n’actualise plus la liste quand l’onglet est caché', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const source = fakeConsoleSource({ listTickets: () => Promise.resolve(consolePageOf([unread])) });
    renderConsoleSupport(<ConsoleSupportBoardPage />, { source });
    await screen.findByText('Quittance manquante');
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    const before = source.listTickets.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(95_000); });
    expect(source.listTickets.mock.calls.length).toBe(before);
    hidden.mockRestore();
  });
});
