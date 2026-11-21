'use client';

import type { ApiClient } from '@eguardimmo/api';
import { createContext, use, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { NotificationsApi } from './model';

const NotificationsContext = createContext<NotificationsApi | null>(null);

export interface NotificationsApiProviderProps {
  client: ApiClient;
  organizationId: string | null;
  children: ReactNode;
}

export function NotificationsApiProvider({ client, organizationId, children }: NotificationsApiProviderProps) {
  const value = useMemo(() => ({ client, organizationId }), [client, organizationId]);
  return <NotificationsContext value={value}>{children}</NotificationsContext>;
}

export function useNotificationsApi(): NotificationsApi | null {
  return use(NotificationsContext);
}

export function useRequiredNotificationsApi(): NotificationsApi {
  const api = use(NotificationsContext);
  if (api === null) throw new Error('NotificationsApiProvider manquant autour des écrans de notifications.');
  return api;
}
