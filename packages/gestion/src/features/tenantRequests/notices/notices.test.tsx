import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IDS, cursorPage, leaseDetail } from '../testing/fixtures';
import { orgUrl, problem, renderTenantRequests } from '../testing/render';
import type { MockRoute } from '../testing/render';
import { createApiNoticesSource } from './api';
import { NOTICE_IDS, noticeAcknowledged, noticeClosed, noticeLate, noticeRow } from './fixtures';
import { NoticeDetailPage } from './NoticeDetailPage';
import { NoticesPage } from './NoticesPage';
import { NoticesSourceProvider } from './source';

const listUrl = orgUrl('/notice-requests');
const oneUrl = (id: string) => orgUrl(`/notice-requests/${id}`);

function renderNotices(ui: 'list' | 'detail', routes: Record<string, MockRoute>, options: { role?: string | null; id?: string; search?: string } = {}) {
  return renderTenantRequests(
    (context) => (
      <NoticesSourceProvider source={createApiNoticesSource(context)}>
        {ui === 'list' ? <NoticesPage /> : <NoticeDetailPage id={options.id ?? NOTICE_IDS.submitted} />}
      </NoticesSourceProvider>
    ),
    routes,
    options,
  );
}

describe('demandes de congé : liste', () => {
  it('affiche les demandes avec locataire, bail et statut, et alerte sur le retard signalé', async () => {
    renderNotices('list', { [`GET ${listUrl}`]: { body: cursorPage([noticeRow, noticeLate]) } });
    const table = await screen.findByRole('table', { name: 'Demandes de congé' });
    expect((await within(table).findByRole('link', { name: 'Awa Diallo' })).getAttribute('href')).toBe(`/baux/conges/${NOTICE_IDS.submitted}`);
    expect(within(table).getByRole('link', { name: 'Marc Chevalier' })).toBeTruthy();
    expect(within(table).getAllByText('BL-2026-0042')).toHaveLength(2);
    expect(within(table).getAllByText('Mutation professionnelle')).toHaveLength(2);
    expect(within(table).getByText('En retard')).toBeTruthy();
    expect(screen.getByText('1 demande sans accusé de réception dans le délai')).toBeTruthy();
  });

  it('filtre par statut côté serveur', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderNotices('list', { [`GET ${listUrl}`]: (call) => ({ body: cursorPage(call.search.get('status') === 'closed' ? [noticeClosed] : [noticeRow]) }) });
    await screen.findByRole('table', { name: 'Demandes de congé' });
    await user.click(screen.getByRole('combobox', { name: /Statut/ }));
    await user.click(await screen.findByRole('option', { name: 'Clôturée' }));
    await waitFor(() => { expect(callsTo('GET', listUrl).some((call) => call.search.get('status') === 'closed')).toBe(true); });
    expect(await within(screen.getByRole('table', { name: 'Demandes de congé' })).findByText('Clôturée')).toBeTruthy();
  });

  it('refuse proprement le comptable, sans appeler le serveur', async () => {
    const { calls } = renderNotices('list', {}, { role: 'accountant' });
    expect(await screen.findByText('Page indisponible pour votre rôle')).toBeTruthy();
    expect(calls.filter((call) => call.path === listUrl)).toHaveLength(0);
  });

  it('affiche l’état vide et l’erreur de chargement', async () => {
    const { unmount } = renderNotices('list', { [`GET ${listUrl}`]: { body: cursorPage([]) } });
    expect(await screen.findByText(/Aucune demande de congé/)).toBeTruthy();
    unmount();
    renderNotices('list', { [`GET ${listUrl}`]: problem(500, 'server_error') });
    expect(await screen.findByText('Impossible de charger les demandes de congé')).toBeTruthy();
  });
});

describe('demandes de congé : détail', () => {
  const detailRoutes = (row: Record<string, unknown>): Record<string, MockRoute> => ({ [`GET ${oneUrl(String(row.id))}`]: { body: { data: row } } });

  it('pose l’accusé de réception avec la date choisie par l’agence', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderNotices('detail', {
      ...detailRoutes(noticeRow),
      [`POST ${oneUrl(NOTICE_IDS.submitted)}/acknowledge`]: { body: { data: noticeAcknowledged } },
    });
    await user.click(await screen.findByRole('button', { name: 'Accuser réception' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Date de réception *'), { target: { value: '2026-11-17' } });
    await user.click(within(dialog).getByRole('button', { name: 'Accuser réception' }));
    await waitFor(() => { expect(callsTo('POST', `${oneUrl(NOTICE_IDS.submitted)}/acknowledge`)).toHaveLength(1); });
    expect(callsTo('POST', `${oneUrl(NOTICE_IDS.submitted)}/acknowledge`)[0]?.body).toEqual({ received_on: '2026-11-17' });
  });

  it('refuse une date de réception antérieure au dépôt sans appeler le serveur', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderNotices('detail', detailRoutes(noticeRow));
    await user.click(await screen.findByRole('button', { name: 'Accuser réception' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Date de réception *'), { target: { value: '2026-11-10' } });
    await user.click(within(dialog).getByRole('button', { name: 'Accuser réception' }));
    expect(await within(dialog).findByText('La date de réception ne peut pas précéder le dépôt de la demande.')).toBeTruthy();
    expect(callsTo('POST', `${oneUrl(NOTICE_IDS.submitted)}/acknowledge`)).toHaveLength(0);
  });

  it('traduit le refus du serveur (409 déjà accusée) en français', async () => {
    const user = userEvent.setup();
    renderNotices('detail', {
      ...detailRoutes(noticeRow),
      [`POST ${oneUrl(NOTICE_IDS.submitted)}/acknowledge`]: problem(409, 'notice_request_locked', 'English detail'),
    });
    await user.click(await screen.findByRole('button', { name: 'Accuser réception' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Accuser réception' }));
    expect(await within(dialog).findByText(/ne peut plus être accusée/)).toBeTruthy();
    expect(within(dialog).queryByText('English detail')).toBeNull();
  });

  it('enregistre le congé sur le bail en citant la demande et la version du bail', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderNotices('detail', {
      ...detailRoutes(noticeAcknowledged),
      [`POST ${orgUrl(`/leases/${IDS.lease}/notice`)}`]: { body: { data: leaseDetail } },
    }, { id: NOTICE_IDS.submitted });
    await user.click(await screen.findByRole('button', { name: 'Enregistrer le congé' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Enregistrer le congé' }));
    await waitFor(() => { expect(callsTo('POST', orgUrl(`/leases/${IDS.lease}/notice`))).toHaveLength(1); });
    expect(callsTo('POST', orgUrl(`/leases/${IDS.lease}/notice`))[0]?.body).toEqual({
      lock_version: 4,
      notice_given_by: 'tenant',
      notice_received_on: '2026-11-17',
      notice_departure_on: '2027-02-28',
      termination_reason: 'Mutation professionnelle',
      replace: false,
      notice_request_id: NOTICE_IDS.submitted,
    });
  });

  it('refuse un motif trop court sans appeler le serveur', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderNotices('detail', {
      ...detailRoutes(noticeAcknowledged),
      [`POST ${orgUrl(`/leases/${IDS.lease}/notice`)}`]: { body: { data: leaseDetail } },
    }, { id: NOTICE_IDS.submitted });
    await user.click(await screen.findByRole('button', { name: 'Enregistrer le congé' }));
    const dialog = await screen.findByRole('dialog');
    const reason = await within(dialog).findByRole('textbox', { name: /Motif du congé/ });
    await user.clear(reason);
    await user.type(reason, 'ab');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer le congé' }));
    expect(await within(dialog).findByText('Indiquez un motif de 3 à 255 caractères.')).toBeTruthy();
    expect(callsTo('POST', orgUrl(`/leases/${IDS.lease}/notice`))).toHaveLength(0);
  });

  it('enregistre le départ d’un colocataire seul', async () => {
    const user = userEvent.setup();
    const { callsTo } = renderNotices('detail', {
      ...detailRoutes(noticeAcknowledged),
      [`POST ${orgUrl(`/leases/${IDS.lease}/parties/${IDS.linkAwa}/end`)}`]: { body: { data: leaseDetail } },
    });
    await user.click(await screen.findByRole('button', { name: 'Départ de ce locataire seul' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Enregistrer le départ' }));
    await waitFor(() => { expect(callsTo('POST', orgUrl(`/leases/${IDS.lease}/parties/${IDS.linkAwa}/end`))).toHaveLength(1); });
    expect(callsTo('POST', orgUrl(`/leases/${IDS.lease}/parties/${IDS.linkAwa}/end`))[0]?.body).toEqual({ lock_version: 4, valid_to: '2027-02-28', notice_request_id: NOTICE_IDS.submitted });
  });

  it('n’offre aucune action sur une demande clôturée et affiche son issue', async () => {
    renderNotices('detail', detailRoutes(noticeClosed), { id: NOTICE_IDS.closed });
    expect(await screen.findByText('Congé enregistré sur le bail.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enregistrer le congé' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accuser réception' })).toBeNull();
  });

  it('télécharge le justificatif par la route dédiée', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => undefined;
    const { callsTo } = renderNotices('detail', {
      ...detailRoutes(noticeRow),
      [`GET ${oneUrl(NOTICE_IDS.submitted)}/proof`]: { file: { type: 'application/pdf', content: '%PDF' } },
    });
    await user.click(await screen.findByRole('button', { name: 'Télécharger le justificatif' }));
    await waitFor(() => { expect(callsTo('GET', `${oneUrl(NOTICE_IDS.submitted)}/proof`)).toHaveLength(1); });
  });

  it('affiche l’introuvable sur un 404', async () => {
    renderNotices('detail', { [`GET ${oneUrl(NOTICE_IDS.submitted)}`]: problem(404, 'notice_request_not_found') });
    expect(await screen.findByText('Demande introuvable')).toBeTruthy();
  });
});
