import type { ApiClient } from "@eguardimmo/api";
import { parse } from "../shared/parse";
import { emailChangeSchema, profileSchema } from "./schemas";
import type { AccountProfile } from "./schemas";

export const ME_PATH = "/api/v1/me";

export async function fetchProfile(client: ApiClient): Promise<AccountProfile> {
  return parse(profileSchema, await client.get(ME_PATH)).data;
}

export async function updateName(client: ApiClient, name: string): Promise<AccountProfile> {
  return parse(profileSchema, await client.patch(ME_PATH, { name: name.trim() })).data;
}

export async function updatePhone(client: ApiClient, phone: string | null): Promise<AccountProfile> {
  return parse(profileSchema, await client.put(`${ME_PATH}/phone`, { phone })).data;
}

export async function requestEmailChange(client: ApiClient, email: string): Promise<number> {
  return parse(emailChangeSchema, await client.post(`${ME_PATH}/email-change`, { email: email.trim() })).data.expires_in_minutes;
}

export async function cancelEmailChange(client: ApiClient): Promise<void> {
  await client.delete(`${ME_PATH}/email-change`);
}

export async function confirmEmailChange(client: ApiClient, code: string): Promise<AccountProfile> {
  return parse(profileSchema, await client.post(`${ME_PATH}/email-change/confirmation`, { code })).data;
}
