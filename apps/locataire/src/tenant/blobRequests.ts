import { ApiUnreachableError, toApiError } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { UnexpectedResponseError } from './errors';

export async function fetchBlob(
  client: ApiClient,
  path: string,
  accepted: readonly string[],
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetchImpl(client.url(path), { credentials: 'include', headers: { Accept: accepted.join(', '), 'X-Requested-With': 'XMLHttpRequest' } });
  } catch {
    throw new ApiUnreachableError();
  }
  if (!response.ok) throw await toApiError(response);
  const type = response.headers.get('Content-Type') ?? '';
  if (!accepted.some((candidate) => type.startsWith(candidate))) throw new UnexpectedResponseError();
  return response.blob();
}
