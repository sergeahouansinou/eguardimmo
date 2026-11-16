import { describe, expect, it } from 'vitest';
import { BiensStaleVersionError } from '../errors';
import type { ImmeubleValues } from '../schemas/immeubles';
import type { LotValues } from '../schemas/lots';
import * as api from './responses.fixtures';
import { org, readRoutes, setup } from './support';

const lotValues: LotValues = {
  name: 'B07',
  type: 'appartement',
  immeubleId: api.IDS.property,
  address: '12 rue des Lilas',
  complement: '',
  postalCode: '75011',
  city: 'Paris',
  surface: 54.35,
  rooms: 3,
  floor: '2',
  elevator: true,
  heating: 'gaz',
  amenities: ['balcon'],
  rent: 82000,
  charges: 6000,
  photoNames: ['salon.jpg'],
};

const immeubleValues: ImmeubleValues = { name: 'Villa Neuve', address: '4 rue Neuve', postalCode: '31000', city: 'Toulouse', country: 'France', repartition: 'surface', siteType: 'house', photoNames: [] };

const created = { ...api.unitDetail, id: '01935b20-0000-7000-8000-0000000000aa', reference: 'B07', floor: 2 };

describe('création de lot', () => {
  const routes = () => ({
    ...readRoutes(),
    [`POST ${org('/units')}`]: { status: 201, body: api.detail(created) },
  });

  it('envoie les unités du serveur : surface en centièmes, type du catalogue, caractéristiques du logement', async () => {
    const { source, callsTo } = setup(routes());
    expect(await source.createLot(lotValues)).toEqual({ id: created.id });
    expect(callsTo('POST', org('/units'))[0]?.body).toEqual({
      property_id: api.IDS.property,
      unit_type_term_id: api.IDS.termApartment,
      reference: 'B07',
      floor: 2,
      surface_hundredths: 5435,
      characteristics: { rooms: 3, has_elevator: true },
    });
  });

  it('n’envoie ni loyer, ni chauffage, ni prestations, ni photos : le serveur ne les porte pas', async () => {
    const { source, callsTo } = setup(routes());
    await source.createLot(lotValues);
    const body = callsTo('POST', org('/units'))[0]?.body;
    expect(Object.keys(body as object).sort()).toEqual(['characteristics', 'floor', 'property_id', 'reference', 'surface_hundredths', 'unit_type_term_id']);
  });

  it('refuse un identifiant d’immeuble qui n’est pas un UUID serveur', async () => {
    const { source, callsTo } = setup(routes());
    await expect(source.createLot({ ...lotValues, immeubleId: 'les-tilleuls' })).rejects.toMatchObject({ kind: 'invalid' });
    expect(callsTo('POST', org('/units'))).toHaveLength(0);
  });

  it.each([
    ['étage non entier', { floor: '3e' }, 'Étage'],
    ['étage hors limites', { floor: '301' }, 'Étage'],
    ['surface nulle', { surface: 0.001 }, 'Surface'],
  ])('refuse %s avant tout appel', async (_name, patch, fragment) => {
    const { source, callsTo } = setup(routes());
    await expect(source.createLot({ ...lotValues, ...patch })).rejects.toMatchObject({ kind: 'invalid', message: expect.stringContaining(fragment) as string });
    expect(callsTo('POST', org('/units'))).toHaveLength(0);
  });

  it('refuse pièces et ascenseur sur un lot qui n’est pas un logement', async () => {
    const { source } = setup(routes());
    await expect(source.createLot({ ...lotValues, type: 'parking' })).rejects.toMatchObject({ kind: 'invalid', message: expect.stringContaining('logements') as string });
  });

  it('accepte un parking sans caractéristiques de logement', async () => {
    const { source, callsTo } = setup(routes());
    await source.createLot({ ...lotValues, type: 'parking', rooms: null, elevator: false, surface: null, floor: '' });
    expect(callsTo('POST', org('/units'))[0]?.body).toMatchObject({ unit_type_term_id: api.IDS.termParking, floor: null, surface_hundredths: null, characteristics: {} });
  });

  it('explique qu’un type archivé ou absent du catalogue n’est pas ouvert', async () => {
    const { source } = setup(routes());
    await expect(source.createLot({ ...lotValues, type: 'bureau' })).rejects.toMatchObject({ kind: 'invalid', code: 'unit_type_unavailable' });
    await expect(source.createLot({ ...lotValues, type: 'autre' })).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('remonte le refus 422 du serveur avec le message du champ', async () => {
    const failing = { ...routes(), [`POST ${org('/units')}`]: { status: 422, body: api.problem(422, 'validation_failed', 'Données invalides', 'Les données sont invalides.', { errors: { reference: ['La référence est obligatoire.'] } }) } };
    const { source } = setup(failing);
    await expect(source.createLot(lotValues)).rejects.toMatchObject({ kind: 'invalid', status: 422, message: 'La référence est obligatoire.', fieldErrors: { reference: ['La référence est obligatoire.'] } });
  });

  it('remonte le conflit de référence tel que le serveur le décrit', async () => {
    const failing = { ...routes(), [`POST ${org('/units')}`]: { status: 409, body: api.problem(409, 'unit_reference_taken', 'Référence déjà utilisée', 'Un autre lot de ce site porte déjà cette référence.') } };
    const { source } = setup(failing);
    await expect(source.createLot(lotValues)).rejects.toMatchObject({ kind: 'conflict', code: 'unit_reference_taken', message: 'Un autre lot de ce site porte déjà cette référence.' });
  });
});

describe('modification de lot', () => {
  const routes = () => ({
    ...readRoutes(),
    [`PATCH ${org(`/units/${api.IDS.unit}`)}`]: { body: api.detail({ ...api.unitDetail, reference: 'A12bis', lock_version: 8 }) },
  });
  const edit: LotValues = { ...lotValues, name: 'A12bis', floor: '3', surface: 54.35, rooms: 4 };

  it('envoie la version lue et fusionne les caractéristiques existantes', async () => {
    const { source, callsTo } = setup(routes());
    await source.lot(api.IDS.unit);
    await source.updateLot(api.IDS.unit, edit);
    expect(callsTo('PATCH', org(`/units/${api.IDS.unit}`))[0]?.body).toEqual({
      lock_version: 7,
      unit_type_term_id: api.IDS.termApartment,
      reference: 'A12bis',
      floor: 3,
      surface_hundredths: 5435,
      characteristics: { rooms: 4, has_elevator: true, construction_year: 1998 },
    });
  });

  it('enchaîne deux modifications avec la version renvoyée par la première', async () => {
    const { source, callsTo } = setup(routes());
    await source.updateLot(api.IDS.unit, edit);
    await source.updateLot(api.IDS.unit, edit);
    expect(callsTo('PATCH', org(`/units/${api.IDS.unit}`)).map((call) => (call.body as { lock_version: number }).lock_version)).toEqual([7, 8]);
  });

  it('retire le nombre de pièces quand il est vidé', async () => {
    const { source, callsTo } = setup(routes());
    await source.updateLot(api.IDS.unit, { ...edit, rooms: null });
    expect((callsTo('PATCH', org(`/units/${api.IDS.unit}`))[0]?.body as { characteristics: object }).characteristics).toMatchObject({ rooms: null });
  });

  it('lit le lot quand il n’est pas connu et garde son type personnalisé', async () => {
    const custom = { ...routes(), [`GET ${org(`/units/${api.IDS.unitArchived}`)}`]: { body: api.detail({ ...api.unitArchived, tags: [] }) }, [`PATCH ${org(`/units/${api.IDS.unitArchived}`)}`]: { body: api.detail({ ...api.unitArchived, tags: [] }) } };
    const { source, callsTo } = setup(custom);
    await source.updateLot(api.IDS.unitArchived, { ...edit, type: 'autre' });
    expect(callsTo('PATCH', org(`/units/${api.IDS.unitArchived}`))[0]?.body).toMatchObject({ lock_version: 3, unit_type_term_id: api.IDS.termCustom });
  });

  it('refuse de changer un lot d’immeuble', async () => {
    const { source, callsTo } = setup(routes());
    await expect(source.updateLot(api.IDS.unit, { ...edit, immeubleId: api.IDS.propertyBj })).rejects.toMatchObject({ kind: 'invalid', code: 'unit_property_fixed' });
    expect(callsTo('PATCH', org(`/units/${api.IDS.unit}`))).toHaveLength(0);
  });

  it('signale une modification concurrente et oublie la version périmée', async () => {
    let attempt = 0;
    const racing = {
      ...routes(),
      [`PATCH ${org(`/units/${api.IDS.unit}`)}`]: () => {
        attempt += 1;
        return attempt === 1 ? { status: 409, body: api.staleUnitProblem } : { body: api.detail({ ...api.unitDetail, lock_version: 12 }) };
      },
      [`GET ${org(`/units/${api.IDS.unit}`)}`]: (call: unknown) => ({ body: api.detail({ ...api.unitDetail, lock_version: attempt === 0 ? 7 : 11, ...(call ? {} : {}) }) }),
    };
    const { source, callsTo } = setup(racing);
    await source.updateLot(api.IDS.unit, edit).catch((error: unknown) => {
      expect(error).toBeInstanceOf(BiensStaleVersionError);
      expect(error).toMatchObject({ kind: 'stale_version', status: 409, message: expect.stringContaining('modifié entre-temps') as string });
    });
    await source.updateLot(api.IDS.unit, edit);
    expect(callsTo('PATCH', org(`/units/${api.IDS.unit}`)).map((call) => (call.body as { lock_version: number }).lock_version)).toEqual([7, 11]);
  });
});

describe('archivage et restauration', () => {
  it('archive et restaure un lot', async () => {
    const { source, callsTo } = setup({
      [`POST ${org(`/units/${api.IDS.unit}/archive`)}`]: { body: api.detail({ ...api.unitDetail, archived_at: '2026-11-16T10:00:00+00:00' }) },
      [`DELETE ${org(`/units/${api.IDS.unit}/archive`)}`]: { body: api.detail(api.unitDetail) },
    });
    await source.setLotsArchived([api.IDS.unit], true);
    await source.setLotsArchived([api.IDS.unit], false);
    expect(callsTo('POST', org(`/units/${api.IDS.unit}/archive`))).toHaveLength(1);
    expect(callsTo('DELETE', org(`/units/${api.IDS.unit}/archive`))).toHaveLength(1);
  });

  it('archive plusieurs lots et signale ceux qui échouent', async () => {
    const { source, callsTo } = setup({
      [`POST ${org(`/units/${api.IDS.unit}/archive`)}`]: { body: api.detail(api.unitDetail) },
      [`POST ${org(`/units/${api.IDS.unitNotice}/archive`)}`]: { status: 409, body: api.problem(409, 'unit_has_active_annexes', 'Lot avec des annexes actives', 'Archivez d’abord les annexes actives de ce lot.') },
    });
    await expect(source.setLotsArchived([api.IDS.unit, api.IDS.unitNotice], true)).rejects.toMatchObject({ message: '1 bien(s) sur 2 n’ont pas pu être archivés : Archivez d’abord les annexes actives de ce lot.' });
    expect(callsTo('POST', org(`/units/${api.IDS.unit}/archive`))).toHaveLength(1);
  });

  it('archive et restaure un immeuble', async () => {
    const { source, callsTo } = setup({
      [`POST ${org(`/properties/${api.IDS.property}/archive`)}`]: { body: api.detail({ ...api.propertyDetail, archived_at: '2026-11-16T10:00:00+00:00', lock_version: 5 }) },
      [`DELETE ${org(`/properties/${api.IDS.property}/archive`)}`]: { body: api.detail(api.propertyDetail) },
    });
    await source.setImmeubleArchived(api.IDS.property, true);
    await source.setImmeubleArchived(api.IDS.property, false);
    expect(callsTo('POST', org(`/properties/${api.IDS.property}/archive`))).toHaveLength(1);
    expect(callsTo('DELETE', org(`/properties/${api.IDS.property}/archive`))).toHaveLength(1);
  });

  it('remonte le refus d’archiver un immeuble qui a des lots actifs', async () => {
    const { source } = setup({ [`POST ${org(`/properties/${api.IDS.property}/archive`)}`]: { status: 409, body: api.problem(409, 'property_has_active_units', 'Site avec des lots actifs', 'Archivez d’abord les lots actifs de ce site.') } });
    await expect(source.setImmeubleArchived(api.IDS.property, true)).rejects.toMatchObject({ kind: 'conflict', message: 'Archivez d’abord les lots actifs de ce site.' });
  });
});

describe('immeubles', () => {
  const routes = () => ({
    ...readRoutes(),
    [`POST ${org('/properties')}`]: { status: 201, body: api.detail({ ...api.propertyBjDetail, id: '01935b30-0000-7000-8000-0000000000bb' }) },
    [`PATCH ${org(`/properties/${api.IDS.property}`)}`]: { body: api.detail({ ...api.propertyDetail, lock_version: 5 }) },
  });

  it('crée avec le pays en code ISO et le type de site', async () => {
    const { source, callsTo } = setup(routes());
    expect(await source.createImmeuble(immeubleValues)).toEqual({ id: '01935b30-0000-7000-8000-0000000000bb' });
    expect(callsTo('POST', org('/properties'))[0]?.body).toEqual({
      name: 'Villa Neuve',
      type: 'house',
      address: { line1: '4 rue Neuve', line2: null, postal_code: '31000', city: 'Toulouse', country: 'FR' },
    });
  });

  it('crée un immeuble par défaut quand aucun type n’est indiqué', async () => {
    const { source, callsTo } = setup(routes());
    await source.createImmeuble({ ...immeubleValues, siteType: undefined, country: 'Bénin' });
    expect(callsTo('POST', org('/properties'))[0]?.body).toMatchObject({ type: 'building', address: { country: 'BJ' } });
  });

  it('refuse un pays inconnu avant tout appel', async () => {
    const { source, callsTo } = setup(routes());
    await expect(source.createImmeuble({ ...immeubleValues, country: 'Atlantide' })).rejects.toMatchObject({ kind: 'invalid', message: expect.stringContaining('Atlantide') as string });
    expect(callsTo('POST', org('/properties'))).toHaveLength(0);
  });

  it('modifie en gardant le complément d’adresse et la version lue', async () => {
    const { source, callsTo } = setup(routes());
    await source.immeuble(api.IDS.property);
    await source.updateImmeuble(api.IDS.property, { ...immeubleValues, name: 'Résidence du Quai', country: 'FR', siteType: 'building' });
    expect(callsTo('PATCH', org(`/properties/${api.IDS.property}`))[0]?.body).toEqual({
      lock_version: 4,
      name: 'Résidence du Quai',
      type: 'building',
      address: { line1: '4 rue Neuve', line2: 'Bâtiment B', postal_code: '31000', city: 'Toulouse', country: 'FR' },
    });
  });

  it('signale une modification concurrente d’immeuble', async () => {
    const racing = { ...routes(), [`PATCH ${org(`/properties/${api.IDS.property}`)}`]: { status: 409, body: api.stalePropertyProblem } };
    const { source } = setup(racing);
    await expect(source.updateImmeuble(api.IDS.property, immeubleValues)).rejects.toBeInstanceOf(BiensStaleVersionError);
  });
});

describe('propriétaires', () => {
  it('déclare un propriétaire en points de base', async () => {
    const { source, callsTo } = setup({ [`POST ${org(`/units/${api.IDS.unit}/ownerships`)}`]: { status: 201, body: api.detail(api.ownership) } });
    const result = await source.addOwnership(api.IDS.unit, { partyId: api.IDS.owner, shareBp: 5000, nature: 'full', validFrom: '2023-06-15', validTo: null });
    expect(result).toMatchObject({ id: api.IDS.ownership, shareBp: 10000 });
    expect(callsTo('POST', org(`/units/${api.IDS.unit}/ownerships`))[0]?.body).toEqual({ party_id: api.IDS.owner, share_bp: 5000, nature: 'full', valid_from: '2023-06-15' });
  });

  it.each([[0], [10001], [33.3]])('refuse la quote-part %s avant tout appel', async (shareBp) => {
    const { source, calls } = setup({});
    await expect(source.addOwnership(api.IDS.unit, { partyId: api.IDS.owner, shareBp, nature: 'full', validFrom: '2023-06-15', validTo: null })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('termine une propriété et remonte un dépassement de quotes-parts', async () => {
    const path = org(`/units/${api.IDS.unit}/ownerships/${api.IDS.ownership}/end`);
    const { source, callsTo } = setup({ [`POST ${path}`]: { body: api.detail({ ...api.ownership, valid_to: '2026-12-31' }) } });
    expect(await source.endOwnership(api.IDS.unit, api.IDS.ownership, '2026-12-31')).toMatchObject({ validTo: '2026-12-31' });
    expect(callsTo('POST', path)[0]?.body).toEqual({ valid_to: '2026-12-31' });

    const over = setup({ [`POST ${org(`/units/${api.IDS.unit}/ownerships`)}`]: { status: 409, body: api.problem(409, 'ownership_share_exceeded', 'Quotes-parts dépassées', 'Sur cette période et pour cette nature de droit, les quotes-parts du lot dépasseraient 100 %.') } });
    await expect(over.source.addOwnership(api.IDS.unit, { partyId: api.IDS.owner, shareBp: 6000, nature: 'full', validFrom: '2024-01-01', validTo: null })).rejects.toMatchObject({ kind: 'conflict', code: 'ownership_share_exceeded' });
  });
});
