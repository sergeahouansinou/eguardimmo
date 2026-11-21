import { describe, expect, it } from 'vitest';
import { ConformiteApiError } from '../../api/conformiteErrors';
import { uploadedPart } from '../../api/testing';
import { createTestLibrarySource, libraryUrl, filesUrl } from '../testing';
import * as api from './responses.fixtures';

const get = (url: string) => `GET ${url}`;

describe('source API de la bibliothèque', () => {
  it('liste les documents avec filtres et curseur, et expose scan et archivage', async () => {
    const { source, callsTo } = createTestLibrarySource({ [get(libraryUrl())]: { body: api.libraryFirstPage } });

    const result = await source.list({ kind: 'diagnostic', archived: true }, 'abc');

    expect(Object.fromEntries(callsTo('GET', libraryUrl())[0]?.search ?? [])).toEqual({ per_page: '25', cursor: 'abc', kind: 'diagnostic', archived: '1' });
    expect(result.nextCursor).toBe(api.NEXT_CURSOR);
    expect(result.items[0]).toEqual({
      id: api.IDS.mandateEntry,
      kind: 'mandate',
      archived: false,
      filedByUserId: api.IDS.user,
      lockVersion: 1,
      createdAt: '2026-11-18T09:30:00+00:00',
      file: {
        id: api.IDS.mandateFile,
        name: 'Mandat de gestion M-2026-0012.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 48213,
        scanStatus: 'clean',
        subject: { type: 'mandate', id: api.IDS.mandate },
        retentionUntil: '2036-11-18T23:59:59+00:00',
      },
    });
    expect(result.items[1]?.file.scanStatus).toBe('pending');
  });

  it('n’envoie ni filtre ni indicateur d’archivage par défaut', async () => {
    const { source, callsTo } = createTestLibrarySource({ [get(libraryUrl())]: { body: api.libraryEmpty } });
    await source.list({ kind: null, archived: false }, null);
    expect(Object.fromEntries(callsTo('GET', libraryUrl())[0]?.search ?? [])).toEqual({ per_page: '25' });
  });

  it('dépose en multipart avec les champs exacts attendus par le serveur', async () => {
    const { source, callsTo } = createTestLibrarySource({ [`POST ${libraryUrl()}`]: { status: 201, body: { data: api.mandateEntry } } });
    const file = new File(['%PDF-1.4'], 'scan.pdf', { type: 'application/pdf' });

    const created = await source.file({ file, kind: 'mandate', subject: { type: 'mandate', id: api.IDS.mandate }, displayName: ' Mandat Dupont ', retentionUntil: '2036-11-18' });

    const form = callsTo('POST', libraryUrl())[0]?.form;
    expect(Object.fromEntries([...(form?.entries() ?? [])].filter(([key]) => key !== 'file'))).toEqual({
      kind: 'mandate',
      subject_type: 'mandate',
      subject_id: api.IDS.mandate,
      display_name: 'Mandat Dupont',
      retention_until: '2036-11-18',
    });
    expect(uploadedPart(form ?? null)).toMatchObject({ name: 'scan.pdf', type: 'application/pdf' });
    expect(created.id).toBe(api.IDS.mandateEntry);
  });

  it('omet sujet, nom et conservation quand ils sont vides', async () => {
    const { source, callsTo } = createTestLibrarySource({ [`POST ${libraryUrl()}`]: { status: 201, body: { data: api.diagnosticPending } } });
    await source.file({ file: new File(['x'], 'a.pdf', { type: 'application/pdf' }), kind: 'other', subject: null, displayName: '  ', retentionUntil: '' });
    expect([...(callsTo('POST', libraryUrl())[0]?.form?.keys() ?? [])]).toEqual(['file', 'kind']);
  });

  it('archive par POST puis restaure par DELETE sur la même ressource', async () => {
    const { source, callsTo } = createTestLibrarySource({
      [`POST ${libraryUrl(`/${api.IDS.archivedEntry}/archive`)}`]: { body: { data: api.archivedEntry } },
      [`DELETE ${libraryUrl(`/${api.IDS.archivedEntry}/archive`)}`]: { body: { data: api.mandateEntry } },
    });
    expect((await source.archive(api.IDS.archivedEntry)).archived).toBe(true);
    expect((await source.restore(api.IDS.archivedEntry)).archived).toBe(false);
    expect(callsTo('POST', libraryUrl(`/${api.IDS.archivedEntry}/archive`))).toHaveLength(1);
    expect(callsTo('DELETE', libraryUrl(`/${api.IDS.archivedEntry}/archive`))).toHaveLength(1);
  });

  it('traduit library_kind_subject_mismatch en erreur du champ objet', async () => {
    const { source } = createTestLibrarySource({ [`POST ${libraryUrl()}`]: { status: 422, body: api.problemMismatch } });
    const error = await source.file({ file: new File(['x'], 'a.pdf', { type: 'application/pdf' }), kind: 'lease', subject: null, displayName: '', retentionUntil: '' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConformiteApiError);
    expect(error).toMatchObject({ kind: 'invalid', status: 422, code: 'library_kind_subject_mismatch', fieldMessages: { subject: expect.stringContaining('un mandat pour un mandat') as string } });
  });

  it('traduit library_document_not_found (404) à l’archivage et à la restauration', async () => {
    const { source } = createTestLibrarySource({
      [`POST ${libraryUrl('/x/archive')}`]: { status: 404, body: api.problemNotFound },
      [`DELETE ${libraryUrl('/x/archive')}`]: { status: 404, body: api.problemNotFound },
    });
    for (const run of [source.archive('x'), source.restore('x')]) {
      await expect(run).rejects.toMatchObject({ kind: 'not_found', code: 'library_document_not_found', message: expect.stringContaining('bibliothèque') as string });
    }
  });

  it('traduit document_not_clean (409) au téléchargement', async () => {
    const { source } = createTestLibrarySource({ [get(filesUrl(`/${api.IDS.diagnosticFile}/download`))]: { status: 409, body: api.problemNotClean } });
    await expect(source.downloadFile(api.IDS.diagnosticFile)).rejects.toMatchObject({ kind: 'conflict', code: 'document_not_clean', message: expect.stringContaining('analyse antivirus') as string });
  });

  it('refuse une réponse qui n’a pas la forme de la Resource', async () => {
    const broken = { ...api.mandateEntry, file: { ...api.mandateEntry.file, scan_status: 'unknown' } };
    const { source } = createTestLibrarySource({ [get(libraryUrl())]: { body: api.page([broken]) } });
    await expect(source.list({ kind: null, archived: false }, null)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('refuse d’appeler l’API sans organisation', async () => {
    const { createApiLibrarySource } = await import('./librarySource');
    const { mockConformiteApi } = await import('../../api/testing');
    const mock = mockConformiteApi({});
    const source = createApiLibrarySource({ client: mock.client, organizationId: null, role: 'owner' });
    await expect(source.restore('x')).rejects.toMatchObject({ kind: 'no_organization' });
    expect(mock.calls).toHaveLength(0);
  });

  it('réserve l’écriture au titulaire, à l’administrateur et au gestionnaire', () => {
    expect(createTestLibrarySource({}, 'accountant').source.permissions.write).toBe(false);
    expect(createTestLibrarySource({}, 'manager').source.permissions.write).toBe(true);
  });
});
