import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, TooltipProvider } from '@eguardimmo/ui';
import { expectNoA11yViolations } from '../../../../test/axe';
import { FROZEN_NOW, norm, renderLot } from '../../../../test/lots';
import { CourriersSourceProvider, createUnavailableCourriersSource } from '../../courriers';
import { GestionDataModeProvider, GestionNavigationProvider, LocatairesSourceProvider, createDemoLocatairesSource } from '../../locataires';
import { BailDetailPage } from '../BailDetailPage';
import { BauxPage } from '../BauxPage';
import { ReviseRentDialog } from '../ReviseRentDialog';
import { useCreateEdl, useCreateReservation, useImportLeases, useLeases, useMarkReturned, useSetExitStep, useUpdateLease } from '../hooks';
import { EtatsLieuxPage, ReservationsPage } from '../gatedPages';
import { BauxSourceProvider, createDemoBauxSource } from '../source';
import type { BauxSource } from '../source';
import { RentSourceProvider, createApiRentSource } from '../../finances/rent';
import { TenantRequestsAccessProvider, tenantRequestsPermissions } from '../../tenantRequests';
import { createApiBauxSource } from './apiSource';
import * as api from './responses.fixtures';
import { mockApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const org = (path: string) => orgPath(api.IDS.org, path);
const lease = (id: string) => org(`/leases/${id}`);

function Link({ href, children, ...props }: ComponentProps<'a'> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
}

const listRoutes = (): Record<string, MockRoute> => ({
  [`GET ${org('/leases')}`]: (call) => (call.search.get('archived') === '1' ? { body: api.pageOf([]) } : { body: api.pageOf([api.leaseDetail, api.noticeDetail]) }),
  [`GET ${lease(api.IDS.lease)}`]: { body: api.detailResponse(api.leaseDetail) },
  [`GET ${lease(api.IDS.leaseNotice)}`]: { body: api.detailResponse(api.noticeDetail) },
});

function apiSource(routes: Record<string, MockRoute>) {
  const mock = mockApi(routes);
  return { ...mock, source: createApiBauxSource({ client: mock.client, organizationId: api.IDS.org }, { now: () => FROZEN_NOW }) };
}

const balanceRoute = `GET ${org(`/rent/leases/${api.IDS.lease}/balance`)}`;
const unpaidBalance = { data: { lease_id: api.IDS.lease, balance: { amount: -30000, currency: 'EUR' }, overdue: { amount: 30000, currency: 'EUR' }, advance: { amount: 0, currency: 'EUR' }, unpaid_count: 1, oldest_unpaid_due_date: '2026-11-05' } };
const rentMock = mockApi({ [balanceRoute]: { body: unpaidBalance } });
const rentSource = createApiRentSource({ client: rentMock.client, organizationId: api.IDS.org, role: 'manager' }, { fetchImpl: rentMock.fetchImpl });

function Providers({ source, client, children }: { source: BauxSource; client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <GestionDataModeProvider mode="api">
            <GestionNavigationProvider value={{ Link, push: vi.fn(), search: new URLSearchParams() }}>
              <LocatairesSourceProvider source={createDemoLocatairesSource()}>
                <CourriersSourceProvider source={createUnavailableCourriersSource()}>
                  <BauxSourceProvider source={source}><RentSourceProvider source={rentSource}><TenantRequestsAccessProvider source={tenantRequestsPermissions(null)}>{children}</TenantRequestsAccessProvider></RentSourceProvider></BauxSourceProvider>
                </CourriersSourceProvider>
              </LocatairesSourceProvider>
            </GestionNavigationProvider>
          </GestionDataModeProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

function renderApi(ui: ReactElement, source: BauxSource) {
  return render(<Providers source={source} client={newClient()}>{ui}</Providers>);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN_NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('liste des baux en mode API', () => {
  it('affiche les baux du serveur sans solde ni import, sans donnée d’exemple', async () => {
    const { source } = apiSource(listRoutes());
    const { container } = renderApi(<BauxPage />, source);

    const table = await screen.findByRole('table', { name: 'Baux' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toEqual(['Tout sélectionner', 'Bien', 'Locataire', 'Type', 'Loyer', 'Charges', 'Dépôt', 'Fin', 'État', 'Actions']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => /BL-\d{4}-\d{4}/.exec(norm(row.textContent))?.[0])).toEqual(['BL-2026-0001', 'BL-2026-0002']);
    expect(norm(rows[0]?.textContent)).toContain('850 €');
    expect(norm(rows[0]?.textContent)).toContain('31/12/2028');
    expect(screen.queryByRole('button', { name: 'Importer' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Solde' })).toBeNull();
    expect(document.body.textContent).not.toContain('BL-2023-0007');
    await expectNoA11yViolations(container);
  });

  it('signale une erreur du serveur au lieu d’afficher une liste vide', async () => {
    const { source } = apiSource({ [`GET ${org('/leases')}`]: { status: 500, body: api.problem(500, 'server_error', 'Erreur interne', 'Une erreur interne est survenue.') } });
    renderApi(<BauxPage />, source);
    expect(await screen.findByText('Les baux n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Baux' })).toBeNull();
  });

  it('affiche l’état vide quand le serveur ne renvoie aucun bail', async () => {
    const { source } = apiSource({ [`GET ${org('/leases')}`]: { body: api.pageOf([]) } });
    renderApi(<BauxPage />, source);
    expect(await screen.findByText('Aucun bail')).toBeTruthy();
  });

  it('affiche le chargement avant la réponse', () => {
    const { source } = apiSource({ [`GET ${org('/leases')}`]: () => ({ body: api.pageOf([]) }) });
    renderApi(<BauxPage />, source);
    expect(screen.getByRole('status', { name: 'Chargement des baux' })).toBeTruthy();
  });
});

describe('actions de la liste des baux en mode API', () => {
  const rowMenu = async (reference: string) => {
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('button', { name: `Plus d’actions, bail ${reference}` }));
  };

  it('masque les quittances, avis d’échéance et courriers qui n’ont pas de source serveur', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<BauxPage />, source);
    await rowMenu('BL-2026-0001');

    expect(await screen.findByRole('menuitem', { name: 'Ouvrir le bail' })).toBeTruthy();
    for (const name of ['Quittances', 'Avis d’échéance', 'Générer un courrier']) expect(screen.queryByRole('menuitem', { name })).toBeNull();
  });

  it('masque « Envoyer un avis » dans les actions de la sélection', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<BauxPage />, source);
    await screen.findByRole('table', { name: 'Baux' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner BL-2026-0001' }));

    expect(screen.getByRole('button', { name: 'Exporter la sélection' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Envoyer un avis' })).toBeNull();
  });

  it('renouvelle le bail par POST /renew après confirmation', async () => {
    const renewed = { ...api.leaseDetail, end_date: '2031-12-31', lock_version: 4 };
    const { source, callsTo } = apiSource({ ...listRoutes(), [`POST ${lease(api.IDS.lease)}/renew`]: { body: api.detailResponse(renewed) } });
    renderApi(<BauxPage />, source);
    await rowMenu('BL-2026-0001');
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Renouveler' }));
    expect(callsTo('POST', `${lease(api.IDS.lease)}/renew`)).toHaveLength(0);

    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Renouveler' }));

    await waitFor(() => { expect(callsTo('POST', `${lease(api.IDS.lease)}/renew`)).toHaveLength(1); });
    expect(callsTo('POST', `${lease(api.IDS.lease)}/renew`)[0]?.body).toEqual({ lock_version: 3 });
  });

  it('affiche l’erreur du serveur quand le renouvellement est refusé', async () => {
    const refusal = api.problem(409, 'lease_renewal_not_allowed', 'Renouvellement impossible', 'Un préavis est enregistré sur ce bail : il doit être levé avant de le renouveler.');
    const { source } = apiSource({ ...listRoutes(), [`POST ${lease(api.IDS.lease)}/renew`]: { status: 409, body: refusal } });
    renderApi(<BauxPage />, source);
    await rowMenu('BL-2026-0001');
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Renouveler' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Renouveler' }));

    expect(await screen.findByText('Un préavis est enregistré sur ce bail : il doit être levé avant de le renouveler.')).toBeTruthy();
  });

  it('montre une ligne non affichable sans empêcher d’afficher les autres baux', async () => {
    const tacit = { ...api.leaseDetail, id: api.IDS.leaseDraft, reference: 'BL-2026-0010', end_date: null, duration_months: null };
    const { source } = apiSource({
      ...listRoutes(),
      [`GET ${org('/leases')}`]: (call) => (call.search.get('archived') === '1' ? { body: api.pageOf([]) } : { body: api.pageOf([api.leaseDetail, tacit]) }),
      [`GET ${lease(api.IDS.leaseDraft)}`]: { body: api.detailResponse(tacit) },
    });
    renderApi(<BauxPage />, source);

    const table = await screen.findByRole('table', { name: 'Baux' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const shown = rows.find((row) => row.textContent.includes('BL-2026-0001'));
    const hidden = rows.find((row) => row.textContent.includes('BL-2026-0010'));
    expect(norm(shown?.textContent)).toContain('850 €');
    expect(norm(hidden?.textContent)).toContain('Non affichable');
    if (!hidden) throw new Error('ligne non affichable absente');
    expect(within(hidden).queryByRole('checkbox')).toBeNull();
    expect(norm(document.body.textContent)).toContain('1 baux en cours, 910 € appelés par mois');
  });
});

describe('hook de liste avec client simulé', () => {
  it('charge les baux depuis l’API et les valide avec le schéma d’écran', async () => {
    const { source, callsTo } = apiSource(listRoutes());
    const client = newClient();
    const { result } = renderHook(() => useLeases(), { wrapper: ({ children }) => <Providers source={source} client={client}>{children}</Providers> });

    await waitFor(() => { expect(result.current.data).toBeDefined(); });
    expect(result.current.data?.map((entry) => entry.reference)).toEqual(['BL-2026-0001', 'BL-2026-0002']);
    expect(callsTo('GET', org('/leases')).length).toBeGreaterThan(0);
  });

  it('propage l’erreur typée de version périmée et recharge la liste', async () => {
    const draftPath = lease(api.IDS.leaseDraft);
    const { source, callsTo } = apiSource({
      ...listRoutes(),
      [`GET ${org('/catalog/vocabularies/lease_component/terms')}`]: { body: api.catalogTermsResponse },
      [`GET ${draftPath}`]: { body: api.detailResponse(api.draftDetail) },
      [`PATCH ${draftPath}`]: { status: 409, body: api.staleProblem },
    });
    const client = newClient();
    const { result } = renderHook(() => useUpdateLease(api.IDS.leaseDraft), { wrapper: ({ children }) => <Providers source={source} client={client}>{children}</Providers> });
    const input = { unitId: api.IDS.unit, furnished: false, start: '2026-01-01', durationMonths: '36', tenantIds: [api.IDS.tenant], paymentMethod: 'virement' as const, note: '', rent: '850', charges: '60', deposit: '850', dueDay: '5', asDraft: true };

    await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ kind: 'stale_version' });
    expect(callsTo('PATCH', draftPath)[0]?.body).toMatchObject({ lock_version: 1 });
  });
});

describe('fiche d’un bail en mode API', () => {
  it('montre le bail du serveur et annonce honnêtement ce qui n’est pas relié', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<BailDetailPage id={api.IDS.lease} />, source);

    expect(await screen.findByRole('heading', { name: 'Bail BL-2026-0001' })).toBeTruthy();
    const text = norm(document.body.textContent);
    expect(text).toContain('Loyer charges comprises');
    expect(text).toContain('910 €');
    expect(text).toContain('Bientôt disponible');
    expect(text).not.toContain('Solde du compte');
    expect(text).not.toContain('non reçu');
  });

  it('lit le solde du bail sur l’API de loyers au lieu d’un solde local', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<BailDetailPage id={api.IDS.lease} />, source);

    const balance = await screen.findByRole('region', { name: 'Solde du bail' });
    expect(await within(balance).findByText('Échéances impayées')).toBeTruthy();
    expect(norm(balance.textContent)).toContain('Solde au grand livre-300 €');
    expect(norm(balance.textContent)).toContain('En retard300 €');
    expect(rentMock.calls.some((call) => call.path === org(`/rent/leases/${api.IDS.lease}/balance`))).toBe(true);
    expect(norm(document.body.textContent)).not.toContain('Solde du compte');
  });

  it('calcule la prochaine révision depuis le loyer indexé du bail', async () => {
    const { source } = apiSource(listRoutes());
    renderApi(<BailDetailPage id={api.IDS.lease} />, source);

    await screen.findByRole('heading', { name: 'Bail BL-2026-0001' });
    const text = norm(document.body.textContent);
    expect(text).toContain('01/01/2027');
    expect(text).not.toContain('Aucune révision prévue');
  });

  it('annonce un bail non affichable au lieu de montrer des montants inventés', async () => {
    const foreign = { ...api.leaseDetail, currency: 'XOF' };
    const { source } = apiSource({
      [`GET ${org('/leases')}`]: (call) => (call.search.get('archived') === '1' ? { body: api.pageOf([]) } : { body: api.pageOf([foreign]) }),
      [`GET ${lease(api.IDS.lease)}`]: { body: api.detailResponse(foreign) },
    });
    renderApi(<BailDetailPage id={api.IDS.lease} />, source);

    expect(await screen.findByText('Ce bail n’est pas affichable')).toBeTruthy();
    expect(norm(document.body.textContent)).not.toContain('Loyer charges comprises');
  });
});

describe('écrans sans route serveur', () => {
  it.each([
    ['états des lieux', <EtatsLieuxPage key="b" />],
    ['réservations', <ReservationsPage key="c" />],
  ])('%s : état « bientôt disponible », sans appel serveur ni donnée d’exemple', (_name, page) => {
    const { source, calls } = apiSource({});
    renderApi(page, source);
    expect(screen.getByText('Bientôt disponible')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('mutations sans route serveur', () => {
  it('échouent explicitement au lieu de créer une donnée de démonstration', async () => {
    const { source, calls } = apiSource({});
    const client = newClient();
    const { result } = renderHook(
      () => ({
        importLeases: useImportLeases(),
        setExitStep: useSetExitStep(api.IDS.lease),
        markReturned: useMarkReturned(api.IDS.lease),
        createEdl: useCreateEdl(),
        createReservation: useCreateReservation(),
      }),
      { wrapper: ({ children }) => <Providers source={source} client={client}>{children}</Providers> },
    );
    const edl = { type: 'entree' as const, unitId: api.IDS.unit, date: '2026-11-16', tenantId: api.IDS.tenant, templateId: 'grille', rooms: ['Séjour'] };
    const stay = { unitId: api.IDS.unit, guest: 'Awa Diallo', arrival: '2026-12-01', departure: '2026-12-05', amount: '400', deposit: '0', paid: '0', mode: 'confirmee' as const, optionUntil: '' };

    const attempts = [
      result.current.importLeases.mutateAsync([]),
      result.current.setExitStep.mutateAsync({ stepId: 'restitution', status: 'fait' }),
      result.current.markReturned.mutateAsync({ tenantName: 'Awa Diallo', tenantCivility: 'Mme' }),
      result.current.createEdl.mutateAsync({ input: edl, asDraft: true }),
      result.current.createReservation.mutateAsync(stay),
    ];

    for (const attempt of attempts) await expect(attempt).rejects.toMatchObject({ kind: 'unsupported' });
    expect(calls).toHaveLength(0);
  });
});

describe('révision du loyer en mode API', () => {
  it('affiche le message de version périmée dans le champ', async () => {
    const { source } = apiSource({
      ...listRoutes(),
      [`GET ${org('/catalog/vocabularies/lease_component/terms')}`]: { body: api.catalogTermsResponse },
      [`POST ${lease(api.IDS.lease)}/terms/revise`]: { status: 409, body: api.staleProblem },
    });
    const leases = (await source.leases()) as Parameters<typeof ReviseRentDialog>[0]['lease'][];
    renderApi(<ReviseRentDialog lease={leases[0] ?? null} onClose={vi.fn()} />, source);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    const field = await screen.findByLabelText(/Nouveau loyer/);
    await user.clear(field);
    await user.type(field, '900');
    await user.click(screen.getByRole('button', { name: 'Réviser le loyer' }));

    expect(await screen.findByText(/Ce bail a été modifié entre-temps\. Rechargez la page/)).toBeTruthy();
  });
});

describe('mode démonstration inchangé', () => {
  it('ne déclare aucune fonction indisponible et garde la gestion locale des occupations', () => {
    const demo = createDemoBauxSource();
    expect(demo.unavailableInApiMode).toEqual([]);
    expect(demo.derivesOccupancy).toBe(false);
  });

  it('garde l’import, la colonne Solde et les écrans complets', async () => {
    renderLot(<BauxPage />);
    const table = await screen.findByRole('table', { name: 'Baux' });
    expect(within(table).getAllByRole('columnheader').map((cell) => norm(cell.textContent))).toContain('Solde');
    expect(screen.getByRole('button', { name: 'Importer' })).toBeTruthy();
  });

  it('rend les écrans gatés tels quels avec la source de démonstration', async () => {
    renderLot(<ReservationsPage />);
    expect(await screen.findByRole('heading', { name: 'Réservations' })).toBeTruthy();
    expect(screen.queryByText('Bientôt disponible')).toBeNull();
  });
});
