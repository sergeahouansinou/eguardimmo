'use client';

import { NotificationPreferencesPage } from '@eguardimmo/shell';
import Link from 'next/link';

export function PreferencesApi() {
  return <NotificationPreferencesPage audience="tenant" Link={Link} allHref="/notifications/toutes" />;
}
