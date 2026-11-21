import { describe, expect, it } from 'vitest';
import { OrgApiError } from '../../orgapi/errors';
import type { ContactFields, ContactInput, ContactQuery } from '../model';
import type { DirectorySource } from '../source';
import { duplicateCandidatesOf, importFailureOf } from './failures';
import {
  FIXTURE_CATEGORY,
  FIXTURE_IMPORT,
  FIXTURE_LINK,
  FIXTURE_OTHER_PARTY,
  FIXTURE_PARTY,
  FIXTURE_POINT,
  FIXTURE_PROPERTY,
  FIXTURE_TAG,
  FIXTURE_UNIT,
  categoryTermFixture,
  contactPointFixture,
  cursorPageFixture,
  detailFixture,
  duplicatesProblem,
  linkPageFixture,
  personDetailFixture,
  propertyLinkFixture,
  summaryFixture,
  tagFixture,
} from './fixtures';
import { createApiDirectorySource } from './source';
import { TEST_ORG, mockOrgApi, orgPath, problem } from './testing';
import type { MockRoute } from './testing';

const org = (path: string): string => orgPath(TEST_ORG, path);

function build(routes: Record<string, MockRoute>) {
  const api = mockOrgApi(routes);
  const source = createApiDirectorySource({ client: api.client, organizationId: TEST_ORG, role: 'owner', kind: 'agency' }, { fetchImpl: api.fetchImpl });
  return { ...api, source };
}

const query: ContactQuery = { cursor: null, search: '', categoryId: null, kind: null, status: 'active' };
const fields: ContactFields = {
  kind: 'person',
  lastName: 'Sanvi',
  firstName: 'Rodrigue',
  companyName: null,
  address: null,
  language: 'fr',
  note: null,
  categoryIds: [FIXTURE_CATEGORY],
  tagIds: [FIXTURE_TAG],
};
const input: ContactInput = { ...fields, contactPoints: [{ type: 'email', value: ' rodrigue@exemple.fr ', label: 'Rodrigue', primary: true }] };

interface Operation {
  name: string;
  route: string;
  conflict: { code: string; kind: 'conflict' | 'stale' };
  run: (source: DirectorySource) => Promise<unknown>;
}

const operations: Operation[] = [
  { name: 'liste', route: 'GET /parties', conflict: { code: 'x_conflict', kind: 'conflict' }, run: (s) => s.contacts(query) },
  { name: 'fiche', route: `GET /parties/${FIXTURE_PARTY}`, conflict: { code: 'x_conflict', kind: 'conflict' }, run: (s) => s.contact(FIXTURE_PARTY) },
  { name: 'création', route: 'POST /parties', conflict: { code: 'party_possible_duplicate', kind: 'conflict' }, run: (s) => s.createContact(input, false) },
  { name: 'modification', route: `PATCH /parties/${FIXTURE_PARTY}`, conflict: { code: 'party_version_conflict', kind: 'stale' }, run: (s) => s.updateContact(FIXTURE_PARTY, 3, fields) },
  { name: 'archivage', route: `POST /parties/${FIXTURE_PARTY}/archive`, conflict: { code: 'party_anonymized', kind: 'conflict' }, run: (s) => s.archiveContact(FIXTURE_PARTY) },
  { name: 'restauration', route: `DELETE /parties/${FIXTURE_PARTY}/archive`, conflict: { code: 'party_anonymized', kind: 'conflict' }, run: (s) => s.restoreContact(FIXTURE_PARTY) },
  { name: 'anonymisation', route: `POST /parties/${FIXTURE_PARTY}/anonymization`, conflict: { code: 'party_anonymized', kind: 'conflict' }, run: (s) => s.anonymizeContact(FIXTURE_PARTY) },
  { name: 'ajout de coordonnée', route: `POST /parties/${FIXTURE_PARTY}/contact-points`, conflict: { code: 'contact_point_exists', kind: 'conflict' }, run: (s) => s.addContactPoint(FIXTURE_PARTY, { type: 'phone', value: '+33612401877', label: null, primary: false }) },
  { name: 'modification de coordonnée', route: `PATCH /parties/${FIXTURE_PARTY}/contact-points/${FIXTURE_POINT}`, conflict: { code: 'contact_point_exists', kind: 'conflict' }, run: (s) => s.updateContactPoint(FIXTURE_PARTY, FIXTURE_POINT, { value: 'a@b.fr' }) },
  { name: 'import', route: 'POST /parties/import', conflict: { code: 'party_possible_duplicate', kind: 'conflict' }, run: (s) => s.importContacts([{ kind: 'person', last_name: 'Sanvi' }], FIXTURE_IMPORT, false) },
  { name: 'biens du contact', route: 'GET /property-contacts', conflict: { code: 'x_conflict', kind: 'conflict' }, run: (s) => s.linksOfContact(FIXTURE_PARTY, null) },
  { name: 'contacts d’un bien', route: `GET /properties/${FIXTURE_PROPERTY}/contacts`, conflict: { code: 'x_conflict', kind: 'conflict' }, run: (s) => s.contactsOfProperty(FIXTURE_PROPERTY, null, null) },
  { name: 'rattachement à un bien', route: `POST /properties/${FIXTURE_PROPERTY}/contacts`, conflict: { code: 'property_contact_exists', kind: 'conflict' }, run: (s) => s.addPropertyLink(FIXTURE_PROPERTY, { partyId: FIXTURE_PARTY, unitId: null, categoryId: null }) },
  { name: 'retrait d’un lien', route: `DELETE /properties/${FIXTURE_PROPERTY}/contacts/${FIXTURE_LINK}`, conflict: { code: 'x_conflict', kind: 'conflict' }, run: (s) => s.removePropertyLink(FIXTURE_PROPERTY, FIXTURE_LINK) },
  { name: 'catégories', route: 'GET /catalog/vocabularies/contact_category/terms', conflict: { code: 'x_conflict', kind: 'conflict' }, run: (s) => s.categories() },
  { name: 'étiquettes', route: 'GET /catalog/tags', conflict: { code: 'x_conflict', kind: 'conflict' }, run: (s) => s.tags() },
];

describe('createApiDirectorySource : nominal', () => {
  it('liste les contacts avec filtres et curseur, jamais de paramètre vide', async () => {
    const { source, calls } = build({ ['GET ' + org('/parties')]: { body: cursorPageFixture([summaryFixture()], 'cur-2') } });
    const page = await source.contacts({ cursor: 'cur-1', search: '  sanvi ', categoryId: FIXTURE_CATEGORY, kind: 'company', status: 'archived' });
    expect(page.nextCursor).toBe('cur-2');
    expect(page.items[0]).toMatchObject({ id: FIXTURE_PARTY, kind: 'company', displayName: 'Plomberie Sanvi', primaryEmail: 'contact@plomberie-sanvi.fr', anonymized: false, archivedAt: null });
    const search = calls[0]?.search;
    expect(Object.fromEntries(search?.entries() ?? [])).toEqual({ per_page: '25', cursor: 'cur-1', q: 'sanvi', category: FIXTURE_CATEGORY, kind: 'company', status: 'archived' });
  });

  it('lit une fiche complète', async () => {
    const { source } = build({ ['GET ' + org(`/parties/${FIXTURE_PARTY}`)]: { body: { data: personDetailFixture() } } });
    const contact = await source.contact(FIXTURE_PARTY);
    expect(contact).toMatchObject({
      kind: 'person',
      lastName: 'Sanvi',
      note: 'Intervient sous 48 h',
      lockVersion: 3,
      language: 'fr',
      address: { line1: '12 rue des Lilas', line2: null, postalCode: '75011', city: 'Paris', country: 'FR' },
      primaryEmail: 'contact@plomberie-sanvi.fr',
      primaryPhone: null,
    });
    expect(contact.categories).toEqual([{ id: FIXTURE_CATEGORY, key: 'craftsman', label: 'Artisan', semanticKey: 'craftsman' }]);
    expect(contact.tags[0]?.name).toBe('Plomberie');
    expect(contact.contactPoints[0]).toEqual({ id: FIXTURE_POINT, type: 'email', value: 'contact@plomberie-sanvi.fr', label: 'Rodrigue Sanvi', primary: true });
  });

  it('crée une personne : champs de société omis, coordonnées nettoyées, allow_duplicate absent par défaut', async () => {
    const { source, callsTo } = build({ ['POST ' + org('/parties')]: { status: 201, body: { data: personDetailFixture() } } });
    await source.createContact(input, false);
    expect(callsTo('POST', org('/parties'))[0]?.body).toEqual({
      kind: 'person',
      last_name: 'Sanvi',
      first_name: 'Rodrigue',
      language: 'fr',
      note: null,
      contact_category_ids: [FIXTURE_CATEGORY],
      tag_ids: [FIXTURE_TAG],
      contact_points: [{ type: 'email', value: 'rodrigue@exemple.fr', label: 'Rodrigue', primary: true }],
    });
  });

  it('crée une société avec adresse et allow_duplicate quand le doublon est confirmé', async () => {
    const { source, callsTo } = build({ ['POST ' + org('/parties')]: { status: 201, body: { data: detailFixture() } } });
    await source.createContact(
      { ...input, kind: 'company', lastName: null, firstName: null, companyName: 'Plomberie Sanvi', address: { line1: '1 rue A', line2: null, postalCode: '75001', city: 'Paris', country: 'FR' }, contactPoints: [] },
      true,
    );
    expect(callsTo('POST', org('/parties'))[0]?.body).toMatchObject({
      kind: 'company',
      company_name: 'Plomberie Sanvi',
      address: { line1: '1 rue A', line2: null, postal_code: '75001', city: 'Paris', country: 'FR' },
      allow_duplicate: true,
    });
    expect(callsTo('POST', org('/parties'))[0]?.body).not.toHaveProperty('last_name');
  });

  it('modifie avec lock_version et efface les champs de l’autre type', async () => {
    const { source, callsTo } = build({ ['PATCH ' + org(`/parties/${FIXTURE_PARTY}`)]: { body: { data: personDetailFixture({ lock_version: 4 }) } } });
    const updated = await source.updateContact(FIXTURE_PARTY, 3, fields);
    expect(updated.lockVersion).toBe(4);
    expect(callsTo('PATCH', org(`/parties/${FIXTURE_PARTY}`))[0]?.body).toEqual({
      lock_version: 3,
      last_name: 'Sanvi',
      first_name: 'Rodrigue',
      company_name: null,
      address: null,
      language: 'fr',
      note: null,
      contact_category_ids: [FIXTURE_CATEGORY],
      tag_ids: [FIXTURE_TAG],
    });
  });

  it('archive, restaure puis relit, et anonymise', async () => {
    const archived = detailFixture({ archived_at: '2026-11-21T10:00:00+00:00' });
    const { source, callsTo } = build({
      ['POST ' + org(`/parties/${FIXTURE_PARTY}/archive`)]: { body: { data: archived } },
      ['DELETE ' + org(`/parties/${FIXTURE_PARTY}/archive`)]: { body: { data: detailFixture() } },
      ['GET ' + org(`/parties/${FIXTURE_PARTY}`)]: { body: { data: detailFixture() } },
      ['POST ' + org(`/parties/${FIXTURE_PARTY}/anonymization`)]: { body: { data: detailFixture({ is_anonymized: true, anonymized_at: '2026-11-21T10:00:00+00:00', note: null }) } },
    });
    expect((await source.archiveContact(FIXTURE_PARTY)).archivedAt).toBe('2026-11-21T10:00:00+00:00');
    expect((await source.restoreContact(FIXTURE_PARTY)).archivedAt).toBeNull();
    expect(callsTo('DELETE', org(`/parties/${FIXTURE_PARTY}/archive`))).toHaveLength(1);
    const anonymized = await source.anonymizeContact(FIXTURE_PARTY);
    expect(anonymized).toMatchObject({ anonymized: true, note: null });
  });

  it('ajoute et modifie une coordonnée', async () => {
    const { source, callsTo } = build({
      ['POST ' + org(`/parties/${FIXTURE_PARTY}/contact-points`)]: { status: 201, body: { data: contactPointFixture({ type: 'phone', value: '+33612401877', is_primary: false }) } },
      ['PATCH ' + org(`/parties/${FIXTURE_PARTY}/contact-points/${FIXTURE_POINT}`)]: { body: { data: contactPointFixture({ value: 'nouveau@exemple.fr' }) } },
    });
    expect((await source.addContactPoint(FIXTURE_PARTY, { type: 'phone', value: ' +33612401877 ', label: null, primary: false })).type).toBe('phone');
    expect(callsTo('POST', org(`/parties/${FIXTURE_PARTY}/contact-points`))[0]?.body).toEqual({ type: 'phone', value: '+33612401877', label: null, is_primary: false });
    await source.updateContactPoint(FIXTURE_PARTY, FIXTURE_POINT, { value: 'nouveau@exemple.fr', label: null, primary: true });
    expect(callsTo('PATCH', org(`/parties/${FIXTURE_PARTY}/contact-points/${FIXTURE_POINT}`))[0]?.body).toEqual({ value: 'nouveau@exemple.fr', label: null, is_primary: true });
  });

  it('importe en JSON avec client_id et allow_duplicates', async () => {
    const { source, callsTo } = build({ ['POST ' + org('/parties/import')]: { status: 201, body: { data: { id: FIXTURE_IMPORT, count: 2, party_ids: [FIXTURE_PARTY, FIXTURE_OTHER_PARTY] } } } });
    const result = await source.importContacts([{ kind: 'person', last_name: 'A' }, { kind: 'company', company_name: 'B' }], FIXTURE_IMPORT, true);
    expect(result).toEqual({ id: FIXTURE_IMPORT, count: 2, partyIds: [FIXTURE_PARTY, FIXTURE_OTHER_PARTY] });
    expect(callsTo('POST', org('/parties/import'))[0]?.body).toEqual({ client_id: FIXTURE_IMPORT, allow_duplicates: true, rows: [{ kind: 'person', last_name: 'A' }, { kind: 'company', company_name: 'B' }] });
  });

  it('refuse sans appel réseau un import vide ou de plus de 500 lignes', async () => {
    const { source, calls } = build({});
    await expect(source.importContacts([], FIXTURE_IMPORT, false)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.importContacts(Array.from({ length: 501 }, () => ({ kind: 'person' })), FIXTURE_IMPORT, false)).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('lit les liens d’un contact et ceux d’un bien avec le curseur has_more', async () => {
    const { source, calls } = build({
      ['GET ' + org('/property-contacts')]: { body: { data: [propertyLinkFixture()], meta: { has_more: true, next_cursor: 'c2' } } },
      ['GET ' + org(`/properties/${FIXTURE_PROPERTY}/contacts`)]: { body: linkPageFixture([propertyLinkFixture({ property_name: null, unit_id: FIXTURE_UNIT, unit_reference: 'Apt 12' })]) },
    });
    const links = await source.linksOfContact(FIXTURE_PARTY, null);
    expect(links.nextCursor).toBe('c2');
    expect(links.items[0]).toMatchObject({ id: FIXTURE_LINK, propertyName: 'Résidence des Lilas', party: { displayName: 'Plomberie Sanvi', kind: 'company' }, category: { label: 'Artisan' }, unitId: null, unitReference: null });
    expect(calls[0]?.search.get('party')).toBe(FIXTURE_PARTY);
    const ofProperty = await source.contactsOfProperty(FIXTURE_PROPERTY, FIXTURE_UNIT, null);
    expect(ofProperty.nextCursor).toBeNull();
    expect(ofProperty.items[0]).toMatchObject({ propertyName: null, unitId: FIXTURE_UNIT, unitReference: 'Apt 12' });
    expect(calls[1]?.search.get('unit')).toBe(FIXTURE_UNIT);
  });

  it('rejette un lien dont unit_reference est absent de la réponse', async () => {
    const sansReference = Object.fromEntries(Object.entries(propertyLinkFixture()).filter(([key]) => key !== 'unit_reference'));
    const { source } = build({ ['GET ' + org('/property-contacts')]: { body: linkPageFixture([sansReference]) } });
    await expect(source.linksOfContact(FIXTURE_PARTY, null)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('rattache puis retire un contact d’un bien', async () => {
    const { source, callsTo } = build({
      ['POST ' + org(`/properties/${FIXTURE_PROPERTY}/contacts`)]: { status: 201, body: { data: propertyLinkFixture() } },
      ['DELETE ' + org(`/properties/${FIXTURE_PROPERTY}/contacts/${FIXTURE_LINK}`)]: { status: 204 },
    });
    await source.addPropertyLink(FIXTURE_PROPERTY, { partyId: FIXTURE_PARTY, unitId: FIXTURE_UNIT, categoryId: FIXTURE_CATEGORY });
    expect(callsTo('POST', org(`/properties/${FIXTURE_PROPERTY}/contacts`))[0]?.body).toEqual({ party_id: FIXTURE_PARTY, unit_id: FIXTURE_UNIT, contact_category_id: FIXTURE_CATEGORY });
    await expect(source.removePropertyLink(FIXTURE_PROPERTY, FIXTURE_LINK)).resolves.toBeUndefined();
  });

  it('lit les catégories visibles en français et toutes les pages d’étiquettes', async () => {
    const { source, callsTo } = build({
      ['GET ' + org('/catalog/vocabularies/contact_category/terms')]: {
        body: { data: [categoryTermFixture(), categoryTermFixture({ id: FIXTURE_OTHER_PARTY, key: 'old', labels: { fr: 'Ancienne' }, archived: true }), categoryTermFixture({ id: FIXTURE_UNIT, key: 'hid', labels: { fr: 'Masquée' }, hidden: true })] },
      },
      ['GET ' + org('/catalog/tags')]: (call) => ({ body: call.search.get('cursor') === null ? cursorPageFixture([tagFixture()], 'p2') : cursorPageFixture([tagFixture({ id: FIXTURE_OTHER_PARTY, name: 'Électricité', slug: 'electricite' })]) }),
    });
    expect((await source.categories()).map((term) => term.label)).toEqual(['Artisan']);
    expect((await source.tags()).map((tag) => tag.name)).toEqual(['Plomberie', 'Électricité']);
    expect(callsTo('GET', org('/catalog/tags'))).toHaveLength(2);
  });

  it('rejette une réponse hors contrat plutôt que de l’afficher', async () => {
    const { source } = build({ ['GET ' + org(`/parties/${FIXTURE_PARTY}`)]: { body: { data: detailFixture({ lock_version: 'trois' }) } } });
    await expect(source.contact(FIXTURE_PARTY)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('refuse sans appel réseau un lock_version invalide et une note trop longue', async () => {
    const { source, calls } = build({});
    await expect(source.updateContact(FIXTURE_PARTY, 0, fields)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(source.updateContact(FIXTURE_PARTY, 3, { ...fields, note: 'x'.repeat(501) })).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('échoue sans organisation avant tout appel', async () => {
    const api = mockOrgApi({});
    const source = createApiDirectorySource({ client: api.client, organizationId: null, role: null, kind: null }, { fetchImpl: api.fetchImpl });
    await expect(source.contacts(query)).rejects.toMatchObject({ kind: 'no_organization' });
    expect(api.calls).toHaveLength(0);
  });
});

describe.each(operations)('createApiDirectorySource : erreurs serveur de la $name', ({ route, conflict, run }) => {
  const [method, path] = route.split(' ') as [string, string];
  const attempt = (reply: MockRoute) => run(build({ [`${method} ${org(path)}`]: reply }).source);

  it('401 : session expirée', async () => {
    await expect(attempt(problem(401, 'unauthenticated'))).rejects.toMatchObject({ kind: 'unauthenticated', status: 401 });
  });
  it('403 : rôle insuffisant', async () => {
    await expect(attempt(problem(403, 'role_forbidden'))).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
  });
  it('404 : introuvable', async () => {
    await expect(attempt(problem(404, 'party_not_found'))).rejects.toMatchObject({ kind: 'not_found', status: 404 });
  });
  it('409 : conflit', async () => {
    await expect(attempt(problem(409, conflict.code))).rejects.toMatchObject({ kind: conflict.kind, status: 409, code: conflict.code });
  });
  it('422 : champ invalide', async () => {
    await expect(attempt({ status: 422, body: { type: 'about:blank', title: 'x', status: 422, code: 'validation_failed', detail: 'x', errors: { value: ['Valeur invalide.'] } } })).rejects.toMatchObject({ kind: 'invalid', message: 'Valeur invalide.' });
  });
  it('429 : trop de requêtes, avec délai', async () => {
    await expect(attempt({ ...problem(429, 'too_many_requests'), headers: { 'Retry-After': '30' } })).rejects.toMatchObject({ kind: 'rate_limited', message: expect.stringContaining('30 secondes') as string });
  });
});

describe('échecs structurés', () => {
  it('expose les candidats d’un doublon de création', async () => {
    const { source } = build({ ['POST ' + org('/parties')]: duplicatesProblem() });
    const error: unknown = await source.createContact(input, false).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(OrgApiError);
    expect(duplicatesOrNull(error)).toEqual([{ id: FIXTURE_OTHER_PARTY, displayName: 'Plomberie Sanvi SARL', reasons: ['email', 'name'] }]);
  });

  it('n’invente pas de candidats quand le corps est hors contrat', async () => {
    const { source } = build({ ['POST ' + org('/parties')]: duplicatesProblem([{ id: 'pas-un-uuid' }]) });
    const error: unknown = await source.createContact(input, false).catch((reason: unknown) => reason);
    expect(duplicateCandidatesOf(error)).toBeNull();
  });

  it('expose les lignes en erreur d’un import invalide', async () => {
    const { source } = build({
      ['POST ' + org('/parties/import')]: { status: 422, body: { type: 'about:blank', title: 'Import invalide', status: 422, code: 'party_import_invalid', detail: 'serveur', rows: [{ row: 2, errors: { last_name: ['Ce champ est obligatoire pour ce type de contact.'], 'contact_points.0.value': ['Valeur invalide.'] } }], rows_in_error: 1 } },
    });
    const error: unknown = await source.importContacts([{ kind: 'person' }], FIXTURE_IMPORT, false).catch((reason: unknown) => reason);
    expect(importFailureOf(error)).toEqual({ kind: 'invalid', total: 1, rows: [{ row: 2, messages: ['Ce champ est obligatoire pour ce type de contact.', 'Valeur invalide.'] }] });
    expect(error).toMatchObject({ message: 'Aucun contact n’a été importé : corrigez les lignes signalées.' });
  });

  it('expose les doublons d’un import, avec renvoi aux lignes du même fichier', async () => {
    const { source } = build({
      ['POST ' + org('/parties/import')]: {
        status: 409,
        body: { type: 'about:blank', title: 'Doublon possible', status: 409, code: 'party_possible_duplicate', detail: 'x', rows: [{ row: 3, candidates: [{ id: FIXTURE_OTHER_PARTY, display_name: 'Plomberie Sanvi', reasons: ['phone'] }], duplicate_of_rows: [1] }], rows_in_error: 1 },
      },
    });
    const error: unknown = await source.importContacts([{ kind: 'person' }], FIXTURE_IMPORT, false).catch((reason: unknown) => reason);
    expect(importFailureOf(error)).toEqual({ kind: 'duplicates', total: 1, rows: [{ row: 3, candidates: [{ id: FIXTURE_OTHER_PARTY, displayName: 'Plomberie Sanvi', reasons: ['phone'] }], duplicateOfRows: [1] }] });
  });

  it('ne prend pas une autre erreur pour un échec d’import', () => {
    expect(importFailureOf(new Error('x'))).toBeNull();
    expect(importFailureOf(new OrgApiError('conflict', 'x', { code: 'party_anonymized' }))).toBeNull();
  });
});

function duplicatesOrNull(error: unknown) {
  return duplicateCandidatesOf(error);
}
