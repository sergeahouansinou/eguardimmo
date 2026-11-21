import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient, Body } from '@eguardimmo/api';
import type { z } from 'zod';
import type { ExternalSpace, OpenInput, PostInput, ThreadListQuery } from '../model';
import { UnexpectedResponseError } from './errors';

const segment = encodeURIComponent;
const ATTACHMENT_TYPES: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const FORBIDDEN_NAME_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const FALLBACK_NAME = 'piece-jointe';

export function parsePayload<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UnexpectedResponseError();
  return parsed.data;
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(FORBIDDEN_NAME_CHARACTERS, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim().slice(0, 120);
  return cleaned === '' ? FALLBACK_NAME : cleaned;
}

export function messageBody(fields: Record<string, string | null | undefined>, files: readonly File[]): Body {
  const present = Object.entries(fields).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== null);
  if (files.length === 0) return Object.fromEntries(present);
  const form = new FormData();
  for (const [key, value] of present) form.append(key, value);
  for (const file of files) form.append('attachments[]', file);
  return form;
}

export async function fetchAttachment(client: ApiClient, fetchImpl: typeof fetch, path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetchImpl(client.url(path), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: ATTACHMENT_TYPES.join(', '), 'X-Requested-With': 'XMLHttpRequest' },
    });
  } catch {
    throw new ApiUnreachableError();
  }
  if (!response.ok) throw await toApiError(response);
  const type = (response.headers.get('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ATTACHMENT_TYPES.includes(type)) throw new UnexpectedResponseError();
  return response.blob();
}

export interface Transport {
  list: (query: ThreadListQuery, cursor: string | null) => Promise<unknown>;
  show: (id: string) => Promise<unknown>;
  messages: (id: string, query: { after?: string; cursor?: string }) => Promise<unknown>;
  unread: () => Promise<unknown>;
  options: () => Promise<unknown>;
  open: (input: OpenInput) => Promise<unknown>;
  post: (id: string, input: PostInput) => Promise<unknown>;
  patch: (id: string, body: { read?: boolean; archived?: boolean }) => Promise<unknown>;
  redact: (id: string, messageId: string) => Promise<unknown>;
  download: (attachmentId: string) => Promise<Blob>;
}

export function createTransport(client: ApiClient, space: ExternalSpace, fetchImpl: typeof fetch): Transport {
  const root = `/api/v1/${space}/conversations`;
  const thread = (id: string) => `${root}/${segment(id)}`;
  const scopeKey = space === 'tenant' ? 'lease_id' : 'agency';
  return {
    list: (query, cursor) =>
      client.get(root, {
        per_page: query.perPage,
        cursor,
        search: query.search.trim(),
        archived: query.archived ? 1 : undefined,
        unread: query.unread ? 1 : undefined,
        [scopeKey]: query.scopeId,
      }),
    show: (id) => client.get(thread(id)),
    messages: (id, query) => client.get(`${thread(id)}/messages`, { after: query.after, cursor: query.cursor }),
    unread: () => client.get(`${root}/unread`),
    options: () => client.get(`${root}/options`),
    open: (input) => {
      const link = space === 'tenant' ? { lease_id: input.optionId } : { access_id: input.optionId };
      return client.post(root, messageBody({ ...link, subject: input.subject, body: input.body, client_id: input.clientId }, input.files));
    },
    post: (id, input) => client.post(`${thread(id)}/messages`, messageBody({ body: input.body, client_id: input.clientId }, input.files)),
    patch: (id, body) => client.patch(thread(id), body),
    redact: (id, messageId) => client.post(`${thread(id)}/messages/${segment(messageId)}/redaction`, {}),
    download: (attachmentId) => fetchAttachment(client, fetchImpl, `/api/v1/${space}/conversation-attachments/${segment(attachmentId)}`),
  };
}
