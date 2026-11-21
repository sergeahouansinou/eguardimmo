import type { ApiClient } from '@eguardimmo/api';
import type { ConformiteSource } from '../source';
import type { CertificateQuery, CertificateType } from '../model';
import { conformitePermissions } from '../permissions';
import type { ConformiteRole } from '../permissions';
import { toCertificate, toCertificateType } from './conformiteMapping';
import { createPayload, ensureValid, renewPayload, uploadForm } from './conformitePayloads';
import { apiCertificatePage, apiCertificateResponse, apiFileResponse, apiTermSchema, apiTermsResponse } from './conformiteSchemas';
import { ConformiteApiError } from './conformiteErrors';
import { createConformiteTransport } from './conformiteTransport';

export interface ApiConformiteSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: ConformiteRole | null;
}

export interface ApiConformiteSourceDependencies {
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const segment = (id: string): string => encodeURIComponent(id);

const certificateQuery = (query: CertificateQuery) => ({
  per_page: query.perPage ?? PAGE_SIZE,
  cursor: query.cursor,
  state: query.state,
  certificate_type_term_id: query.typeId,
  subject_type: query.subject?.type,
  subject_id: query.subject?.id,
  include_replaced: query.includeReplaced === true ? 1 : undefined,
  expires_from: query.expiresFrom,
  expires_to: query.expiresTo,
});

export function createApiConformiteSource({ client, organizationId, role }: ApiConformiteSourceOptions, { fetchImpl }: ApiConformiteSourceDependencies = {}): ConformiteSource {
  const transport = createConformiteTransport(client, organizationId, fetchImpl);

  const certificateTypes = async (): Promise<CertificateType[]> => {
    const { data } = await transport.get('catalog', '/vocabularies/certificate_type/terms', apiTermsResponse);
    // Un type dont le schéma n'est pas affichable n'est pas proposé : l'API refuserait de toute façon la saisie.
    return data.flatMap((term) => {
      const parsed = apiTermSchema.safeParse(term);
      return parsed.success ? [toCertificateType(parsed.data)] : [];
    });
  };

  const typeOf = async (typeId: string): Promise<CertificateType> => {
    const type = (await certificateTypes()).find((entry) => entry.id === typeId);
    if (type === undefined) throw new ConformiteApiError('not_found', 'Ce type de pièce n’est pas disponible pour votre organisation.', { status: 404, code: 'term_not_found' });
    return type;
  };

  const upload = async (file: File, subject: Parameters<typeof uploadForm>[1]): Promise<string> =>
    (await transport.post('documents', '/files', apiFileResponse, uploadForm(file, subject))).data.id;

  return {
    permissions: conformitePermissions(role),
    organizationId,
    certificateTypes,
    certificates: async (query) => {
      const page = await transport.get('documents', '/certificates', apiCertificatePage, certificateQuery(query));
      return { items: page.data.map(toCertificate), nextCursor: page.meta.next_cursor };
    },
    certificate: async (id) => toCertificate((await transport.get('documents', `/certificates/${segment(id)}`, apiCertificateResponse)).data),
    createCertificate: async (input) => {
      const type = await typeOf(input.typeId);
      ensureValid(input, type);
      const fileId = input.file === null ? null : await upload(input.file, input.subject);
      return toCertificate((await transport.post('documents', '/certificates', apiCertificateResponse, createPayload(input, type, fileId))).data);
    },
    renewCertificate: async (current, input) => {
      const type = await typeOf(current.type.id);
      ensureValid(input, type);
      const fileId = input.file === null ? null : await upload(input.file, current.subject);
      return toCertificate((await transport.post('documents', `/certificates/${segment(current.id)}/renew`, apiCertificateResponse, renewPayload(input, type, fileId))).data);
    },
    downloadFile: (fileId) => transport.file(`/files/${segment(fileId)}/download`),
  };
}
