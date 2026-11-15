import type { Metadata } from 'next';
import { CentreNotifications } from '@/features/notifications/CentreNotifications';

export const metadata: Metadata = { title: 'Notifications' };

export default function Page() {
  return <CentreNotifications />;
}
