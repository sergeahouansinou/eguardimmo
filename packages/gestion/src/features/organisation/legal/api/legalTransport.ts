import type { ApiClient, Body } from '@eguardimmo/api';
import type { z } from 'zod';
import { LegalApiError, NO_ORGANIZATION_MESSAGE, translateApiError, unexpectedResponse } from './legalErrors';

export interface LegalTransport {
  get: <S extends z.ZodType>(path: string, schema: S) => Promise<z.infer<S>>;
  put: <S extends z.ZodType>(path: string, schema: S, body: Body) => Promise<z.infer<S>>;
}

export function createLegalTransport(client: ApiClient, organizationId: string | null): LegalTransport {
  const base = (path: string): string => {
    if (organizationId === null) throw new LegalApiError('no_organization', NO_ORGANIZATION_MESSAGE);
    return `/api/v1/org/${encodeURIComponent(organizationId)}${path}`;
  };

  const run = async <S extends z.ZodType>(schema: S, request: () => Promise<unknown>): Promise<z.infer<S>> => {
    let payload: unknown;
    try {
      payload = await request();
    } catch (error) {
      throw translateApiError(error);
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw unexpectedResponse(parsed.error.issues[0]?.path.join('.'));
    return parsed.data;
  };

  return {
    get: (path, schema) => run(schema, () => client.get(base(path))),
    put: (path, schema, body) => run(schema, () => client.put(base(path), body)),
  };
}
