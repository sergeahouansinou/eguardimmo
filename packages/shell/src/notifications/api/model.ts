import type { ApiClient } from '@eguardimmo/api';
import type { Tone } from '../../data/schemas';
import type { CHANNELS } from './schemas';

export type NotificationChannel = (typeof CHANNELS)[number];
export type NotificationAudience = 'staff' | 'tenant' | 'owner';

export interface ApiNotification {
  id: string;
  type: string;
  tone: Tone;
  title: string;
  detail: string;
  unread: boolean;
  href: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: ApiNotification[];
  nextCursor: string | null;
}

export interface PreferenceChannel {
  channel: NotificationChannel;
  label: string;
  enabled: boolean;
  locked: boolean;
}

export interface PreferenceType {
  type: string;
  label: string;
  group: string;
  audience: NotificationAudience;
  channels: PreferenceChannel[];
}

export interface PreferenceChange {
  type: string;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationsApi {
  client: ApiClient;
  organizationId: string | null;
}
