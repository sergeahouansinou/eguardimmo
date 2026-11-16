import { describe, expect, it, vi } from 'vitest';
import { LOCATAIRES_FEATURES } from '../capabilities';
import { tenantDetailSchema, tenantSchema, unitSchema } from '../schemas';
import { LocatairesApiError, TenantStaleVersionError } from './apiErrors';
import * as api from './responses.fixtures';
import { defaultLines, listRoutes, org, party, setup, tenanciesRoute } from './testing';
import type { MockRoute } from './testing';

const form = (overrides: Record<string, unknown> = {}) => ({
  kind: 'particulier',
  civility: '',
  firstName: 'Awa',
  lastName: 'Diallo',
  companyName: '',
  birthDate: '1990-05-12',
  email: 'awa.diallo@example.com',
  phone: '+33 6 00 00 00 01',
  idDocType: '',
  idExpiry: '',
  idFileName: '',
  idNumber: '',
  ...overrides,
});

describe('lecture de la liste', () => {
  it('charge toutes les pages par curseur, archivés compris, et lit les baux en un seul appel', async () => {
    const { source, callsTo } = setup(listRoutes());
    const tenants = ((await source.tenants()) as unknown[]).map((entry) => tenantSchema.parse(entry));

    expect(tenants.map((tenant) => [tenant.id, tenant.state, tenant.status, tenant.unitId])).toEqual([
      [api.IDS.awa, 'en_cours', 'actif', api.IDS.unit],
      [api.IDS.nina, 'sans_bail', 'archive', null],
      [api.IDS.marc, 'preavis', 'actif', api.IDS.unit],
      [api.IDS.lea, 'sans_bail', 'actif', null],
    ]);
    expect(callsTo('GET', org('/parties')).map((call) => Object.fromEntries(call.search))).toEqual([
      { per_page: '100', status: 'all' },
      { per_page: '100', status: 'all', cursor: 'page2' },
      { per_page: '100', status: 'all', category: api.IDS.contactCategory },
    ]);
    const tenancies = callsTo('GET', org('/leases/tenancies'));
    expect(tenancies).toHaveLength(1);
    expect([...(tenancies[0]?.search.values() ?? [])]).toEqual([api.IDS.awa, api.IDS.societe, api.IDS.garant, api.IDS.nina, api.IDS.marc, api.IDS.lea]);
  });

  it('écarte côté serveur les contacts sans bail (prestataires, notaires) mais garde une partie sans bail', async () => {
    const { source, callsTo } = setup(listRoutes());
    const ids = ((await source.tenants()) as { id: string }[]).map((tenant) => tenant.id);

    expect(ids).not.toContain(api.IDS.societe);
    expect(ids).toContain(api.IDS.lea);
    expect(callsTo('GET', org('/catalog/vocabularies/contact_category/terms'))).toHaveLength(1);
  });

  it('garde un contact qui est aussi locataire d’un bail', async () => {
    const { source } = setup({ ...listRoutes(), [`GET ${org('/leases/tenancies')}`]: tenanciesRoute({ ...defaultLines, [api.IDS.societe]: [api.line({ id: api.IDS.leaseOld })] }) });
    const ids = ((await source.tenants()) as { id: string }[]).map((tenant) => tenant.id);
    expect(ids).toContain(api.IDS.societe);
  });

  it('ne lit pas les catégories de contact quand chaque partie a déjà un bail', async () => {
    const lines = { ...defaultLines, [api.IDS.societe]: [api.line({ id: api.IDS.leaseOld })], [api.IDS.lea]: [api.line({ id: api.IDS.leaseOld })] };
    const { source, callsTo } = setup({ ...listRoutes(), [`GET ${org('/leases/tenancies')}`]: tenanciesRoute(lines) });
    await source.tenants();
    expect(callsTo('GET', org('/catalog/vocabularies/contact_category/terms'))).toHaveLength(0);
  });

  it('remonte l’échec de lecture des catégories au lieu d’afficher des contacts comme locataires', async () => {
    const { source } = setup({ ...listRoutes(), [`GET ${org('/catalog/vocabularies/contact_category/terms')}`]: { status: 500, body: api.problem(500, 'server_error', 'Erreur', 'Erreur interne.') } });
    await expect(source.tenants()).rejects.toBeInstanceOf(Error);
  });

  it('écarte un garant seul et ne charge aucune fiche détaillée pour la liste', async () => {
    const { source, calls } = setup(listRoutes());
    const ids = ((await source.tenants()) as { id: string }[]).map((tenant) => tenant.id);
    expect(ids).not.toContain(api.IDS.garant);
    expect(calls.some((call) => call.path === party(api.IDS.awa))).toBe(false);
  });

  it('mutualise deux lectures simultanées', async () => {
    const { source, callsTo } = setup(listRoutes());
    await Promise.all([source.tenants(), source.tenants()]);
    expect(callsTo('GET', org('/parties')).filter((call) => !call.search.has('category'))).toHaveLength(2);
  });

  it('pagine une page à la fois avec recherche, type et statut', async () => {
    const { source, callsTo } = setup({ ...listRoutes(), [`GET ${org('/parties')}`]: { body: api.pageOf([api.awaSummary], 'suite') } });
    const page = await source.tenantPage({ search: 'diallo', kind: 'societe', status: 'archived', cursor: 'abc', perPage: 20 });
    expect(Object.fromEntries(callsTo('GET', org('/parties'))[0]?.search ?? [])).toEqual({ per_page: '20', cursor: 'abc', q: 'diallo', kind: 'company', status: 'archived' });
    expect(page.nextCursor).toBe('suite');
    expect(page.items.map((tenant) => tenant.id)).toEqual([api.IDS.awa]);
  });

  it('demande les contacts actifs par défaut', async () => {
    const { source, callsTo } = setup({ ...listRoutes(), [`GET ${org('/parties')}`]: { body: api.pageOf([]) } });
    await source.tenantPage();
    expect(Object.fromEntries(callsTo('GET', org('/parties'))[0]?.search ?? [])).toEqual({ per_page: '100' });
  });

  it('refuse une réponse qui ne respecte pas le contrat', async () => {
    const { source } = setup({ [`GET ${org('/parties')}`]: { body: { data: [{ ...api.awaSummary, kind: 'robot' }], meta: { per_page: 100, next_cursor: null } } } });
    await expect(source.tenants()).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('lit les lots avec leur vacance', async () => {
    const { source, callsTo } = setup(listRoutes());
    const units = ((await source.units()) as unknown[]).map((entry) => unitSchema.parse(entry));
    expect(units).toEqual([
      { id: api.IDS.unit, label: 'A12', building: 'Résidence du Port', vacant: false },
      { id: api.IDS.annex, label: 'B3', building: 'Résidence du Port', vacant: true },
    ]);
    expect(Object.fromEntries(callsTo('GET', org('/leases/occupancy'))[0]?.search ?? [])).toMatchObject({ 'units[0]': api.IDS.unit, 'units[1]': api.IDS.annex, date: '2026-11-16' });
  });
});

describe('fiche', () => {
  it('lit le détail du locataire avec valeurs masquées', async () => {
    const { source } = setup(listRoutes());
    const tenant = tenantSchema.parse(await source.tenant(api.IDS.awa));
    expect(tenant).toMatchObject({ firstName: 'Awa', lastName: 'Diallo', idLast4: '4567', ibanLast4: '0189', unitId: api.IDS.unit, since: '2026-01-01' });
  });

  it('renvoie null pour un contact inconnu', async () => {
    const { source } = setup({ [`GET ${party(api.IDS.awa)}`]: { status: 404, body: api.problem(404, 'party_not_found', 'Contact introuvable', 'Ce contact n\'existe pas dans votre organisation.') } });
    expect(await source.tenant(api.IDS.awa)).toBeNull();
  });

  it('lit baux, loyer et garants du bail en cours', async () => {
    const { source, callsTo } = setup(listRoutes());
    const detail = tenantDetailSchema.parse(await source.tenantDetail(api.IDS.awa));
    expect(detail).toMatchObject({ rent: 91000, leaseEnd: '2028-12-31', guarantors: [{ title: 'Paul Garant' }] });
    expect(detail.leases).toHaveLength(1);
    expect(callsTo('GET', org(`/leases/${api.IDS.lease}`))).toHaveLength(1);
  });

  it('ne lit aucun bail pour un locataire sans bail en cours', async () => {
    const { source, calls } = setup({ [`GET ${org('/leases/tenancies')}`]: tenanciesRoute({}) });
    const detail = tenantDetailSchema.parse(await source.tenantDetail(api.IDS.societe));
    expect(detail).toMatchObject({ rent: 0, leaseEnd: null, leases: [], guarantors: [] });
    expect(calls.every((call) => !call.path.includes('/leases/0'))).toBe(true);
  });

  it('renvoie null quand la partie est inconnue des baux', async () => {
    const { source } = setup({ [`GET ${org('/leases/tenancies')}`]: { status: 404, body: api.problem(404, 'party_not_found', 'Contact introuvable', 'Ce contact n\'existe pas dans votre organisation.') } });
    expect(await source.tenantDetail(api.IDS.awa)).toBeNull();
  });
});

describe('création', () => {
  const routes = (): Record<string, MockRoute> => ({
    ...listRoutes(),
    [`POST ${org('/parties')}`]: { status: 201, body: api.detailResponse({ ...api.awaDetail, contact_points: [], identifiers: [], lock_version: 1 }) },
    [`POST ${party(api.IDS.awa)}/contact-points`]: { status: 201, body: { data: api.emailPoint } },
    [`POST ${party(api.IDS.awa)}/identifiers`]: { status: 201, body: { data: api.passport } },
  });

  it('crée la personne puis ses coordonnées principales', async () => {
    const { source, callsTo } = setup(routes());
    const created = tenantSchema.parse(await source.createTenant(form()));

    expect(callsTo('POST', org('/parties'))[0]?.body).toEqual({ kind: 'person', last_name: 'Diallo', first_name: 'Awa', birth_date: '1990-05-12', language: 'fr' });
    expect(callsTo('POST', `${party(api.IDS.awa)}/contact-points`).map((call) => call.body)).toEqual([
      { type: 'email', value: 'awa.diallo@example.com', is_primary: true },
      { type: 'phone', value: '+33 6 00 00 00 01', is_primary: true },
    ]);
    expect(created.id).toBe(api.IDS.awa);
  });

  it('classe la pièce dans le pays de l’organisation quand la fiche n’a pas d’adresse, sans pays en dur', async () => {
    const created = api.detailResponse({ ...api.awaDetail, address: null, contact_points: [], identifiers: [], lock_version: 1 });
    const { source, callsTo } = setup({ ...routes(), [`POST ${org('/parties')}`]: { status: 201, body: created } });

    await source.createTenant(form({ idDocType: 'passeport', idNumber: '12ab34567' }));

    expect(callsTo('POST', `${party(api.IDS.awa)}/identifiers`)[0]?.body).toEqual({ scheme: 'passport', country: 'BJ', value: '12ab34567' });
    expect(callsTo('GET', org(''))).toHaveLength(1);
  });

  it('refuse d’enregistrer la pièce quand le pays de l’organisation est illisible', async () => {
    const created = api.detailResponse({ ...api.awaDetail, address: null, contact_points: [], identifiers: [], lock_version: 1 });
    const { source, callsTo } = setup({ ...routes(), [`POST ${org('/parties')}`]: { status: 201, body: created }, [`GET ${org('')}`]: { status: 500, body: api.problem(500, 'server_error', 'Erreur', 'Erreur interne.') } });

    await expect(source.createTenant(form({ idDocType: 'passeport', idNumber: '12ab34567' }))).rejects.toBeInstanceOf(Error);
    expect(callsTo('POST', `${party(api.IDS.awa)}/identifiers`)).toHaveLength(0);
  });

  it('crée une société avec sa raison sociale seule et ajoute la pièce avec son numéro', async () => {
    const { source, callsTo } = setup(routes());
    await source.createTenant(form({ kind: 'societe', companyName: 'Ramonage du Port SARL', firstName: '', lastName: '', birthDate: '', idDocType: 'passeport', idNumber: '12ab34567' }));
    expect(callsTo('POST', org('/parties'))[0]?.body).toEqual({ kind: 'company', company_name: 'Ramonage du Port SARL', language: 'fr' });
    expect(callsTo('POST', `${party(api.IDS.awa)}/identifiers`)[0]?.body).toEqual({ scheme: 'passport', country: 'FR', value: '12ab34567' });
  });

  it('refuse un type de pièce sans numéro avant tout appel', async () => {
    const { source, calls } = setup(routes());
    await expect(source.createTenant(form({ idDocType: 'cni' }))).rejects.toMatchObject({ kind: 'invalid', fieldErrors: { idNumber: ['Indiquez le numéro de la pièce d’identité.'] } });
    expect(calls).toHaveLength(0);
  });

  it('signale une fiche créée dont une coordonnée a été refusée', async () => {
    const { source } = setup({
      ...routes(),
      [`POST ${party(api.IDS.awa)}/contact-points`]: { status: 422, body: api.problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.', { errors: { value: ['Adresse e-mail invalide.'] } }) },
    });
    await expect(source.createTenant(form())).rejects.toMatchObject({ kind: 'invalid', message: expect.stringContaining('La fiche de Awa Diallo est enregistrée') as string });
  });

  it('valide la saisie localement', async () => {
    const { source, calls } = setup(routes());
    await expect(source.createTenant(form({ lastName: '' }))).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });
});

describe('modification', () => {
  const routes = (): Record<string, MockRoute> => ({
    ...listRoutes(),
    [`PATCH ${party(api.IDS.awa)}`]: { body: api.detailResponse({ ...api.awaDetail, first_name: 'Awa-Marie', lock_version: 4 }) },
  });

  it('envoie la version lue et ne touche pas aux coordonnées inchangées', async () => {
    const { source, callsTo, calls } = setup(routes());
    await source.updateTenant(api.IDS.awa, form({ firstName: 'Awa-Marie' }));
    expect(callsTo('PATCH', party(api.IDS.awa))[0]?.body).toEqual({ lock_version: 3, last_name: 'Diallo', first_name: 'Awa-Marie', birth_date: '1990-05-12' });
    expect(calls.filter((call) => call.path.includes('contact-points') || call.path.includes('identifiers'))).toHaveLength(0);
  });

  it('met à jour l’e-mail principal et le numéro de pièce existants', async () => {
    const { source, callsTo } = setup({
      ...routes(),
      [`PATCH ${party(api.IDS.awa)}/contact-points/${api.IDS.emailPoint}`]: { body: { data: { ...api.emailPoint, value: 'nouvelle@example.com' } } },
      [`PATCH ${party(api.IDS.awa)}/identifiers/${api.IDS.passport}`]: { body: { data: api.passport } },
    });
    await source.updateTenant(api.IDS.awa, form({ email: 'nouvelle@example.com', idDocType: 'passeport', idNumber: '99ZZ99999' }));
    expect(callsTo('PATCH', `${party(api.IDS.awa)}/contact-points/${api.IDS.emailPoint}`)[0]?.body).toEqual({ value: 'nouvelle@example.com' });
    expect(callsTo('PATCH', `${party(api.IDS.awa)}/identifiers/${api.IDS.passport}`)[0]?.body).toEqual({ value: '99ZZ99999' });
  });

  it('ajoute une pièce d’un autre type avec le pays de l’adresse', async () => {
    const { source, callsTo } = setup({ ...routes(), [`POST ${party(api.IDS.awa)}/identifiers`]: { status: 201, body: { data: { ...api.passport, scheme: 'national_id' } } } });
    await source.updateTenant(api.IDS.awa, form({ idDocType: 'cni', idNumber: 'CNI123456' }));
    expect(callsTo('POST', `${party(api.IDS.awa)}/identifiers`)[0]?.body).toEqual({ scheme: 'national_id', country: 'FR', value: 'CNI123456' });
  });

  it('refuse de changer le type du locataire', async () => {
    const { source, callsTo } = setup(routes());
    await expect(source.updateTenant(api.IDS.awa, form({ kind: 'societe', companyName: 'X' }))).rejects.toMatchObject({ kind: 'invalid' });
    expect(callsTo('PATCH', party(api.IDS.awa))).toHaveLength(0);
  });

  it('traduit un 409 de version et relit la fiche à la tentative suivante', async () => {
    const { source, callsTo } = setup({ ...routes(), [`PATCH ${party(api.IDS.awa)}`]: { status: 409, body: api.staleProblem } });
    await expect(source.updateTenant(api.IDS.awa, form())).rejects.toBeInstanceOf(TenantStaleVersionError);
    await expect(source.updateTenant(api.IDS.awa, form())).rejects.toMatchObject({ kind: 'stale_version', message: expect.stringContaining('modifiée entre-temps') as string });
    expect(callsTo('GET', party(api.IDS.awa)).length).toBeGreaterThanOrEqual(2);
  });

  it('réutilise la version lue par la fiche pour détecter une modification concurrente', async () => {
    const { source, callsTo } = setup(routes());
    await source.tenant(api.IDS.awa);
    await source.updateTenant(api.IDS.awa, form());
    expect(callsTo('GET', party(api.IDS.awa))).toHaveLength(2);
    expect(callsTo('PATCH', party(api.IDS.awa))[0]?.body).toMatchObject({ lock_version: 3 });
  });
});

describe('archivage, anonymisation', () => {
  it('archive puis restaure', async () => {
    const archived = { ...api.awaDetail, archived_at: '2026-11-16T10:00:00+00:00' };
    const { source, callsTo } = setup({
      ...listRoutes(),
      [`POST ${party(api.IDS.awa)}/archive`]: { body: api.detailResponse(archived) },
      [`DELETE ${party(api.IDS.awa)}/archive`]: { body: api.detailResponse(api.awaDetail) },
    });
    expect(tenantSchema.parse(await source.setTenantArchived(api.IDS.awa, true)).status).toBe('archive');
    expect(tenantSchema.parse(await source.setTenantArchived(api.IDS.awa, false)).status).toBe('actif');
    expect(callsTo('POST', `${party(api.IDS.awa)}/archive`)).toHaveLength(1);
    expect(callsTo('DELETE', `${party(api.IDS.awa)}/archive`)).toHaveLength(1);
  });

  it('anonymise le contact', async () => {
    const { source, callsTo } = setup({
      ...listRoutes(),
      [`POST ${party(api.IDS.awa)}/anonymization`]: { body: api.detailResponse({ ...api.awaDetail, display_name: 'Contact anonymisé', is_anonymized: true, anonymized_at: '2026-11-16T10:00:00+00:00', contact_points: [], identifiers: [], bank_accounts: [] }) },
    });
    const tenant = tenantSchema.parse(await source.anonymizeTenant(api.IDS.awa));
    expect(callsTo('POST', `${party(api.IDS.awa)}/anonymization`)).toHaveLength(1);
    expect(tenant).toMatchObject({ email: '', ibanLast4: null, idLast4: null });
  });
});

describe('coordonnées, pièces et comptes bancaires', () => {
  const base = party(api.IDS.awa);

  it('ajoute et modifie une coordonnée', async () => {
    const { source, callsTo } = setup({
      [`POST ${base}/contact-points`]: { status: 201, body: { data: api.phonePoint } },
      [`PATCH ${base}/contact-points/${api.IDS.phonePoint}`]: { body: { data: api.phonePoint } },
    });
    expect(await source.addContactPoint(api.IDS.awa, { type: 'phone', value: '+33 6 00 00 00 01', label: 'Mobile', primary: true })).toEqual({ id: api.IDS.phonePoint, type: 'phone', value: '+33 6 00 00 00 01', label: 'Mobile', primary: true });
    await source.updateContactPoint(api.IDS.awa, api.IDS.phonePoint, { label: null, primary: true });
    expect(callsTo('POST', `${base}/contact-points`)[0]?.body).toEqual({ type: 'phone', value: '+33 6 00 00 00 01', label: 'Mobile', is_primary: true });
    expect(callsTo('PATCH', `${base}/contact-points/${api.IDS.phonePoint}`)[0]?.body).toEqual({ label: null, is_primary: true });
  });

  it('ajoute et corrige un identifiant sans jamais renvoyer le numéro', async () => {
    const { source, callsTo } = setup({
      [`POST ${base}/identifiers`]: { status: 201, body: { data: api.passport } },
      [`PATCH ${base}/identifiers/${api.IDS.passport}`]: { body: { data: api.passport } },
    });
    const added = await source.addIdentifier(api.IDS.awa, { scheme: 'passport', country: 'FR', value: '12AB34567' });
    await source.updateIdentifier(api.IDS.awa, api.IDS.passport, { value: '12AB34568' });
    expect(added).toEqual({ id: api.IDS.passport, scheme: 'passport', country: 'FR', last4: '4567' });
    expect(JSON.stringify(added)).not.toContain('12AB34567');
    expect(callsTo('PATCH', `${base}/identifiers/${api.IDS.passport}`)[0]?.body).toEqual({ value: '12AB34568' });
  });

  it('ajoute et remplace un compte bancaire : l’IBAN part normalisé, seul le dernier bloc revient', async () => {
    const { source, callsTo } = setup({
      [`POST ${base}/bank-accounts`]: { status: 201, body: { data: api.bankAccount } },
      [`POST ${base}/bank-accounts/${api.IDS.bank}/replacement`]: { status: 201, body: { data: { ...api.bankAccount, id: '01935b40-0000-7000-8000-000000000002', iban_last4: '5678' } } },
    });
    const added = await source.addBankAccount(api.IDS.awa, { iban: 'fr76 3000 6000 0112 3456 7890 189', bic: 'agrifrpp', holderName: ' Awa Diallo ' });
    const replaced = await source.replaceBankAccount(api.IDS.awa, api.IDS.bank, { iban: 'FR1420041010050500013M02606', bic: '', holderName: 'Awa Diallo', validFrom: '2026-12-01' });
    expect(callsTo('POST', `${base}/bank-accounts`)[0]?.body).toEqual({ iban: 'FR7630006000011234567890189', bic: 'AGRIFRPP', holder_name: 'Awa Diallo' });
    expect(callsTo('POST', `${base}/bank-accounts/${api.IDS.bank}/replacement`)[0]?.body).toEqual({ iban: 'FR1420041010050500013M02606', holder_name: 'Awa Diallo', valid_from: '2026-12-01' });
    expect(added.ibanLast4).toBe('0189');
    expect(replaced.ibanLast4).toBe('5678');
    expect(JSON.stringify([added, replaced])).not.toMatch(/FR76|FR14/);
  });

  it('refuse localement un IBAN mal formé', async () => {
    const { source, calls } = setup({});
    await expect(source.addBankAccount(api.IDS.awa, { iban: 'pas un iban', holderName: 'Awa' })).rejects.toMatchObject({ kind: 'invalid', fieldErrors: { iban: [expect.stringContaining('IBAN') as string] } });
    expect(calls).toHaveLength(0);
  });

  it('ne journalise rien dans la console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const { source } = setup({
      [`POST ${base}/bank-accounts`]: { status: 422, body: api.problem(422, 'validation_failed', 'Données invalides', 'Certaines informations sont invalides.', { errors: { iban: ['IBAN invalide.'] } }) },
    });
    await expect(source.addBankAccount(api.IDS.awa, { iban: 'FR7630006000011234567890189', holderName: 'Awa' })).rejects.toBeInstanceOf(LocatairesApiError);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe('erreurs HTTP', () => {
  it.each([
    [401, 'unauthenticated', 'unauthenticated'],
    [403, 'role_forbidden', 'forbidden'],
    [404, 'party_not_found', 'not_found'],
    [409, 'party_anonymized', 'conflict'],
    [422, 'validation_failed', 'invalid'],
  ])('traduit %s en erreur typée « %s »', async (status, code, kind) => {
    const { source } = setup({ [`POST ${party(api.IDS.awa)}/archive`]: { status, body: api.problem(status, code, 'Titre', 'Détail du serveur.', status === 422 ? { errors: { lock_version: ['Version requise.'] } } : {}) } });
    await expect(source.setTenantArchived(api.IDS.awa, true)).rejects.toMatchObject({ kind, status, code });
  });

  it('signale l’absence d’organisation sans appel réseau', async () => {
    const { source, calls } = setup(listRoutes(), null);
    await expect(source.tenants()).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });

  it('propage une panne serveur au lieu de renvoyer une liste vide', async () => {
    const { source } = setup({ [`GET ${org('/parties')}`]: { status: 500, body: api.problem(500, 'server_error', 'Erreur', 'Une erreur interne est survenue.') } });
    await expect(source.tenants()).rejects.toMatchObject({ status: 500 });
  });
});

describe('fonctions sans route serveur', () => {
  it('déclare chaque fonction indisponible et refuse sans appel ni donnée d’exemple', async () => {
    const { source, calls } = setup({});
    expect(source.unavailableInApiMode).toEqual(LOCATAIRES_FEATURES);
    await expect(source.deleteTenant(api.IDS.awa)).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.inviteTenant({})).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.invitePortal(api.IDS.awa)).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.candidates()).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.inviteCandidate({})).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.setCandidateStatus('x', 'confirme')).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.convertCandidate('x')).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(source.assignTenantUnit([api.IDS.awa], api.IDS.unit)).resolves.toBeUndefined();
    await expect(source.releaseUnit(api.IDS.unit, [api.IDS.awa])).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});
