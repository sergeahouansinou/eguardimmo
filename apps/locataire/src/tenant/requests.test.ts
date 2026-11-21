import { createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { UnexpectedResponseError } from './errors';
import { fetchLease, fetchLeasesPage, fetchLinks, fetchMe, fetchTenantProfile, revokeLink } from './requests';
import {
  LEASE_ID,
  LEASE_LOIRE_ID,
  ME,
  NO_PROFILES,
  ORG_LOIRE,
  ORG_PORT,
  PARTY_LOIRE_ID,
  PARTY_PORT_ID,
  TENANT_PROFILES,
  detail,
  leasePage,
  links,
  summary,
} from './responses.fixtures';

interface Seen {
  method: string;
  url: URL;
}

function clientFor(body: unknown, status = 200) {
  const seen: Seen[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    seen.push({ method: init?.method ?? 'GET', url: new URL(input instanceof Request ? input.url : String(input)) });
    return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  });
  return { client: createApiClient({ baseUrl: 'http://api.test', fetchImpl, readCookie: () => 'xsrf' }), seen };
}

describe('baux du locataire', () => {
  it('lit la première page sans curseur et mappe le résumé', async () => {
    const { client, seen } = clientFor(leasePage([summary(), summary({ id: LEASE_LOIRE_ID, organization: ORG_LOIRE, main_unit: null, end_date: null, access: { until: null, in_grace: false } })], 'abc'));

    const page = await fetchLeasesPage(client, null);

    expect(seen[0]?.method).toBe('GET');
    expect(seen[0]?.url.pathname).toBe('/api/v1/tenant/leases');
    expect(seen[0]?.url.search).toBe('');
    expect(page.nextCursor).toBe('abc');
    expect(page.items[0]).toEqual({
      id: LEASE_ID,
      reference: 'BAIL-2026-001',
      regimeKey: 'fr.residential.unfurnished',
      phase: 'running',
      startsOn: '2026-01-01',
      endsOn: '2028-12-31',
      organization: ORG_PORT,
      mainUnit: {
        reference: 'A12',
        type: 'apartment',
        floor: 2,
        surfaceHundredths: 4250,
        propertyName: 'Résidence du Port',
        address: '12 quai du Port, 44000 Nantes',
      },
      accessUntil: '2029-12-31',
      inGrace: false,
    });
    expect(page.items[1]).toMatchObject({ organization: ORG_LOIRE, mainUnit: null, endsOn: null, accessUntil: null });
  });

  it('transmet le curseur et signale la dernière page', async () => {
    const { client, seen } = clientFor(leasePage([summary()]));

    const page = await fetchLeasesPage(client, 'eyJzdGFydHNfb24iOiIyMDI2In0');

    expect(seen[0]?.url.searchParams.get('cursor')).toBe('eyJzdGFydHNfb24iOiIyMDI2In0');
    expect(page.nextCursor).toBeNull();
  });

  it('expose la période de grâce renvoyée par le serveur', async () => {
    const { client } = clientFor(leasePage([summary({ phase: 'ended', status: 'terminated', access: { until: '2027-06-30', in_grace: true } })]));

    const page = await fetchLeasesPage(client, null);

    expect(page.items[0]).toMatchObject({ phase: 'ended', inGrace: true, accessUntil: '2027-06-30' });
  });

  it('lit le détail d’un bail avec les montants {amount, currency}', async () => {
    const { client, seen } = clientFor(detail());

    const lease = await fetchLease(client, LEASE_ID);

    expect(seen[0]?.url.pathname).toBe(`/api/v1/tenant/leases/${LEASE_ID}`);
    expect(lease).toMatchObject({ durationMonths: 36, tacitRenewal: true, periodicity: 'monthly', billingTiming: 'advance', dueDay: 5, paymentMethod: 'transfer', signedOn: '2025-12-15', notice: null, termsOn: '2026-11-16' });
    expect(lease.terms).toEqual([
      { key: 'rent', label: 'Loyer', semanticKey: 'rent', amount: { amount: 65000, currency: 'EUR' }, vatBasisPoints: 0, indexed: true },
      { key: 'charges_provision', label: 'Provision sur charges', semanticKey: 'charges_provision', amount: { amount: 8000, currency: 'EUR' }, vatBasisPoints: 0, indexed: false },
    ]);
    expect(lease.parties.map((party) => [party.name, party.role, party.isMe, party.jointLiability])).toEqual([
      ['Awa Koné', 'tenant', true, true],
      ['Moussa Diallo', 'tenant', false, true],
      ['Fatou Sow', 'guarantor', false, false],
    ]);
    expect(lease.units[0]).toMatchObject({ isMain: true, from: '2026-01-01', to: null, unit: { reference: 'A12' } });
  });

  it('mappe le préavis et une composante inconnue', async () => {
    const { client } = clientFor(
      detail({
        notice: { received_on: '2026-10-01', given_by: 'tenant', departure_on: '2027-01-01' },
        terms: [{ component: null, amount: { amount: 100, currency: 'XOF' }, vat_bp: 1800, indexed: false, valid_from: '2026-01-01', end_date: null }],
      }),
    );

    const lease = await fetchLease(client, LEASE_ID);

    expect(lease.notice).toEqual({ receivedOn: '2026-10-01', givenBy: 'tenant', departureOn: '2027-01-01' });
    expect(lease.terms[0]).toEqual({ key: null, label: null, semanticKey: null, amount: { amount: 100, currency: 'XOF' }, vatBasisPoints: 1800, indexed: false });
  });

  it('refuse une réponse qui n’a pas la forme du contrat', async () => {
    const broken = detail();
    const { client } = clientFor({ data: { ...broken.data, terms: [{ amount: 650 }] } });

    await expect(fetchLease(client, LEASE_ID)).rejects.toBeInstanceOf(UnexpectedResponseError);
    await expect(fetchLeasesPage(clientFor({ data: [{ id: 'x' }], meta: {} }).client, null)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('liens d’accès du locataire', () => {
  it('liste les rattachements avec l’identifiant de la fiche et l’organisation', async () => {
    const { client, seen } = clientFor(links([{ id: PARTY_PORT_ID, organization: ORG_PORT }, { id: PARTY_LOIRE_ID, organization: { id: ORG_LOIRE.id, name: null } }]));

    const result = await fetchLinks(client);

    expect(seen[0]?.url.pathname).toBe('/api/v1/tenant/links');
    expect(result).toEqual([
      { partyId: PARTY_PORT_ID, organization: ORG_PORT },
      { partyId: PARTY_LOIRE_ID, organization: { id: ORG_LOIRE.id, name: null } },
    ]);
  });

  it('retire un lien par DELETE sur la fiche', async () => {
    const { client, seen } = clientFor(null, 204);

    await expect(revokeLink(client, PARTY_PORT_ID)).resolves.toBeUndefined();

    expect(seen[0]?.method).toBe('DELETE');
    expect(seen[0]?.url.pathname).toBe(`/api/v1/tenant/links/${PARTY_PORT_ID}`);
  });
});

describe('profil et identité', () => {
  it('trouve le profil locataire parmi les profils', async () => {
    const profile = await fetchTenantProfile(clientFor({ data: [...NO_PROFILES.data, ...TENANT_PROFILES.data] }).client);

    expect(profile).toMatchObject({ space: 'tenant', label: 'Locataire' });
  });

  it('renvoie null sans profil locataire', async () => {
    expect(await fetchTenantProfile(clientFor(NO_PROFILES).client)).toBeNull();
    expect(await fetchTenantProfile(clientFor({ data: [] }).client)).toBeNull();
  });

  it('lit /me', async () => {
    const { client, seen } = clientFor(ME);

    expect(await fetchMe(client)).toEqual({ name: 'Awa Koné', email: 'awa.kone@example.test' });
    expect(seen[0]?.url.pathname).toBe('/api/v1/me');
  });
});
