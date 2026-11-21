import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { expectNoA11yViolations } from '../../../../test/axe';
import { FROZEN_NOW, norm, renderLot } from '../../../../test/lots';
import { CandidatDossierPage, CandidatInvitePage, CandidatsPage } from '../gatedPages';
import { RentSourceProvider, createApiRentSource } from '../../finances/rent';
import { TenantRequestsAccessProvider, tenantRequestsPermissions } from '../../tenantRequests';
import { LocataireDetailPage } from '../LocataireDetailPage';
import { LocataireFormPage } from '../LocataireFormPage';
import { LocatairesPage } from '../LocatairesPage';
import { useUpdateTenant } from '../hooks';
import { GestionNavigationProvider } from '../kit';
import { GestionDataModeProvider } from '../kit/sourceContext';
import { LocatairesSourceProvider, createDemoLocatairesSource } from '../source';
import type { LocatairesSource } from '../source';
import { createApiLocatairesSource } from './apiSource';
import * as api from './responses.fixtures';
import { listRoutes, mockApi, org, party } from './testing';
import type { MockRoute } from './testing';

function Link({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

function apiSource(routes: Record<string, MockRoute>) {
  const mock = mockApi(routes);
  return { ...mock, source: createApiLocatairesSource({ client: mock.client, organizationId: api.IDS.org }, { now: () => FROZEN_NOW }) };
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

function Providers({ source, client, children }: { source: LocatairesSource; client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionNavigationProvider value={{ Link, push: vi.fn(), search: new URLSearchParams() }}>
            <LocatairesSourceProvider source={source}><TenantRequestsAccessProvider source={tenantRequestsPermissions(null)}>{children}</TenantRequestsAccessProvider></LocatairesSourceProvider>
          </GestionNavigationProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const renderApi = (ui: ReactElement, source: LocatairesSource, client: QueryClient = newClient()) => render(<Providers source={source} client={client}>{ui}</Providers>);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('liste des locataires en mode API', () => {
  it('affiche les contacts du serveur sans solde, sans invitation et sans donnée d’exemple', async () => {
    const { source } = apiSource(listRoutes());
    const { container } = renderApi(<LocatairesPage />, source);

    expect(await screen.findByRole('link', { name: 'Marc Chevalier' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /À suivre/ }).textContent).toContain('1');
    expect(screen.queryByRole('tab', { name: /Invitations/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inviter un locataire' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Solde/ })).toBeNull();
    expect(document.body.textContent).not.toContain('Koffi Adjovi');
    expect(document.body.textContent).not.toContain('de loyer en retard');
    await expectNoA11yViolations(container);
  });

  it('propose les autres locataires avec leur état de bail, sans solde', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<LocatairesPage />, source);
    await screen.findByRole('link', { name: 'Marc Chevalier' });
    await userEvent.click(screen.getByRole('tab', { name: /Tous/ }));
    const text = norm(document.body.textContent);
    expect(text).toContain('Awa Diallo');
    expect(text).toContain('Bail en cours');
    expect(text).toContain('Sans bail');
    expect(text).not.toContain('Paul Garant');
    expect(text).not.toContain('0 €');
    expect(screen.getByRole('link', { name: 'Awa Diallo' }).getAttribute('href')).toBe(`/locataires/${api.IDS.awa}`);
  });

  it('masque Supprimer et le portail dans les actions', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<LocatairesPage />, source);
    await screen.findByRole('link', { name: 'Marc Chevalier' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Marc Chevalier' }));
    expect(await screen.findByRole('menuitem', { name: 'Archiver' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Supprimer' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Inviter sur le portail' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Situation du compte' })).toBeNull();
  });

  it('archive un contact après confirmation', async () => {
    const { source, callsTo } = apiSource({
      ...listRoutes(),
      [`POST ${party(api.IDS.marc)}/archive`]: { body: api.detailResponse({ ...api.awaDetail, id: api.IDS.marc, archived_at: '2026-11-16T10:00:00+00:00' }) },
    });
    renderApi(<LocatairesPage />, source);
    await screen.findByRole('link', { name: 'Marc Chevalier' });
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions, Marc Chevalier' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }));
    expect(await screen.findByText('Locataire archivé')).toBeTruthy();
    expect(callsTo('POST', `${party(api.IDS.marc)}/archive`)).toHaveLength(1);
  });

  it('signale une erreur du serveur au lieu d’afficher une liste vide', async () => {
    const { source } = apiSource({ [`GET ${org('/parties')}`]: { status: 500, body: api.problem(500, 'server_error', 'Erreur', 'Une erreur interne est survenue.') } });
    renderApi(<LocatairesPage />, source);
    expect(await screen.findByText('Les locataires n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.queryByText('Aucun locataire')).toBeNull();
  });

  it('affiche l’état vide quand le serveur ne renvoie aucun contact', async () => {
    const { source } = apiSource({ [`GET ${org('/parties')}`]: { body: api.pageOf([]) } , [`GET ${org('/units')}`]: { body: api.unitsPage([]) } });
    renderApi(<LocatairesPage />, source);
    expect(await screen.findByText('Aucun locataire')).toBeTruthy();
  });

  it('affiche le chargement avant la réponse', () => {
    const { source } = apiSource({ [`GET ${org('/parties')}`]: () => ({ body: api.pageOf([]) }) });
    renderApi(<LocatairesPage />, source);
    expect(screen.getByRole('status', { name: 'Chargement des locataires' })).toBeTruthy();
  });
});

describe('soldes de la fiche locataire en mode API', () => {
  it('lit le solde de chaque bail du locataire sur l’API de loyers, sans solde local', async () => {
    const { source } = apiSource(listRoutes());
    const rentMock = mockApi({
      [`GET ${org(`/rent/leases/${api.IDS.lease}/balance`)}`]: { body: { data: { lease_id: api.IDS.lease, balance: { amount: -30000, currency: 'EUR' }, overdue: { amount: 30000, currency: 'EUR' }, advance: { amount: 0, currency: 'EUR' }, unpaid_count: 1, oldest_unpaid_due_date: '2026-11-05' } } },
    });
    const rent = createApiRentSource({ client: rentMock.client, organizationId: api.IDS.org, role: 'manager' }, { fetchImpl: rentMock.fetchImpl });
    render(
      <GestionDataModeProvider mode="api">
        <Providers source={source} client={newClient()}>
          <RentSourceProvider source={rent}>
            <LocataireDetailPage id={api.IDS.awa} />
          </RentSourceProvider>
        </Providers>
      </GestionDataModeProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Awa Diallo' })).toBeTruthy();
    const balance = await screen.findByRole('region', { name: /^Solde du bail/ });
    expect(await within(balance).findByText('Échéances impayées')).toBeTruthy();
    expect(norm(balance.textContent)).toContain('Solde au grand livre-300 €');
    expect(rentMock.calls.map((call) => call.path)).toContain(org(`/rent/leases/${api.IDS.lease}/balance`));
    expect(norm(document.body.textContent)).not.toContain('Solde du compte');
  });
});

describe('fiche locataire en mode API', () => {
  it('montre les données du serveur et annonce honnêtement ce qui n’est pas relié', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<LocataireDetailPage id={api.IDS.awa} />, source);

    expect(await screen.findByRole('heading', { name: 'Awa Diallo' })).toBeTruthy();
    const text = norm(document.body.textContent);
    expect(text).toContain('910 € par mois');
    expect(text).toContain('IBAN •••• 0189');
    expect(text).toContain('12 rue du Port, 13002 Marseille');
    expect(text).toContain('Paul Garant');
    expect(text).toContain('Bientôt disponible');
    expect(text).not.toContain('Solde du compte');
    expect(text).not.toContain('Paiements à l\'heure');
    expect(text).not.toContain('Profession');
    expect(text).toContain('Locataire depuis le 01/01/2026');
  });

  it('affiche « introuvable » quand le serveur ne connaît pas le contact', async () => {
    const { source } = apiSource({
      [`GET ${party(api.IDS.awa)}`]: { status: 404, body: api.problem(404, 'party_not_found', 'Contact introuvable', 'Ce contact n\'existe pas dans votre organisation.') },
      [`GET ${org('/leases/tenancies')}`]: { status: 404, body: api.problem(404, 'party_not_found', 'Contact introuvable', 'Ce contact n\'existe pas dans votre organisation.') },
      [`GET ${org('/units')}`]: { body: api.unitsPage([]) },
    });
    renderApi(<LocataireDetailPage id={api.IDS.awa} />, source);
    expect(await screen.findByText('Ce locataire n’existe pas')).toBeTruthy();
  });
});

describe('formulaire en mode API', () => {
  it('retire la civilité, remplace l’expiration et la copie par le numéro de pièce', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<LocataireFormPage id={api.IDS.awa} />, source);
    expect(await screen.findByLabelText('Prénom *')).toBeTruthy();
    expect(screen.queryByText('Civilité')).toBeNull();
    expect(screen.getByLabelText('Numéro de la pièce')).toBeTruthy();
    expect(screen.getByText(/se terminant par 4567/)).toBeTruthy();
    expect(screen.queryByLabelText('Date d’expiration')).toBeNull();
    expect(norm(document.body.textContent)).toContain('Bientôt disponible');
  });

  it('enregistre la modification avec la version lue', async () => {
    const { source, callsTo } = apiSource({ ...listRoutes(), [`PATCH ${party(api.IDS.awa)}`]: { body: api.detailResponse({ ...api.awaDetail, lock_version: 4 }) } });
    renderApi(<LocataireFormPage id={api.IDS.awa} />, source);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    await screen.findByLabelText('Prénom *');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(callsTo('PATCH', party(api.IDS.awa))).toHaveLength(1); });
    expect(callsTo('PATCH', party(api.IDS.awa))[0]?.body).toMatchObject({ lock_version: 3 });
  });

  it('affiche « modifiée entre-temps » sur un conflit de version', async () => {
    const { source } = apiSource({ ...listRoutes(), [`PATCH ${party(api.IDS.awa)}`]: { status: 409, body: api.staleProblem } });
    renderApi(<LocataireFormPage id={api.IDS.awa} />, source);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    await screen.findByLabelText('Prénom *');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByText(/Cette fiche a été modifiée entre-temps/)).toBeTruthy();
  });
});

describe('hooks avec client simulé', () => {
  it('invalide les requêtes après un conflit de version pour recharger la fiche', async () => {
    const { source, callsTo } = apiSource({ ...listRoutes(), [`PATCH ${party(api.IDS.awa)}`]: { status: 409, body: api.staleProblem } });
    const client = newClient();
    const wrapper = ({ children }: { children: ReactNode }) => <Providers source={source} client={client}>{children}</Providers>;
    await client.query({ queryKey: ['gestion', 'locataires', 'tenant', api.IDS.awa], queryFn: () => source.tenant(api.IDS.awa) });
    const { result } = renderHook(() => useUpdateTenant(api.IDS.awa), { wrapper });
    const before = callsTo('GET', party(api.IDS.awa)).length;
    const input = { kind: 'particulier' as const, civility: '' as const, firstName: 'Awa', lastName: 'Diallo', companyName: '', birthDate: '', email: 'awa.diallo@example.com', phone: '+33 6 00 00 00 01', idDocType: '' as const, idExpiry: '', idFileName: '', idNumber: '' };

    await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ kind: 'stale_version' });
    expect(client.getQueryState(['gestion', 'locataires', 'tenant', api.IDS.awa])?.isInvalidated).toBe(true);
    expect(callsTo('PATCH', party(api.IDS.awa))[0]?.body).toMatchObject({ lock_version: 3 });
    expect(before).toBe(1);
  });
});

describe('écrans sans route serveur', () => {
  it.each([
    ['candidats', <CandidatsPage key="a" />],
    ['dossier de candidat', <CandidatDossierPage key="b" id="lea-martin" />],
    ['invitation de candidat', <CandidatInvitePage key="c" />],
  ])('%s : état « bientôt disponible », sans appel serveur ni donnée d’exemple', (_name, page) => {
    const { source, calls } = apiSource({});
    renderApi(page, source);
    expect(screen.getByText('Bientôt disponible')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.body.textContent).not.toContain('Léa Martin');
    expect(calls).toHaveLength(0);
  });
});

describe('mode démonstration inchangé', () => {
  it('ne déclare aucune fonction indisponible', () => {
    expect(createDemoLocatairesSource().unavailableInApiMode).toEqual([]);
  });

  it('garde le solde, l’invitation et les onglets complets', async () => {
    renderLot(<LocatairesPage />);
    expect(await screen.findByRole('link', { name: 'Koffi Adjovi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Inviter un locataire' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Invitations/ })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /Solde/ })).toBeTruthy();
  });

  it('garde la fiche complète avec solde, garants absents et civilité', async () => {
    renderLot(<LocataireDetailPage id="koffi-adjovi" />);
    expect(await screen.findByRole('heading', { name: 'Koffi Adjovi' })).toBeTruthy();
    const text = norm(document.body.textContent);
    expect(text).toContain('Solde du compte');
    expect(text).toContain('Profession');
    expect(text).not.toContain('Bientôt disponible');
    expect(within(document.body).queryByText('Garants du bail en cours')).toBeNull();
  });

  it('rend les écrans de candidats tels quels', async () => {
    renderLot(<CandidatsPage />);
    expect(await screen.findByText('Léa Martin')).toBeTruthy();
    expect(screen.queryByText('Bientôt disponible')).toBeNull();
  });
});
