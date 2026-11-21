import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { availabilityOf, fakeSupportSource, renderSupport, summaryOf } from '../../../test/support';
import { HelpPage } from '../../pages/HelpPage';
import { SECOND_TICKET_ID, TICKET_ID } from '../testing';
import { createSeenTickets, countUnread, isTicketUnread } from '../unread';
import { SupportApiWidget } from './ApiWidget';

describe('widget d’aide branché sur le support', () => {
  it('affiche le statut serveur du support et les demandes récentes avec un lien vers chaque fil', async () => {
    const source = fakeSupportSource({
      availability: () => Promise.resolve(availabilityOf(false)),
      listTickets: () => Promise.resolve([summaryOf({ status: 'waiting', updated_at: '2026-11-19T10:00:00+00:00' }), summaryOf({ id: SECOND_TICKET_ID, reference: 'SUP-2026-0002', subject: 'Facture' })]),
    });
    renderSupport(<SupportApiWidget />, { source });
    const user = userEvent.setup();

    expect(await screen.findByRole('button', { name: 'Aide et support, 1 réponse non lue' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Aide et support/ }));
    const panel = await screen.findByRole('dialog', { name: 'Aide et support' });
    expect(await within(panel).findByText('Hors ligne')).toBeTruthy();
    await user.click(within(panel).getByRole('tab', { name: /Support/ }));

    const list = await within(panel).findByRole('list', { name: 'Demandes récentes' });
    expect(within(list).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([`/support/${TICKET_ID}`, `/support/${SECOND_TICKET_ID}`]);
    expect(within(panel).getByRole('link', { name: /Nouvelle demande/ }).getAttribute('href')).toBe('/support/nouvelle');
    expect(within(panel).getByRole('link', { name: 'Toutes mes demandes' }).getAttribute('href')).toBe('/support');
    expect(within(panel).getByText(/ne lit jamais vos conversations/)).toBeTruthy();
    await expectNoA11yViolations(panel);
  });

  it('n’affiche aucune pastille sans réponse à lire', async () => {
    const source = fakeSupportSource({ listTickets: () => Promise.resolve([summaryOf()]) });
    renderSupport(<SupportApiWidget />, { source });
    await waitFor(() => { expect(source.listTickets).toHaveBeenCalled(); });
    expect(screen.getByRole('button', { name: 'Aide et support' })).toBeTruthy();
  });
});

describe('réponses non lues', () => {
  const waiting = summaryOf({ status: 'waiting', updated_at: '2026-11-19T10:00:00+00:00', requester_last_read_at: '2026-11-19T09:00:00+00:00' });

  it('compte une réponse du support postérieure à la dernière lecture, jamais une demande ouverte', () => {
    const seen = createSeenTickets();
    expect(isTicketUnread(waiting, seen)).toBe(true);
    expect(isTicketUnread(summaryOf({ status: 'open', updated_at: '2026-11-19T10:00:00+00:00' }), seen)).toBe(false);
    expect(isTicketUnread(summaryOf({ status: 'waiting', requester_last_read_at: null }), seen)).toBe(true);
    expect(isTicketUnread(summaryOf({ status: 'resolved', updated_at: '2026-11-19T09:00:00+00:00', requester_last_read_at: '2026-11-19T09:00:00+00:00' }), seen)).toBe(false);
    expect(countUnread([waiting, summaryOf()], seen)).toBe(1);
  });

  it('cesse de compter une demande vue, et la recompte si elle bouge ensuite', () => {
    const seen = createSeenTickets();
    seen.mark(waiting.id, waiting.updatedAt);
    expect(isTicketUnread(waiting, seen)).toBe(false);
    expect(isTicketUnread({ ...waiting, updatedAt: '2026-11-19T11:00:00+00:00' }, seen)).toBe(true);
  });
});

describe('centre d’aide branché sur le support', () => {
  it('mène « Écrire au support » à la page de nouvelle demande, sans formulaire legacy', async () => {
    renderSupport(<HelpPage />);

    const link = await screen.findByRole('link', { name: 'Écrire au support' });
    expect(link.getAttribute('href')).toBe('/support/nouvelle');
    expect(screen.queryByRole('button', { name: 'Écrire au support' })).toBeNull();
  });
});
