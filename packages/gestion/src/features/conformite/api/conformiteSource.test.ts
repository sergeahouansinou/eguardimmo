import { describe, expect, it } from 'vitest';
import type { ConformiteRole } from '../permissions';
import { ConformiteApiError } from './conformiteErrors';
import { createApiConformiteSource } from './conformiteSource';
import * as api from './responses.fixtures';
import { catalogPath, documentsPath, mockConformiteApi, uploadedPart } from './testing';
import type { MockRoute } from './testing';

const docs = (path: string) => documentsPath(api.IDS.org, path);
const typesPath = catalogPath(api.IDS.org, '/vocabularies/certificate_type/terms');

function build(routes: Record<string, MockRoute>, role: ConformiteRole | null = 'manager', organizationId: string | null = api.IDS.org) {
  const mock = mockConformiteApi({ [`GET ${typesPath}`]: { body: api.certificateTypes }, ...routes });
  const source = createApiConformiteSource({ client: mock.client, organizationId, role }, { fetchImpl: mock.fetchImpl });
  return { ...mock, source };
}

const pdf = (name = 'dpe.pdf') => new File(['%PDF-1.4 x'], name, { type: 'application/pdf' });

const newInput = (overrides: Record<string, unknown> = {}) => ({
  subject: { type: 'organization' as const, id: api.IDS.org },
  typeId: api.IDS.typeGas,
  reference: 'GAZ-2024',
  issuedOn: '2026-11-01',
  expiresOn: '',
  values: {},
  file: null,
  ...overrides,
});

describe('droits selon le rôle', () => {
  it.each([
    ['owner', true],
    ['admin', true],
    ['manager', true],
    ['accountant', false],
    [null, false],
  ] as const)('%s : écriture=%s', (role, write) => {
    expect(build({}, role).source.permissions).toEqual({ write });
  });
});

describe('lectures', () => {
  it('liste les pièces avec filtres, curseur et page par défaut', async () => {
    const { source, callsTo } = build({ [`GET ${docs('/certificates')}`]: { body: api.certificatesPaged } });

    const page = await source.certificates({ state: 'to_renew', typeId: api.IDS.typeBoiler, subject: { type: 'unit', id: api.IDS.org }, includeReplaced: true, cursor: 'abc' });

    expect(Object.fromEntries(callsTo('GET', docs('/certificates'))[0]?.search ?? [])).toEqual({
      per_page: '25',
      cursor: 'abc',
      state: 'to_renew',
      certificate_type_term_id: api.IDS.typeBoiler,
      subject_type: 'unit',
      subject_id: api.IDS.org,
      include_replaced: '1',
    });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(api.certificatesPaged.meta.next_cursor);
  });

  it('filtre par période d’échéance, borne de fin exclue', async () => {
    const { source, callsTo } = build({ [`GET ${docs('/certificates')}`]: { body: api.certificatesPage } });
    await source.certificates({ expiresFrom: '2026-12-01', expiresTo: '2027-01-01' });
    expect(Object.fromEntries(callsTo('GET', docs('/certificates'))[0]?.search ?? [])).toEqual({ per_page: '25', expires_from: '2026-12-01', expires_to: '2027-01-01' });
  });

  it('n’envoie aucun filtre inutile sans critère', async () => {
    const { source, callsTo } = build({ [`GET ${docs('/certificates')}`]: { body: api.certificatesPage } });
    await source.certificates({});
    expect(Object.fromEntries(callsTo('GET', docs('/certificates'))[0]?.search ?? [])).toEqual({ per_page: '25' });
  });

  it('fait correspondre l’état et l’échéance de l’API sans les recalculer', async () => {
    const { source } = build({
      [`GET ${docs(`/certificates/${api.IDS.boiler}`)}`]: { body: api.certificateBoiler },
      [`GET ${docs(`/certificates/${api.IDS.expired}`)}`]: { body: api.certificateExpired },
      [`GET ${docs(`/certificates/${api.IDS.noExpiry}`)}`]: { body: api.certificateNoExpiry },
    });

    expect(await source.certificate(api.IDS.boiler)).toMatchObject({ state: 'to_renew', expiresOn: '2026-11-30', issuedOn: '2025-11-30', reference: 'CH-2025', replacedById: null, storedFileId: null });
    expect(await source.certificate(api.IDS.expired)).toMatchObject({ state: 'expired', expiresOn: '2026-10-01' });
    expect(await source.certificate(api.IDS.noExpiry)).toMatchObject({ state: 'valid', expiresOn: null, values: {} });
  });

  it('lit une pièce renouvelée avec la pièce qui la remplace', async () => {
    const { source } = build({ [`GET ${docs(`/certificates/${api.IDS.boiler}`)}`]: { body: api.certificateBoilerReplaced } });
    expect(await source.certificate(api.IDS.boiler)).toMatchObject({ replacedById: api.IDS.renewed });
  });

  it('lit les types de pièces avec leur schéma de valeurs', async () => {
    const { source } = build({});
    const types = await source.certificateTypes();
    expect(types).toHaveLength(12);
    expect(types.find((type) => type.id === api.IDS.typeDpe)).toEqual({
      id: api.IDS.typeDpe,
      key: 'energy_performance',
      label: 'Diagnostic de performance énergétique (DPE)',
      semanticKey: 'energy_performance',
      defaultValidityMonths: 120,
      reminderDays: 90,
      fields: [
        { key: 'energy_class', kind: 'string', required: true, options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], min: null, max: null },
        { key: 'ghg_class', kind: 'string', required: false, options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], min: null, max: null },
      ],
    });
    expect(types.find((type) => type.id === api.IDS.typeGuarantee)?.fields).toEqual([{ key: 'guaranteed_amount', kind: 'integer', required: true, options: null, min: 0, max: null }]);
  });

  it('ignore un type dont le schéma n’est pas affichable plutôt que d’échouer', async () => {
    const odd = { ...api.certificateTypes.data[0], id: api.IDS.org, metadata: { data_schema: { champ: { type: 'regex' } } } };
    const { source } = build({ [`GET ${typesPath}`]: { body: { data: [odd, api.certificateTypes.data[1]] } } });
    expect((await source.certificateTypes()).map((type) => type.key)).toEqual(['electricity']);
  });
});

describe('création', () => {
  it('crée une pièce sans fichier : JSON exact, sans champ vide', async () => {
    const { source, callsTo } = build({ [`POST ${docs('/certificates')}`]: { status: 201, body: api.certificateExpired } });

    const created = await source.createCertificate(newInput());

    expect(callsTo('POST', docs('/certificates'))[0]?.body).toEqual({
      subject_type: 'organization',
      subject_id: api.IDS.org,
      certificate_type_term_id: api.IDS.typeGas,
      reference: 'GAZ-2024',
      issued_on: '2026-11-01',
      values: {},
    });
    expect(created.state).toBe('expired');
    expect(callsTo('POST', docs('/files'))).toHaveLength(0);
  });

  it('téléverse le fichier en multipart puis crée la pièce avec son identifiant', async () => {
    const { source, callsTo } = build({
      [`POST ${docs('/files')}`]: { status: 201, body: api.uploadedFile },
      [`POST ${docs('/certificates')}`]: { status: 201, body: api.certificateDpe },
    });

    await source.createCertificate(newInput({ typeId: api.IDS.typeDpe, values: { energy_class: 'C', ghg_class: '' }, file: pdf('Mon DPE ../../x.pdf') }));

    const upload = callsTo('POST', docs('/files'))[0];
    expect(upload?.headers.get('Content-Type')).toBeNull();
    expect(upload?.form?.get('category')).toBe('certificate');
    expect(upload?.form?.get('subject_type')).toBe('organization');
    expect(upload?.form?.get('subject_id')).toBe(api.IDS.org);
    expect(uploadedPart(upload?.form ?? null)).toMatchObject({ type: 'application/pdf', size: 10 });
    expect(callsTo('POST', docs('/certificates'))[0]?.body).toMatchObject({ stored_file_id: api.uploadedFile.data.id, values: { energy_class: 'C' } });
    expect(callsTo('POST', docs('/certificates'))[0]?.body).not.toHaveProperty('values.ghg_class');
  });

  it('refuse côté client un type de fichier interdit, sans aucun appel d’upload', async () => {
    const { source, calls } = build({});
    const zip = new File(['PK'], 'archive.zip', { type: 'application/zip' });
    const error = await source.createCertificate(newInput({ file: zip })).catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(ConformiteApiError);
    expect(error).toMatchObject({ kind: 'client_refused', fieldMessages: { file: 'Ce type de fichier n’est pas accepté (PDF, JPEG, PNG ou WebP, 10 Mo au plus).' } });
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('refuse côté client un fichier de plus de 10 Mo et un fichier vide', async () => {
    const { source, calls } = build({});
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'gros.pdf', { type: 'application/pdf' });
    const empty = new File([], 'vide.pdf', { type: 'application/pdf' });

    await expect(source.createCertificate(newInput({ file: big }))).rejects.toMatchObject({ kind: 'client_refused', message: 'Ce fichier dépasse 10 Mo.' });
    await expect(source.createCertificate(newInput({ file: empty }))).rejects.toMatchObject({ kind: 'client_refused', message: 'Ce fichier est vide.' });
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('accepte un fichier de 10 Mo pile', async () => {
    const { source, callsTo } = build({
      [`POST ${docs('/files')}`]: { status: 201, body: api.uploadedFile },
      [`POST ${docs('/certificates')}`]: { status: 201, body: api.certificateDpe },
    });
    const limit = new File([new Uint8Array(10 * 1024 * 1024)], 'limite.pdf', { type: 'application/pdf' });
    await source.createCertificate(newInput({ typeId: api.IDS.typeDpe, values: { energy_class: 'C' }, file: limit }));
    expect(callsTo('POST', docs('/files'))).toHaveLength(1);
  });

  it('refuse des dates ou valeurs invalides avant tout appel', async () => {
    const { source, calls } = build({});
    await expect(source.createCertificate(newInput({ issuedOn: '16/11/2026' }))).rejects.toMatchObject({ fieldMessages: { issuedOn: 'Saisissez la date d’émission (AAAA-MM-JJ).' } });
    await expect(source.createCertificate(newInput({ expiresOn: '2026-10-01' }))).rejects.toMatchObject({ fieldMessages: { expiresOn: 'L’échéance ne peut pas précéder la date d’émission.' } });
    await expect(source.createCertificate(newInput({ typeId: api.IDS.typeDpe, values: {} }))).rejects.toMatchObject({ fieldMessages: { 'values.energy_class': 'Ce champ est obligatoire.' } });
    await expect(source.createCertificate(newInput({ typeId: api.IDS.typeGuarantee, values: { guaranteed_amount: '-5' } }))).rejects.toMatchObject({ fieldMessages: { 'values.guaranteed_amount': 'La valeur minimale est 0.' } });
    await expect(source.createCertificate(newInput({ typeId: api.IDS.org }))).rejects.toMatchObject({ kind: 'not_found' });
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('traduit un refus 422 du serveur par champ, sans clé de traduction brute', async () => {
    const { source } = build({ [`POST ${docs('/certificates')}`]: { status: 422, body: api.problemInvalidDate } });
    const error = await source.createCertificate(newInput()).catch((failure: unknown) => failure);
    expect(error).toMatchObject({ kind: 'invalid', status: 422, fieldMessages: { issued_on: 'La date d’émission est invalide : indiquez une date au format AAAA-MM-JJ.' } });
  });
});

describe('renouvellement', () => {
  it('renouvelle avec les valeurs du type et téléverse le justificatif sur le même objet', async () => {
    const { source, callsTo } = build({
      [`POST ${docs('/files')}`]: { status: 201, body: api.uploadedFile },
      [`POST ${docs(`/certificates/${api.IDS.boiler}/renew`)}`]: { status: 201, body: api.certificateRenewed },
    });
    const current = await build({ [`GET ${docs(`/certificates/${api.IDS.boiler}`)}`]: { body: api.certificateBoiler } }).source.certificate(api.IDS.boiler);

    const renewed = await source.renewCertificate(current, { reference: 'CH-2026', issuedOn: '2026-11-16', expiresOn: '', values: {}, file: pdf() });

    expect(callsTo('POST', docs('/files'))[0]?.form?.get('subject_id')).toBe(current.subject.id);
    expect(callsTo('POST', docs(`/certificates/${api.IDS.boiler}/renew`))[0]?.body).toEqual({
      reference: 'CH-2026',
      issued_on: '2026-11-16',
      values: {},
      stored_file_id: api.uploadedFile.data.id,
    });
    expect(renewed).toMatchObject({ replacesId: api.IDS.boiler, state: 'valid', expiresOn: '2027-11-16' });
  });

  it('signale une pièce déjà renouvelée (409)', async () => {
    const { source } = build({ [`POST ${docs(`/certificates/${api.IDS.boiler}/renew`)}`]: { status: 409, body: api.problemAlreadyReplaced } });
    const current = await build({ [`GET ${docs(`/certificates/${api.IDS.boiler}`)}`]: { body: api.certificateBoiler } }).source.certificate(api.IDS.boiler);
    await expect(source.renewCertificate(current, { reference: '', issuedOn: '2026-11-17', expiresOn: '', values: {}, file: null })).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Cette pièce a déjà été renouvelée : renouvelez la pièce la plus récente.',
    });
  });
});

describe('téléchargement', () => {
  it('lit le fichier par le client authentifié, jamais par un lien public', async () => {
    const { source, callsTo } = build({ [`GET ${docs(`/files/${api.IDS.file}/download`)}`]: { file: { content: api.PDF_BYTES, type: 'application/pdf' } } });

    const file = await source.downloadFile(api.IDS.file);

    const call = callsTo('GET', docs(`/files/${api.IDS.file}/download`))[0];
    expect(call?.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(file.mimeType).toBe('application/pdf');
    expect(await file.blob.text()).toBe(api.PDF_BYTES);
  });

  it('refuse une réponse dont le type n’est pas un justificatif', async () => {
    const { source } = build({ [`GET ${docs(`/files/${api.IDS.file}/download`)}`]: { file: { content: '<html></html>', type: 'text/html' } } });
    await expect(source.downloadFile(api.IDS.file)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('signale un fichier introuvable (404)', async () => {
    const { source } = build({ [`GET ${docs(`/files/${api.IDS.file}/download`)}`]: { status: 404, body: api.problemFileNotFound } });
    await expect(source.downloadFile(api.IDS.file)).rejects.toMatchObject({ kind: 'not_found', message: 'Ce fichier n’existe pas dans votre organisation.' });
  });

  it('échappe l’identifiant dans l’adresse', async () => {
    const { source, calls } = build({});
    await source.downloadFile('../../secret').catch(() => undefined);
    expect(calls.at(-1)?.path).toBe(`/api/v1/org/${api.IDS.org}/documents/files/..%2F..%2Fsecret/download`);
  });
});

describe('erreurs RFC 9457', () => {
  const list = (reply: MockRoute) => build({ [`GET ${docs('/certificates')}`]: reply }).source.certificates({});

  it.each([
    ['403 rôle', { status: 403, body: api.problemForbidden }, 'forbidden', 'Votre rôle ne permet pas cette action sur la conformité.'],
    ['404', { status: 404, body: api.problemCertificateNotFound }, 'not_found', 'Cette pièce n’existe pas dans votre organisation.'],
    ['413', { status: 413, body: api.problemPayloadTooLarge }, 'too_large', 'Ce fichier dépasse la taille maximale autorisée (10 Mo).'],
    ['415', { status: 415, body: api.problemPayloadTooLarge }, 'unsupported_media', 'Ce type de fichier n’est pas accepté (PDF, JPEG, PNG ou WebP).'],
    ['429', { status: 429, body: api.problemTooManyRequests, headers: { 'Retry-After': '60' } }, 'rate_limited', 'Trop de requêtes en peu de temps. Réessayez dans 60 secondes.'],
    ['422 curseur', { status: 422, body: api.problemBadCursor }, 'invalid', 'La page demandée n’existe plus : revenez à la première page.'],
    ['422 état', { status: 422, body: api.problemBadState }, 'invalid', 'L’état demandé est invalide.'],
    ['401', { status: 401, body: { code: 'unauthenticated', title: 'Non authentifié', status: 401 } }, 'unauthenticated', 'Votre session a expiré. Reconnectez-vous.'],
  ] as const)('%s', async (_name, reply, kind, message) => {
    await expect(list(reply)).rejects.toMatchObject({ kind, message });
  });

  it('traduit les refus d’upload du serveur sans afficher la clé de traduction', async () => {
    const { source } = build({ [`POST ${docs('/files')}`]: { status: 422, body: api.problemFileTooLarge }, [`POST ${docs('/certificates')}`]: { status: 201, body: api.certificateDpe } });
    await expect(source.createCertificate(newInput({ file: pdf() }))).rejects.toMatchObject({ kind: 'invalid', fieldMessages: { file: 'Ce fichier dépasse la taille maximale autorisée.' } });
  });

  it('traduit le type refusé et le fichier dangereux par le message du serveur', async () => {
    const refused = build({ [`POST ${docs('/files')}`]: { status: 422, body: api.problemFileTypeRefused } });
    await expect(refused.source.createCertificate(newInput({ file: pdf() }))).rejects.toMatchObject({ fieldMessages: { file: "Ce type de fichier n'est pas accepté ici." } });
    const unsafe = build({ [`POST ${docs('/files')}`]: { status: 422, body: api.problemFileUnsafe } });
    await expect(unsafe.source.createCertificate(newInput({ file: pdf() }))).rejects.toMatchObject({ fieldMessages: { file: 'Ce fichier contient du code exécutable.' } });
  });

  it('traduit une classe énergétique refusée sur le champ de valeur', async () => {
    const { source } = build({ [`POST ${docs('/certificates')}`]: { status: 422, body: api.problemDpeClass } });
    await expect(source.createCertificate(newInput({ typeId: api.IDS.typeDpe, values: { energy_class: 'C' } }))).rejects.toMatchObject({ fieldMessages: { 'values.energy_class': 'La classe énergétique est invalide.' } });
  });

  it('laisse passer une panne réseau avec son message français', async () => {
    const mock = mockConformiteApi({});
    mock.fetchImpl.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const source = createApiConformiteSource({ client: mock.client, organizationId: api.IDS.org, role: 'manager' }, { fetchImpl: mock.fetchImpl });
    await expect(source.certificates({})).rejects.toMatchObject({ message: 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.' });
  });

  it('refuse une réponse qui ne respecte pas le contrat', async () => {
    await expect(list({ body: { data: [{ id: 'pas-un-uuid' }], meta: { per_page: 25, next_cursor: null } } })).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('refuse d’appeler l’API sans organisation', async () => {
    const { source, calls } = build({}, 'manager', null);
    await expect(source.certificates({})).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });
});
