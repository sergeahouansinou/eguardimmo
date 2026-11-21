import { z } from 'zod';
import { UnexpectedAccountResponseError } from '../../account/requests';
import type { ApiNotification, NotificationPage, NotificationsApi, PreferenceChange, PreferenceType } from './model';
import { notificationPageSchema, notificationResponseSchema, preferencesSchema, readAllSchema, unreadCountSchema } from './schemas';

const BASE = '/api/v1/notifications';

export interface PageOptions {
  unreadOnly: boolean;
  cursor: string | null;
  perPage: number;
}

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UnexpectedAccountResponseError();
  return parsed.data;
}

function toNotification(row: z.infer<typeof notificationResponseSchema>['data']): ApiNotification {
  return {
    id: row.id,
    type: row.type,
    tone: row.tone,
    title: row.title,
    detail: row.detail,
    unread: row.unread,
    href: row.href,
    createdAt: row.created_at,
  };
}

export async function fetchNotificationPage({ client, organizationId }: NotificationsApi, options: PageOptions): Promise<NotificationPage> {
  const payload = await client.get(BASE, {
    unread: options.unreadOnly ? 1 : undefined,
    organization: organizationId,
    cursor: options.cursor,
    per_page: options.perPage,
  });
  const page = parse(notificationPageSchema, payload);
  return { items: page.data.map(toNotification), nextCursor: page.meta.next_cursor };
}

export async function fetchUnreadCount({ client, organizationId }: NotificationsApi): Promise<number> {
  return parse(unreadCountSchema, await client.get(`${BASE}/unread-count`, { organization: organizationId })).data.unread;
}

export async function markNotificationRead({ client }: NotificationsApi, id: string): Promise<ApiNotification> {
  return toNotification(parse(notificationResponseSchema, await client.post(`${BASE}/${encodeURIComponent(id)}/read`)).data);
}

export async function markAllNotificationsRead({ client, organizationId }: NotificationsApi): Promise<number> {
  const payload = await client.post(`${BASE}/read-all`, organizationId === null ? undefined : { organization: organizationId });
  return parse(readAllSchema, payload).data.updated;
}

export async function fetchPreferences({ client }: NotificationsApi): Promise<PreferenceType[]> {
  return parse(preferencesSchema, await client.get(`${BASE}/preferences`)).data.types;
}

export async function savePreferences({ client }: NotificationsApi, changes: PreferenceChange[]): Promise<PreferenceType[]> {
  return parse(preferencesSchema, await client.put(`${BASE}/preferences`, { preferences: changes })).data.types;
}
