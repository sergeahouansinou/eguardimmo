import { createApiClient } from '@eguardimmo/api';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiAuth } from '@/console/api/auth';
import * as api from '@/console/api/fixtures';
import { createApiConsoleSource } from '@/console/api/source';
import { expectNoA11yViolations } from '../../../test/axe';
import { renderWithSource } from '../../../test/render';
import { requestUrl } from '../../../test/requestUrl';
import { ActivityDetailScreen } from './ActivityDetailScreen';
import { ActivityScreen } from './ActivityScreen';

const search = vi.hoisted(() => ({ value: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/audit',
  useSearchParams: () => new URLSearchParams(search.value),
}));

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function stub(...responses: Response[]) {
  const queue = [...responses];
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(queue.shift() ?? json(500, { code: 'server_error', title: 'Imprévu' })));
  vi.stubGlobal('fetch', fetchMock);
  const urls = () => fetchMock.mock.calls.map(([input]) => new URL(requestUrl(input)));
  return { fetchMock, urls };
}

function renderScreen(ui: React.ReactElement) {
  const client = createApiClient({ baseUrl: window.location.origin, readCookie: () => 'x' });
  return renderWithSource(ui, createApiConsoleSource(client, createApiAuth(client)).source);
}

beforeEach(() => {
  search.value = '';
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('journal d’audit en mode api', () => {
  it('liste les entrées du serveur sans texte de démonstration', async () => {
    const { urls } = stub(json(200, api.activityListResponse));
    const { container } = renderScreen(<ActivityScreen />);

    const table = await screen.findByRole('table', { name: 'Entrées du journal d’audit' });
    expect(within(table).getByRole('link', { name: 'user.updated' }).getAttribute('href')).toBe(`/audit/${api.IDS.entry}`);
    expect(within(table).getByText('Jeanne Dupont')).toBeTruthy();
    expect(within(table).getByText('Compte inconnu')).toBeTruthy();
    expect(within(table).getByText('user · 01934f6e')).toBeTruthy();
    expect(urls()[0]?.pathname).toBe('/api/v1/console/activity');
    expect(urls()[0]?.searchParams.get('per_page')).toBe('25');
    for (const text of ['empreinte', 'Conservation', 'Inès Garnier', 'EVT-2026']) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it('affiche une entrée masquée proprement, sans plantage sur les champs null', async () => {
    const redacted = { ...api.activityEntry, actor: { id: api.IDS.actor, name: null, email: null }, subject: { type: 'user', id: null }, changes: null, metadata: null, ip: null, user_agent: null };
    stub(json(200, { ...api.activityListResponse, data: [redacted] }), json(200, { data: redacted }));
    const { container, unmount } = renderScreen(<ActivityScreen />);
    const table = await screen.findByRole('table', { name: 'Entrées du journal d’audit' });
    expect(within(table).getAllByText('Masqué')).toHaveLength(2);
    expect(within(table).queryByText('Compte inconnu')).toBeNull();
    await expectNoA11yViolations(container);
    unmount();

    const view = renderScreen(<ActivityDetailScreen id={api.IDS.entry} />);
    expect(await screen.findAllByText('Contenu masqué : accès de support requis')).toHaveLength(2);
    expect(screen.queryByRole('table', { name: 'Valeurs modifiées' })).toBeNull();
    expect(screen.queryByText('Contexte')).toBeNull();
    expect(screen.getAllByText('Masqué').length).toBeGreaterThanOrEqual(3);
    await expectNoA11yViolations(view.container);
  });

  it('applique les filtres au serveur et revient à la première page', async () => {
    const { urls } = stub(json(200, api.activityListResponse), json(200, api.activityListResponse));
    renderScreen(<ActivityScreen />);
    await screen.findByRole('table');

    await userEvent.type(screen.getByRole('textbox', { name: 'Action (préfixe)' }), 'lease.');
    await userEvent.type(screen.getByLabelText('Organisation'), api.IDS.org);
    await userEvent.type(screen.getByLabelText('Du'), '2026-11-11');
    await userEvent.type(screen.getByLabelText('Au (inclus)'), '2026-11-12');
    await userEvent.click(screen.getByRole('button', { name: 'Filtrer' }));

    await waitFor(() => { expect(urls()).toHaveLength(2); });
    expect(Object.fromEntries(urls()[1]?.searchParams ?? [])).toEqual({
      action: 'lease.',
      organization: api.IDS.org,
      from: '2026-11-11T00:00:00Z',
      to: '2026-11-13T00:00:00Z',
      per_page: '25',
    });
  });

  it('refuse un identifiant mal formé sans interroger le serveur', async () => {
    const { urls } = stub(json(200, api.activityListResponse));
    renderScreen(<ActivityScreen />);
    await screen.findByRole('table');

    await userEvent.type(screen.getByLabelText('Auteur'), '12');
    await userEvent.type(screen.getByLabelText('Au (inclus)'), '2026-11-01');
    await userEvent.type(screen.getByLabelText('Du'), '2026-11-05');
    await userEvent.type(screen.getByLabelText('Identifiant d’entité'), api.IDS.subject);
    await userEvent.click(screen.getByRole('button', { name: 'Filtrer' }));

    expect(await screen.findByText('Identifiant invalide (UUID attendu).')).toBeTruthy();
    expect(screen.getByText('La fin précède le début.')).toBeTruthy();
    expect(screen.getByText('Requis avec l’identifiant d’entité.')).toBeTruthy();
    expect(urls()).toHaveLength(1);
  });

  it('préremplit les filtres depuis l’adresse, par exemple l’historique d’une entité', async () => {
    search.value = `subject_type=user&subject_id=${api.IDS.subject}&request_id=${api.IDS.request}`;
    const { urls } = stub(json(200, api.activityListResponse));
    renderScreen(<ActivityScreen />);

    await screen.findByRole('table');
    expect(Object.fromEntries(urls()[0]?.searchParams ?? [])).toMatchObject({ subject_type: 'user', subject_id: api.IDS.subject, request_id: api.IDS.request });
    expect(screen.getByLabelText<HTMLInputElement>('Type d’entité').value).toBe('user');
  });

  it('pagine par curseur avec les curseurs du serveur', async () => {
    const second = { ...api.activityListResponse, meta: { ...api.activityListResponse.meta, next_cursor: null, prev_cursor: 'prev' } };
    const { urls } = stub(json(200, api.activityListResponse), json(200, second), json(200, api.activityListResponse));
    renderScreen(<ActivityScreen />);
    await screen.findByRole('table');

    expect(screen.getByRole('button', { name: 'Page précédente' }).hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    await waitFor(() => { expect(urls()[1]?.searchParams.get('cursor')).toBe('abc'); });
    await waitFor(() => { expect(screen.getByRole('button', { name: 'Page suivante' }).hasAttribute('disabled')).toBe(true); });
    expect(screen.getByText(/fin du journal/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Page précédente' }));
    await waitFor(() => { expect(urls()[2]?.searchParams.get('cursor')).toBe('prev'); });
  });

  it('indique qu’aucune entrée ne correspond', async () => {
    stub(json(200, { ...api.activityListResponse, data: [], meta: { ...api.activityListResponse.meta, next_cursor: null } }));
    renderScreen(<ActivityScreen />);

    expect(await screen.findByText('Aucune entrée ne correspond')).toBeTruthy();
  });

  it('affiche le message du serveur en cas de 403', async () => {
    stub(json(403, api.forbiddenProblem));
    renderScreen(<ActivityScreen />);

    expect(await screen.findByText('Votre compte n’a pas accès à la console.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('affiche le délai d’attente en cas de 429', async () => {
    stub(json(429, { code: 'too_many_requests', title: 'Trop de requêtes' }, { 'Retry-After': '12' }));
    renderScreen(<ActivityScreen />);

    expect(await screen.findByText('Trop de requêtes. Réessayez dans 12 s.')).toBeTruthy();
  });
});

describe('détail d’une entrée du journal en mode api', () => {
  it('montre l’entrée, le différentiel et les liens de recoupement', async () => {
    const { urls } = stub(json(200, api.activityDetailResponse));
    const { container } = renderScreen(<ActivityDetailScreen id={api.IDS.entry} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'user.updated' })).toBeTruthy();
    expect(urls()[0]?.pathname).toBe(`/api/v1/console/activity/${api.IDS.entry}`);
    const changes = screen.getByRole('table', { name: 'Valeurs modifiées' });
    expect(screen.getByRole('region', { name: 'Valeurs modifiées, défilement horizontal' }).getAttribute('tabindex')).toBe('0');
    expect(within(changes).getByText('[masqué]')).toBeTruthy();
    expect(within(changes).getByText('["admin"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: new RegExp(api.IDS.request) }).getAttribute('href')).toBe(`/audit?request_id=${api.IDS.request}`);
    expect(screen.getByRole('link', { name: new RegExp('Historique de l’entité') }).getAttribute('href')).toBe(`/audit?subject_type=user&subject_id=${api.IDS.subject}`);
    expect(screen.getByRole('link', { name: new RegExp(api.IDS.actor) }).getAttribute('href')).toBe(`/audit?actor=${api.IDS.actor}`);
    expect(screen.getByText('203.0.113.7')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('indique qu’une entrée est introuvable', async () => {
    stub(json(404, api.notFoundProblem));
    renderScreen(<ActivityDetailScreen id={api.IDS.older} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrée introuvable' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour au journal d’audit' }).getAttribute('href')).toBe('/audit');
  });
});
