import { describe, expect, it } from 'vitest';
import { immeubleDetailSchema, immeublesSchema } from '../schemas/immeubles';
import { leaseSchema, lotDetailSchema, lotsSchema, occupationSchema } from '../schemas/lots';
import * as api from './responses.fixtures';
import { org, readRoutes, setup } from './support';

describe('lots', () => {
  it('charge toutes les pages par curseur et conforme au schéma de l’écran', async () => {
    const { source, callsTo } = setup(readRoutes());
    const data = lotsSchema.parse(await source.lots());

    expect(data.items.map((lot) => lot.name)).toEqual(['A12', 'A13', 'Z99', 'P03']);
    expect(callsTo('GET', org('/units')).map((call) => Object.fromEntries(call.search))).toEqual([
      { per_page: '100', status: 'all' },
      { per_page: '100', status: 'all', cursor: 'page2' },
    ]);
  });

  it('reproduit lot, immeuble, étage, surface et pièces sans float côté serveur', async () => {
    const { source } = setup(readRoutes());
    const [first, second, archived, parking] = lotsSchema.parse(await source.lots()).items;
    expect(first).toMatchObject({ id: api.IDS.unit, immeubleId: api.IDS.property, immeubleName: 'Résidence du Port', type: 'appartement', surface: 54.35, rooms: 3, floor: '3', archived: false });
    expect(second).toMatchObject({ floor: '0', surface: 40, rooms: 2 });
    expect(archived).toMatchObject({ type: 'autre', archived: true, tenant: null, status: null });
    expect(parking).toMatchObject({ type: 'parking', surface: null, rooms: null, floor: '-1' });
  });

  it('croise l’occupation des lots non archivés avec le service des baux', async () => {
    const { source, callsTo } = setup(readRoutes());
    const [first, second, , parking] = lotsSchema.parse(await source.lots()).items;
    const occupancy = callsTo('GET', org('/leases/occupancy'));
    expect(occupancy).toHaveLength(1);
    expect([...(occupancy[0]?.search.values() ?? [])]).toEqual([api.IDS.unit, api.IDS.unitNotice, api.IDS.unitVacant]);
    expect(first).toMatchObject({ tenant: { id: api.IDS.tenant, name: 'Awa Diallo' }, leaseEnd: '2028-12-31', status: null });
    expect(second).toMatchObject({ tenant: { name: 'Marc Chevalier' }, status: 'preavis', leaseEnd: '2026-12-31' });
    expect(parking).toMatchObject({ tenant: null, status: 'a_louer' });
  });

  it('ne montre ni loyer, ni annonce, ni tantièmes que le serveur ne fournit pas', async () => {
    const { source } = setup(readRoutes());
    for (const lot of lotsSchema.parse(await source.lots()).items) {
      expect(lot).toMatchObject({ rent: null, listing: null, tantiemes: null, elevatorShares: null });
    }
  });

  it('déduit la devise du pays du premier immeuble', async () => {
    const routes = readRoutes();
    routes[`GET ${org('/units')}`] = { body: api.pageOf('/units', [{ ...api.unitSummary, property: { id: api.IDS.propertyBj, name: 'Villa Fidjrossè' } }]) };
    routes[`GET ${org(`/properties/${api.IDS.propertyBj}`)}`] = { body: api.detail(api.propertyBjDetail) };
    const { source } = setup(routes);
    expect(lotsSchema.parse(await source.lots()).currency).toBe('XOF');
  });

  it('interroge la devise sur le premier immeuble quand aucun lot n’existe', async () => {
    const routes = readRoutes();
    routes[`GET ${org('/units')}`] = { body: api.pageOf('/units', []) };
    const { source, callsTo } = setup(routes);
    const data = lotsSchema.parse(await source.lots());
    expect(data).toMatchObject({ currency: 'EUR', items: [] });
    expect(callsTo('GET', org('/leases/occupancy'))).toHaveLength(0);
  });

  it('pagine une page à la fois avec filtres de recherche, immeuble, type et statut', async () => {
    const { source, callsTo } = setup({ ...readRoutes(), [`GET ${org('/units')}`]: { body: api.pageOf('/units', [api.unitSummary], 'suite') } });
    const page = await source.lotPage({ search: 'A1', propertyId: api.IDS.property, unitTypeId: api.IDS.termApartment, parentId: api.IDS.unit, rootOnly: true, status: 'archived', cursor: 'abc', perPage: 20 });
    expect(Object.fromEntries(callsTo('GET', org('/units'))[0]?.search ?? [])).toEqual({
      per_page: '20',
      cursor: 'abc',
      q: 'A1',
      property: api.IDS.property,
      unit_type: api.IDS.termApartment,
      parent: api.IDS.unit,
      root: '1',
      status: 'archived',
    });
    expect(page.nextCursor).toBe('suite');
    expect(page.items.map((lot) => lot.name)).toEqual(['A12']);
  });
});

describe('fiche d’un lot', () => {
  it('compose le détail depuis le lot, son immeuble et l’occupation', async () => {
    const { source } = setup(readRoutes());
    const detail = lotDetailSchema.parse(await source.lot(api.IDS.unit));
    expect(detail?.lot.tenant?.name).toBe('Awa Diallo');
    expect(detail?.subtitle).toBe('12 rue des Lilas, 75011 Paris · Étage 3 · Appartement');
    expect(detail?.badges).toEqual([{ label: 'Loué', tone: 'success' }]);
    expect(detail?.brief).toMatchObject({ habitableArea: 54.35, rooms: '3 pièces', floor: '3', builtYear: 1998, rental: null, rentCc: null, dpe: null });
    expect(detail?.counts).toEqual({ diagnostics: null, locations: null, equipements: null, documents: null });
    expect(detail?.values).toMatchObject({ name: 'A12', type: 'appartement', immeubleId: api.IDS.property, address: '12 rue des Lilas', complement: 'Bâtiment B', postalCode: '75011', city: 'Paris', surface: 54.35, rooms: 3, floor: '3', elevator: true, rent: null, charges: null });
    expect(detail?.caracteristiques[0]?.rows.map((row) => row.label)).toEqual(['Type', 'Immeuble', 'Étage', 'Surface', 'Pièces', 'Année de construction', 'Ascenseur']);
    expect(detail?.photos).toEqual([]);
  });

  it('renvoie null sans appeler le serveur quand l’identifiant n’est pas un UUID', async () => {
    const { source, calls } = setup(readRoutes());
    expect(await source.lot('lot-demo')).toBeNull();
    expect(await source.immeuble('immeuble-demo')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('renvoie null sur un 404 du serveur', async () => {
    const missing = '01935b20-0000-7000-8000-0000000000ff';
    const { source } = setup({ [`GET ${org(`/units/${missing}`)}`]: { status: 404, body: api.problem(404, 'unit_not_found', 'Lot introuvable', 'Ce lot n’existe pas dans votre organisation.') } });
    expect(await source.lot(missing)).toBeNull();
  });

  it('ne lit pas l’occupation d’un lot archivé', async () => {
    const routes = readRoutes();
    routes[`GET ${org(`/units/${api.IDS.unitArchived}`)}`] = { body: api.detail({ ...api.unitArchived, tags: [] }) };
    const { source, callsTo } = setup(routes);
    const detail = lotDetailSchema.parse(await source.lot(api.IDS.unitArchived));
    expect(detail?.badges).toEqual([{ label: 'Archivé', tone: 'neutral' }]);
    expect(detail?.lot.type).toBe('autre');
    expect(callsTo('GET', org('/leases/occupancy'))).toHaveLength(0);
  });

  it('refuse une réponse qui ne respecte pas le contrat', async () => {
    const routes = readRoutes();
    routes[`GET ${org(`/units/${api.IDS.unit}`)}`] = { body: api.detail({ ...api.unitDetail, surface_hundredths: 'beaucoup' }) };
    const { source } = setup(routes);
    await expect(source.lot(api.IDS.unit)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });
});

describe('immeubles', () => {
  it('charge toutes les pages, archivés compris', async () => {
    const { source, callsTo } = setup(readRoutes());
    const data = immeublesSchema.parse(await source.immeubles());
    expect(data.items.map((item) => item.name)).toEqual(['Résidence du Port', 'Villa Fidjrossè', 'Ancien site']);
    expect(data.items[0]).toMatchObject({ address: '12 rue des Lilas', postalCode: '75011', city: 'Paris', country: 'France', lots: 3, totalArea: null, repartition: null, copropriete: false, archived: false });
    expect(data.items[1]).toMatchObject({ country: 'Bénin', lots: 1 });
    expect(data.items[2]?.archived).toBe(true);
    expect(callsTo('GET', org('/properties')).map((call) => Object.fromEntries(call.search))).toEqual([
      { per_page: '100', status: 'all' },
      { per_page: '100', status: 'all', cursor: 'p2' },
    ]);
  });

  it('pagine avec filtres de recherche, type et statut', async () => {
    const { source, callsTo } = setup(readRoutes());
    await source.immeublePage({ search: 'port', type: 'house', status: 'archived', cursor: 'x', perPage: 10 });
    expect(Object.fromEntries(callsTo('GET', org('/properties'))[0]?.search ?? [])).toEqual({ per_page: '10', cursor: 'x', q: 'port', type: 'house', status: 'archived' });
  });

  it('compose la fiche sans inventer copropriété, charges ni compteurs', async () => {
    const { source } = setup(readRoutes());
    const detail = immeubleDetailSchema.parse(await source.immeuble(api.IDS.property));
    expect(detail?.subtitle).toBe('12 rue des Lilas, 75011 Paris');
    expect(detail?.currency).toBe('EUR');
    expect(detail?.counts).toEqual({ lots: 3, equipements: null, documents: null, interventions: null });
    expect(detail?.values).toMatchObject({ name: 'Résidence du Port', address: '12 rue des Lilas', country: 'France', siteType: 'building' });
    expect(detail?.keys).toEqual([]);
    expect(detail?.immeuble.copropriete).toBe(false);
  });
});

describe('occupation et bail en cours', () => {
  const routes = () => ({
    ...readRoutes(),
    [`GET ${org('/leases')}`]: (call: { search: URLSearchParams }) =>
      call.search.get('archived') === '1' ? { body: api.pageOf('/leases', [api.leaseSummaryOf(api.leaseEnded)]) } : { body: api.pageOf('/leases', [api.leaseSummaryOf(api.leaseCurrent)]) },
    [`GET ${org(`/leases/${api.IDS.lease}`)}`]: { body: api.detail(api.leaseCurrent) },
    [`GET ${org(`/leases/${api.IDS.leaseOld}`)}`]: { body: api.detail(api.leaseEnded) },
    [`GET ${org(`/units/${api.IDS.unit}/ownerships`)}`]: { body: { data: [api.ownership] } },
  });

  it('reconstitue baux, vacances et loyers à partir des baux du lot', async () => {
    const { source, callsTo } = setup(routes());
    const data = occupationSchema.parse(await source.lotOccupation(api.IDS.unit));

    expect(Object.fromEntries(callsTo('GET', org('/leases'))[0]?.search ?? [])).toMatchObject({ unit: api.IDS.unit });
    expect(data).toMatchObject({ currency: 'EUR', asOf: '2026-11-16', acquisitionDate: '2023-06-15', inspections: [] });
    expect(data.periods.map((period) => [period.kind, period.startDate, period.endDate])).toEqual([
      ['vacance', '2023-06-15', '2024-01-31'],
      ['bail', '2024-02-01', '2025-08-31'],
      ['vacance', '2025-09-01', '2025-12-31'],
      ['bail', '2026-01-01', '2028-12-31'],
    ]);
    expect(data.periods[1]).toMatchObject({ occupant: { name: 'Marc Chevalier' }, status: 'termine', entryRent: 79000, lastRent: 79000, deposit: null, noticeEndsOn: '2025-08-31', leaseType: 'Logement meublé (loi du 6 juillet 1989)' });
    expect(data.periods[3]).toMatchObject({ occupant: { name: 'Awa Diallo' }, status: 'en_cours', entryRent: 85000, lastRent: 88000, deposit: 85000 });
    expect(data.rentSteps).toEqual([
      { year: 2024, rent: 79000, event: null },
      { year: 2026, rent: 88000, event: 'Révision' },
    ]);
  });

  it('renvoie une occupation vide pour un lot sans bail ni propriété déclarée', async () => {
    const empty = { ...routes(), [`GET ${org('/leases')}`]: { body: api.pageOf('/leases', []) }, [`GET ${org(`/units/${api.IDS.unit}/ownerships`)}`]: { body: { data: [] } } };
    const { source } = setup(empty);
    expect(occupationSchema.parse(await source.lotOccupation(api.IDS.unit))).toMatchObject({ periods: [], rentSteps: [] });
  });

  it('expose le bail en cours en unités mineures, sans solde ni révision inventés', async () => {
    const { source } = setup(routes());
    const lease = leaseSchema.parse(await source.lotLease(api.IDS.unit));
    expect(lease).toEqual({
      currency: 'EUR',
      tenant: { id: api.IDS.tenant, name: 'Awa Diallo' },
      leaseHref: `/baux/${api.IDS.lease}`,
      kind: 'Logement vide (loi du 6 juillet 1989)',
      startDate: '2026-01-01',
      endDate: '2028-12-31',
      rentExcl: 88000,
      provisions: 6000,
      deposit: 85000,
      nextRevision: null,
      balance: null,
    });
  });

  it('renvoie null quand le lot est vacant', async () => {
    const { source } = setup(routes());
    expect(leaseSchema.parse(await source.lotLease(api.IDS.unitVacant))).toBeNull();
  });
});

describe('structure et propriétaires', () => {
  it('lit l’arbre des annexes', async () => {
    const { source } = setup({ [`GET ${org(`/units/${api.IDS.unit}/annexes`)}`]: { body: api.unitTreeResponse } });
    expect(await source.lotStructure(api.IDS.unit)).toEqual({
      id: api.IDS.unit,
      name: 'A12',
      type: 'appartement',
      archived: false,
      annexes: [{ id: api.IDS.annex, name: 'P03', type: 'parking', archived: false, annexes: [] }],
    });
  });

  it('liste les propriétaires, à une date donnée si demandé', async () => {
    const { source, callsTo } = setup({ [`GET ${org(`/units/${api.IDS.unit}/ownerships`)}`]: { body: { data: [api.ownership] } } });
    expect(await source.ownerships(api.IDS.unit, '2026-01-01')).toEqual([{ id: api.IDS.ownership, lotId: api.IDS.unit, partyId: api.IDS.owner, shareBp: 10000, nature: 'full', validFrom: '2023-06-15', validTo: null }]);
    expect(Object.fromEntries(callsTo('GET', org(`/units/${api.IDS.unit}/ownerships`))[0]?.search ?? [])).toEqual({ at: '2026-01-01' });
  });
});

describe('lectures sans route serveur', () => {
  it('ne servent aucune donnée d’exemple : elles échouent explicitement', async () => {
    const { source, calls } = setup(readRoutes());
    await expect(source.lotDiagnostics(api.IDS.unit)).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.equipements()).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.readings()).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.inventaires()).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.documents({ kind: 'lot', id: api.IDS.unit })).rejects.toMatchObject({ kind: 'unsupported' });
    expect(calls).toHaveLength(0);
  });
});
