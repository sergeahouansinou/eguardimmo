import type { Metadata } from 'next';
import { NotificationsScreen } from '@/features/parametres/NotificationsScreen';

export const metadata: Metadata = { title: 'Notifications' };

export default function Page() {
  return <NotificationsScreen />;
}
