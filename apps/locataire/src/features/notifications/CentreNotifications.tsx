'use client';

import { ApiNotificationsPage, NotificationsPage } from '@eguardimmo/shell';
import Link from 'next/link';
import { dataSource } from '@/lib/env';

export function CentreNotifications() {
  return dataSource === 'api' ? (
    <ApiNotificationsPage Link={Link} settingsHref="/notifications" />
  ) : (
    <NotificationsPage Link={Link} settingsHref="/notifications" />
  );
}
