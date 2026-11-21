import type { ApiClient } from '@eguardimmo/api';
import { contactUpdatePageSchema, contactUpdateSchema, emailChangeSchema, profileSchema } from './accountSchemas';
import type { AccountProfile, ContactField, ContactUpdate } from './accountSchemas';
import type { CursorPage } from './rentModel';
import { parse } from './requests';

export async function fetchProfile(client: ApiClient): Promise<AccountProfile> {
  return parse(profileSchema, await client.get('/api/v1/me')).data;
}

export async function updateName(client: ApiClient, name: string): Promise<AccountProfile> {
  return parse(profileSchema, await client.patch('/api/v1/me', { name: name.trim() })).data;
}

export async function updatePhone(client: ApiClient, phone: string | null): Promise<AccountProfile> {
  return parse(profileSchema, await client.put('/api/v1/me/phone', { phone })).data;
}

export async function requestEmailChange(client: ApiClient, email: string): Promise<number> {
  return parse(emailChangeSchema, await client.post('/api/v1/me/email-change', { email: email.trim() })).data.expires_in_minutes;
}

export async function cancelEmailChange(client: ApiClient): Promise<void> {
  await client.delete('/api/v1/me/email-change');
}

export async function confirmEmailChange(client: ApiClient, code: string): Promise<AccountProfile> {
  return parse(profileSchema, await client.post('/api/v1/me/email-change/confirmation', { code })).data;
}

export async function fetchContactUpdatesPage(client: ApiClient, cursor: string | null): Promise<CursorPage<ContactUpdate>> {
  const page = parse(contactUpdatePageSchema, await client.get('/api/v1/tenant/contact-updates', { cursor }));
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export async function requestContactUpdate(client: ApiClient, input: { organizationId: string; fields: readonly ContactField[]; clientId: string }): Promise<ContactUpdate> {
  const body = { organization_id: input.organizationId, fields: [...input.fields], client_id: input.clientId };
  return parse(contactUpdateSchema, await client.post('/api/v1/tenant/contact-updates', body)).data;
}
