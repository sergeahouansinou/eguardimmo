import type { ApiClient } from '@eguardimmo/api';
import { ConformiteApiError, NO_ORGANIZATION_MESSAGE, translateApiError, unexpectedResponse } from '../../api/conformiteErrors';
import { createConformiteTransport } from '../../api/conformiteTransport';
import { conformitePermissions } from '../../permissions';
import type { ConformiteRole } from '../../permissions';
import type { LibraryQuery } from '../model';
import type { LibrarySource } from '../source';
import { toLibraryError } from './libraryErrors';
import { toLibraryEntry } from './libraryMapping';
import { libraryForm } from './libraryPayloads';
import { apiLibraryEntryResponse, apiLibraryPage } from './librarySchemas';

export interface ApiLibrarySourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: ConformiteRole | null;
}

const PAGE_SIZE = 25;
const segment = (id: string): string => encodeURIComponent(id);

const listQuery = (query: LibraryQuery, cursor: string | null) => ({
  per_page: PAGE_SIZE,
  cursor,
  kind: query.kind ?? undefined,
  archived: query.archived ? 1 : undefined,
});

export function createApiLibrarySource({ client, organizationId, role }: ApiLibrarySourceOptions, { fetchImpl }: { fetchImpl?: typeof fetch } = {}): LibrarySource {
  const transport = createConformiteTransport(client, organizationId, fetchImpl);
  const guard = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      throw toLibraryError(error);
    }
  };
  const entryPath = (entryId: string): string => {
    if (organizationId === null) throw new ConformiteApiError('no_organization', NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}/documents/library/${segment(entryId)}/archive`;
  };
  const restore = async (entryId: string) => {
    let payload: unknown;
    try {
      payload = await client.delete(entryPath(entryId));
    } catch (error) {
      throw translateApiError(error);
    }
    const parsed = apiLibraryEntryResponse.safeParse(payload);
    if (!parsed.success) throw unexpectedResponse(parsed.error.issues[0]?.path.join('.'));
    return toLibraryEntry(parsed.data.data);
  };

  return {
    permissions: conformitePermissions(role),
    organizationId,
    list: (query, cursor) =>
      guard(async () => {
        const page = await transport.get('documents', '/library', apiLibraryPage, listQuery(query, cursor));
        return { items: page.data.map(toLibraryEntry), nextCursor: page.meta.next_cursor };
      }),
    file: (document) => guard(async () => toLibraryEntry((await transport.post('documents', '/library', apiLibraryEntryResponse, libraryForm(document))).data)),
    archive: (entryId) => guard(async () => toLibraryEntry((await transport.post('documents', `/library/${segment(entryId)}/archive`, apiLibraryEntryResponse)).data)),
    restore: (entryId) => guard(() => restore(entryId)),
    downloadFile: (fileId) => guard(() => transport.file(`/files/${segment(fileId)}/download`)),
  };
}
