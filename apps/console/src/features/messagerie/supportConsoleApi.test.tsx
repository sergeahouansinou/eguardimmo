import { createApiClient } from '@eguardimmo/api';
import { ConsoleSupportBoardPage, ConsoleSupportProvider, ConsoleSupportTicketPage, createConsoleSupportApiSource } from '@eguardimmo/messagerie';
import {
  ATTACHMENT_ID,
  GRANT_ID,
  OPERATOR_ID,
  ORGANIZATION_ID,
  OTHER_OPERATOR_ID,
  TICKET_ID,
  accessRequiredProblem,
  consoleDetailResponse,
  consoleGrantFixture,
  consoleGrantResponse,
  consoleListResponse,
  consoleMessagesResponse,
  consoleSettingsResponse,
  consoleStaffResponse,
  consoleStatsResponse,
  consoleTeamResponse,
  consoleTicketFixture,
  noteMessageFixture,
  requesterMessageFixture,
} from '@eguardimmo/messagerie/support-console-testing';
import type { ConsoleGrantFixture, ConsoleMessageFixture } from '@eguardimmo/messagerie/support-console-testing';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from '../../../test/navigation';
import { renderWithConsole } from '../../../test/render';
import { requestUrl } from '../../../test/requestUrl';

interface Call {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function Anchor({ children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a {...props}>{children}</a>;
}

const FUTURE = '2099-01-01T10:00:00+00:00';
const BASE = '/api/v1/console/support';
const ORG = `/api/v1/console/organizations/${ORGANIZATION_ID}`;

interface Store {
  status: 'open' | 'waiting' | 'resolved';
  priority: 'high' | 'normal' | 'low';
  assignee: { id: string; name: string } | null;
  messages: ConsoleMessageFixture[];
  grants: ConsoleGrantFixture[];
}

function fakeServer(options: { grants?: ConsoleGrantFixture[]; fail?: (call: Call) => Response | null } = {}) {
  const store: Store = { status: 'open', priority: 'normal', assignee: null, messages: [requesterMessageFixture()], grants: options.grants ?? [] };
  const calls: Call[] = [];
  const ticket = () => consoleTicketFixture({ status: store.status, priority: store.priority, assignee: store.assignee, support_last_read_at: '2099-01-01T00:00:00+00:00', message_count: store.messages.length });
  const detail = () => consoleDetailResponse(ticket(), store.messages, store.grants);
  const handler = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(requestUrl(input));
    const method = init?.method ?? 'GET';
    const call: Call = { method, path: url.pathname, search: url.searchParams, body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null };
    calls.push(call);
    const failure = options.fail?.(call);
    if (failure) return Promise.resolve(failure);
    if (call.path === `${BASE}/stats`) return Promise.resolve(json(200, consoleStatsResponse()));
    if (call.path === `${BASE}/staff`) return Promise.resolve(json(200, consoleStaffResponse));
    if (call.path === `${BASE}/tickets` && method === 'GET') {
      const wanted = call.search.get('status');
      const rows = wanted === null || wanted === store.status ? [ticket()] : [];
      return Promise.resolve(json(200, consoleListResponse(rows, { open: 1, waiting: 0, resolved: 0, all: 1 })));
    }
    if (call.path === `${BASE}/tickets/${TICKET_ID}` && method === 'GET') return Promise.resolve(json(200, detail()));
    if (call.path === `${BASE}/tickets/${TICKET_ID}` && method === 'PATCH' && typeof call.body === 'object' && call.body !== null) {
      const patch = call.body as { status?: Store['status']; priority?: Store['priority']; assignee_id?: string | null; read?: boolean };
      if (patch.status) store.status = patch.status;
      if (patch.priority) store.priority = patch.priority;
      if (patch.assignee_id !== undefined) store.assignee = patch.assignee_id === null ? null : { id: patch.assignee_id, name: patch.assignee_id === OPERATOR_ID ? 'Camille Martin' : 'Hugo Bernard' };
      return Promise.resolve(json(200, detail()));
    }
    if (call.path === `${BASE}/tickets/${TICKET_ID}/messages` && method === 'GET') return Promise.resolve(json(200, consoleMessagesResponse([])));
    if (call.path === `${BASE}/tickets/${TICKET_ID}/messages` && method === 'POST' && typeof call.body === 'object' && call.body !== null) {
      const sent = call.body as { body: string; internal: string };
      const internal = sent.internal === '1';
      store.messages.push(noteMessageFixture({ id: `0193a5e1-0000-7000-8000-00000000f${String(store.messages.length).padStart(3, '0')}`, body: sent.body, internal }));
      return Promise.resolve(json(200, detail()));
    }
    if (call.path === `${BASE}/tickets/${TICKET_ID}/access-requests` && method === 'POST') {
      store.grants.push(consoleGrantFixture());
      return Promise.resolve(json(201, consoleGrantResponse(consoleGrantFixture())));
    }
    if (call.path === `${BASE}/tickets/${TICKET_ID}/emergency-access` && method === 'POST') {
      store.grants.push(consoleGrantFixture({ kind: 'emergency', status: 'active', emergency_basis: 'security_incident', expires_at: FUTURE }));
      return Promise.resolve(json(201, consoleGrantResponse(consoleGrantFixture())));
    }
    if (call.path === `${BASE}/access/${GRANT_ID}/review` && method === 'POST') {
      store.grants = store.grants.map((grant) => ({ ...grant, reviewed: true, reviewed_at: '2026-11-19T12:00:00+00:00' }));
      return Promise.resolve(json(200, consoleGrantResponse(consoleGrantFixture({ reviewed: true }))));
    }
    if (call.path === `${ORG}/team`) return Promise.resolve(json(200, consoleTeamResponse));
    if (call.path === `${ORG}/settings`) return Promise.resolve(json(200, consoleSettingsResponse));
    return Promise.resolve(json(500, { code: 'server_error', title: 'Route non prévue' }));
  };
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(handler));
  return { store, calls, mutations: () => calls.filter((call) => call.method !== 'GET') };
}

function renderConsole(ui: React.ReactElement) {
  const client = createApiClient({ baseUrl: window.location.origin, readCookie: () => 'x' });
  const source = createConsoleSupportApiSource({ client, operatorId: () => Promise.resolve(OPERATOR_ID) });
  return renderWithConsole(
    <ConsoleSupportProvider source={source} routes={{ board: '/support', ticket: (id) => `/support/${id}` }} Link={Anchor} navigate={(href) => { router.push(href); }}>
      {ui}
    </ConsoleSupportProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('tableau du support en mode api', () => {
  it('liste les demandes du serveur avec ses indicateurs, sans donnée de démonstration', async () => {
    fakeServer();
    renderConsole(<ConsoleSupportBoardPage />);
    const list = await screen.findByRole('list', { name: 'Demandes de support' });
    expect(within(list).getByRole('link', { name: /Impossible d’inviter un gestionnaire/ }).getAttribute('href')).toBe(`/support/${TICKET_ID}`);
    expect(await screen.findByText('Première réponse en retard', { selector: 'span' })).toBeTruthy();
    for (const text of ['E-mails de relance', 'Satisfaction', '94 %', 'Résidences du Parc']) expect(document.body.textContent).not.toContain(text);
  });

  it('envoie onglet, recherche, priorité et assignation au serveur', async () => {
    const { calls } = fakeServer();
    renderConsole(<ConsoleSupportBoardPage />);
    await screen.findByRole('list', { name: 'Demandes de support' });
    await userEvent.click(screen.getByRole('tab', { name: /En attente/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher une demande' }), 'quittance');
    await userEvent.click(screen.getByRole('combobox', { name: /Priorité/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Haute' }));
    await userEvent.click(screen.getByRole('combobox', { name: /Assignation/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Non assignées' }));
    await waitFor(() => {
      const last = [...calls].reverse().find((call) => call.path === `${BASE}/tickets`);
      expect(Object.fromEntries(last?.search ?? [])).toEqual({ status: 'waiting', search: 'quittance', priority: 'high', assignee: 'none', page: '1', per_page: '20' });
    });
    expect(await screen.findByText('Aucune demande ne correspond')).toBeTruthy();
  });

  it('signale l’échec du chargement et propose de réessayer', async () => {
    fakeServer({ fail: (call) => (call.path === `${BASE}/tickets` ? json(500, { code: 'server_error', title: 'Erreur' }) : null) });
    renderConsole(<ConsoleSupportBoardPage />);
    expect(await screen.findByRole('button', { name: /Réessayer/ })).toBeTruthy();
  });
});

describe('demande du support en mode api', () => {
  it('modifie statut, priorité et assignation par PATCH', async () => {
    const { mutations } = fakeServer();
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    await screen.findByRole('heading', { level: 1, name: /Impossible d’inviter un gestionnaire/ });
    await userEvent.click(screen.getByRole('combobox', { name: /Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'En attente du demandeur' }));
    await waitFor(() => { expect(mutations()).toHaveLength(1); });
    await userEvent.click(screen.getByRole('combobox', { name: /Priorité/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Haute' }));
    await userEvent.click(await screen.findByRole('button', { name: 'M’assigner la demande' }));
    await waitFor(() => { expect(mutations()).toHaveLength(3); });
    expect(mutations().map((call) => [call.method, call.body])).toEqual([
      ['PATCH', { status: 'waiting' }],
      ['PATCH', { priority: 'high' }],
      ['PATCH', { assignee_id: OPERATOR_ID }],
    ]);
  });

  it('répond au demandeur puis ajoute une note interne, avec un client_id distinct', async () => {
    const { mutations } = fakeServer();
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    await userEvent.type(await screen.findByRole('textbox', { name: 'Votre réponse au demandeur' }), 'Correctif déployé.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer au demandeur' }));
    expect(await screen.findByText('Correctif déployé.')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Note interne' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Votre note interne' }), 'Vérifier le lot 3.');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la note interne' }));
    expect(await screen.findByRole('article', { name: /Note interne de/ })).toBeTruthy();
    const [reply, note] = mutations().map((call) => call.body as { body: string; internal: string; client_id: string });
    expect(reply).toMatchObject({ body: 'Correctif déployé.', internal: '0' });
    expect(note).toMatchObject({ body: 'Vérifier le lot 3.', internal: '1' });
    expect(reply?.client_id).not.toBe(note?.client_id);
  });

  it('demande un accès à l’organisation avec durée et périmètre', async () => {
    const { mutations } = fakeServer();
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Demander l’accès' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Diagnostiquer l’erreur d’invitation');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => { expect(mutations()).toHaveLength(1); });
    expect(mutations()[0]).toMatchObject({ path: `${BASE}/tickets/${TICKET_ID}/access-requests`, body: { reason: 'Diagnostiquer l’erreur d’invitation', scopes: ['settings', 'team'], duration_hours: 24 } });
    expect(await screen.findByText('En attente de l’organisation')).toBeTruthy();
  });

  it('n’appelle jamais l’ancienne route d’accès supprimée', async () => {
    const { calls } = fakeServer();
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    await screen.findByRole('button', { name: 'Demander l’accès' });
    expect(calls.some((call) => call.path.endsWith('/access'))).toBe(false);
  });

  it('un autre opérateur revoit l’accès d’urgence ; la lecture d’équipe passe par un accès vivant', async () => {
    const emergency = consoleGrantFixture({ kind: 'emergency', status: 'active', emergency_basis: 'security_incident', expires_at: FUTURE, operator: { id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' } });
    const live = consoleGrantFixture({ id: '0193a5e1-0000-7000-8000-0000000001f9', status: 'active', expires_at: FUTURE });
    const { mutations, calls } = fakeServer({ grants: [emergency, live] });
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Consulter l’équipe' }));
    expect(await screen.findByText('Paul Diallo')).toBeTruthy();
    expect(calls.filter((call) => call.path === `${ORG}/team`)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Revoir cet accès d’urgence' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmer la revue' }));
    await waitFor(() => { expect(mutations().at(-1)?.path).toBe(`${BASE}/access/${GRANT_ID}/review`); });
  });

  it('un 403 support_access_required devient un état « accès requis »', async () => {
    fakeServer({
      grants: [consoleGrantFixture({ status: 'active', expires_at: FUTURE })],
      fail: (call) => (call.path === `${ORG}/team` ? json(403, accessRequiredProblem) : null),
    });
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Consulter l’équipe' }));
    const block = await screen.findByRole('region', { name: 'Équipe de l’organisation' });
    expect(await within(block).findByText(/Accès requis/)).toBeTruthy();
    expect(within(block).queryByText(accessRequiredProblem.detail)).toBeNull();
  });

  it.each([
    [409, { code: 'ticket_resolved', title: 'Demande résolue' }, /résolue/, {}],
    [422, { code: 'assignee_not_operator', title: 'Assignation impossible' }, /opérateur/, {}],
    [404, { code: 'ticket_not_found', title: 'Introuvable' }, /n’existe pas/, {}],
    [429, { code: 'too_many_requests', title: 'Trop de requêtes' }, /20 s/, { 'Retry-After': '20' }],
  ])('traduit un %s sur le changement de statut', async (status, body, message, headers) => {
    fakeServer({ fail: (call) => (call.method === 'PATCH' ? json(status, body, headers) : null) });
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    await userEvent.click(await screen.findByRole('combobox', { name: /Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Résolue' }));
    expect(await screen.findByText('Action impossible')).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('signale une demande introuvable', async () => {
    fakeServer({ fail: (call) => (call.method === 'GET' && call.path.endsWith(TICKET_ID) ? json(404, { code: 'ticket_not_found', title: 'Introuvable' }) : null) });
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    expect(await screen.findByText(/n’existe pas/)).toBeTruthy();
  });

  it('télécharge la pièce jointe par le relais', async () => {
    const withFile = requesterMessageFixture({ attachments: [{ id: ATTACHMENT_ID, name: 'quittance.pdf', mime_type: 'application/pdf', size_bytes: 20480 }] });
    const { store, calls } = fakeServer({ fail: (call) => (call.path.includes('/attachments/') ? new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } }) : null) });
    store.messages = [withFile];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderConsole(<ConsoleSupportTicketPage ticketId={TICKET_ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger quittance.pdf' }));
    await waitFor(() => { expect(click).toHaveBeenCalledOnce(); });
    expect(calls.some((call) => call.path === `${BASE}/attachments/${ATTACHMENT_ID}`)).toBe(true);
  });
});
