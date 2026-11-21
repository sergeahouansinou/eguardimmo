import { buildUrl, ApiError } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { fakeAccessSource, grantOf, renderAccess } from '../../../test/support';
import { ORGANIZATION_ID, GRANT_ID, SECOND_GRANT_ID, accessFixture, accessListResponse, accessResponse } from '../testing';
import { createSupportAccessApiSource } from './api/source';
import type { AccessGrant, AccessStatus } from './model';
import { SupportAccessPage } from './pages/AccessPage';
import { useAccessSummary } from './queries';
import { ACCESS_PRIVACY_TEXT } from './copy';

function fakeClient(reply: unknown) {
  const respond = vi.fn(() => Promise.resolve(reply));
  const client: ApiClient = {
    baseUrl: 'http://api.test',
    get: respond,
    post: respond,
    put: respond,
    patch: respond,
    delete: respond,
    url: (path, query) => buildUrl('http://api.test', path, query),
  };
  return { client, respond };
}

const byStatus = (grants: AccessGrant[]) => (status: AccessStatus | null) =>
  Promise.resolve({ items: grants.filter((grant) => status === null || grant.status === status), hasMore: false, nextCursor: null });

describe('source API du consentement', () => {
  it('liste par statut et curseur sur la route de l’organisation', async () => {
    const { client, respond } = fakeClient(accessListResponse([accessFixture()], { has_more: true, next_cursor: 'abc' }));
    const page = await createSupportAccessApiSource({ client, organizationId: ORGANIZATION_ID }).list('requested', 'c0');

    expect(respond).toHaveBeenCalledWith(`/api/v1/org/${ORGANIZATION_ID}/support-access`, { status: 'requested', cursor: 'c0', per_page: 25 });
    expect(page).toMatchObject({ hasMore: true, nextCursor: 'abc' });
    expect(page.items[0]).toMatchObject({ id: GRANT_ID, kind: 'consent', status: 'requested', operator: 'Camille M.', durationHours: 48, scopes: ['settings', 'team'], readCount: 0 });
  });

  it('accepte avec durée et périmètre réduits, refuse et révoque', async () => {
    const { client, respond } = fakeClient(accessResponse(accessFixture({ status: 'active' })));
    const source = createSupportAccessApiSource({ client, organizationId: ORGANIZATION_ID });

    const granted = await source.accept(GRANT_ID, { durationHours: 12, scopes: ['settings'] });
    expect(respond).toHaveBeenLastCalledWith(`/api/v1/org/${ORGANIZATION_ID}/support-access/${GRANT_ID}/accept`, { duration_hours: 12, scopes: ['settings'] });
    expect(granted.status).toBe('active');
    await source.refuse(GRANT_ID);
    expect(respond).toHaveBeenLastCalledWith(`/api/v1/org/${ORGANIZATION_ID}/support-access/${GRANT_ID}/refuse`, {});
    await source.revoke(GRANT_ID);
    expect(respond).toHaveBeenLastCalledWith(`/api/v1/org/${ORGANIZATION_ID}/support-access/${GRANT_ID}/revoke`, {});
  });

  it('refuse une réponse qui n’a pas la forme du serveur', async () => {
    const { client } = fakeClient({ data: [{ id: 3 }] });
    await expect(createSupportAccessApiSource({ client, organizationId: ORGANIZATION_ID }).list(null, null)).rejects.toThrow();
  });
});

describe('page des accès du support', () => {
  it('affiche la demande à traiter, le texte de confidentialité et ne montre pas de lecture sur une demande en attente', async () => {
    const source = fakeAccessSource({ list: byStatus([grantOf()]) });
    const { container } = renderAccess(<SupportAccessPage />, { source });

    const card = await screen.findByRole('article', { name: 'Demande d’accès de Camille M.' });
    expect(within(card).getByText('Demande SUP-2026-0001')).toBeTruthy();
    expect(within(card).getByText(/Diagnostiquer l’erreur/)).toBeTruthy();
    expect(within(card).queryByText(/lecture/)).toBeNull();
    expect(screen.getByText(ACCESS_PRIVACY_TEXT)).toBeTruthy();
    expect(ACCESS_PRIVACY_TEXT).toMatch(/ne lit jamais vos conversations/);
    await expectNoA11yViolations(container);
  });

  it('accepte avec une durée et un périmètre réduits, et déclenche la preuve 2FA sur demande du serveur', async () => {
    const accept = vi.fn().mockRejectedValueOnce(new ApiError(403, 'reauthentication_required', 'brut')).mockResolvedValueOnce(grantOf({ status: 'active' }));
    const source = fakeAccessSource({ list: byStatus([grantOf({ scopes: ['settings', 'team', 'records'], duration_hours: 48 })]), accept });
    const { proof } = renderAccess(<SupportAccessPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Accepter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Accepter l’accès du support ?' });
    const hours = within(dialog).getByRole('spinbutton', { name: /Durée de l’accès/ });
    expect((hours as HTMLInputElement).value).toBe('24');
    await user.clear(hours);
    await user.type(hours, '12');
    await user.click(within(dialog).getByRole('checkbox', { name: /Équipe/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Accepter l’accès' }));

    await waitFor(() => { expect(accept).toHaveBeenCalledTimes(1); });
    expect(accept).toHaveBeenCalledWith(GRANT_ID, { durationHours: 12, scopes: ['settings', 'records'] });
    await waitFor(() => { expect(proof.replays).toHaveLength(1); });
    proof.replays[0]?.();
    await waitFor(() => { expect(accept).toHaveBeenCalledTimes(2); });
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Accepter l’accès du support ?' })).toBeNull(); });
  });

  it('refuse une durée supérieure à la durée demandée et un périmètre vide sans appeler le serveur', async () => {
    const source = fakeAccessSource({ list: byStatus([grantOf({ scopes: ['settings'], duration_hours: 6 })]) });
    renderAccess(<SupportAccessPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Accepter' }));
    const dialog = await screen.findByRole('dialog');
    const hours = within(dialog).getByRole('spinbutton', { name: /Durée de l’accès/ });
    expect((hours as HTMLInputElement).value).toBe('6');
    await user.clear(hours);
    await user.type(hours, '7');
    await user.click(within(dialog).getByRole('button', { name: 'Accepter l’accès' }));
    expect(await within(dialog).findByText('Indiquez une durée entière de 1 à 6 heures.')).toBeTruthy();

    await user.clear(hours);
    await user.type(hours, '6');
    await user.click(within(dialog).getByRole('checkbox', { name: /Réglages/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Accepter l’accès' }));
    expect(await within(dialog).findByText(/au moins un périmètre/)).toBeTruthy();
    expect(source.accept).not.toHaveBeenCalled();
  });

  it('traduit un accès déjà traité et recharge la liste', async () => {
    const accept = vi.fn().mockRejectedValue(new ApiError(409, 'support_access_not_pending', 'brut'));
    const source = fakeAccessSource({ list: byStatus([grantOf()]), accept });
    renderAccess(<SupportAccessPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Accepter' }));
    const before = source.list.mock.calls.length;
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Accepter l’accès' }));

    expect(await screen.findByText(/déjà été accepté, refusé, révoqué ou a expiré/)).toBeTruthy();
    await waitFor(() => { expect(source.list.mock.calls.length).toBeGreaterThan(before); });
  });

  it('refuse après confirmation', async () => {
    const source = fakeAccessSource({ list: byStatus([grantOf()]) });
    renderAccess(<SupportAccessPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Refuser' }));
    expect(source.refuse).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Refuser l’accès' }));

    await waitFor(() => { expect(source.refuse).toHaveBeenCalledWith(GRANT_ID); });
  });

  it('révoque un accès en cours après confirmation, et montre le nombre de lectures', async () => {
    const active = grantOf({ status: 'active', read_count: 3, expires_at: '2026-11-20T09:30:00+00:00', granted_at: '2026-11-19T09:40:00+00:00' });
    const source = fakeAccessSource({ list: byStatus([active]) });
    renderAccess(<SupportAccessPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('tab', { name: 'En cours' }));
    const card = await screen.findByRole('article', { name: 'Demande d’accès de Camille M.' });
    expect(within(card).getByText('3 lectures')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Révoquer l’accès' }));
    await user.click(await screen.findByRole('button', { name: 'Révoquer l’accès' }));

    await waitFor(() => { expect(source.revoke).toHaveBeenCalledWith(GRANT_ID); });
  });

  it('affiche le bandeau d’urgence pour un accès d’urgence en cours', async () => {
    const emergency = grantOf({ id: SECOND_GRANT_ID, kind: 'emergency', status: 'active', emergency_basis: 'security_incident', expires_at: '2026-11-19T18:00:00+00:00', reviewed: false });
    const source = fakeAccessSource({ list: byStatus([emergency]) });
    renderAccess(<SupportAccessPage />, { source });

    const banner = await screen.findByText('Accès d’urgence du support en cours');
    expect(banner).toBeTruthy();
    expect(screen.getByText(/Camille M\. consulte vos réglages et votre équipe en lecture seule/)).toBeTruthy();
  });

  it('n’affiche aucune action ni appel pour un gestionnaire ou un comptable', async () => {
    for (const role of ['manager', 'accountant'] as const) {
      const source = fakeAccessSource({ list: byStatus([grantOf()]) });
      const view = renderAccess(<SupportAccessPage />, { source, role });

      expect(await screen.findByText('Réservé au propriétaire et aux administrateurs')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
      expect(source.list).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it('affiche l’état vide et le motif d’échec', async () => {
    const first = renderAccess(<SupportAccessPage />);
    expect(await screen.findByText('Aucune demande d’accès à traiter')).toBeTruthy();
    first.unmount();

    const source = fakeAccessSource({ list: () => Promise.reject(new ApiError(403, 'forbidden', 'brut')) });
    renderAccess(<SupportAccessPage />, { source });
    expect((await screen.findAllByText(/Seuls le propriétaire et les administrateurs/)).length).toBeGreaterThan(0);
  });
});

function Summary() {
  const summary = useAccessSummary();
  return <p>{summary === undefined ? 'inconnu' : `${String(summary.pending)} en attente, ${String(summary.emergencies.length)} urgence`}</p>;
}

describe('résumé des accès pour la navigation', () => {
  it('compte les demandes en attente et les urgences en cours pour un administrateur', async () => {
    const source = fakeAccessSource({
      list: byStatus([grantOf(), grantOf({ id: SECOND_GRANT_ID, kind: 'emergency', status: 'active', emergency_basis: 'legal_requisition' })]),
    });
    renderAccess(<Summary />, { source });
    expect(await screen.findByText('1 en attente, 1 urgence')).toBeTruthy();
  });

  it('n’interroge pas le serveur pour un rôle sans droit', async () => {
    const source = fakeAccessSource({ list: byStatus([grantOf()]) });
    renderAccess(<Summary />, { source, role: 'manager' });
    expect(await screen.findByText('inconnu')).toBeTruthy();
    expect(source.list).not.toHaveBeenCalled();
  });
});
