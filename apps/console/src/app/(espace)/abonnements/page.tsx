import type { Metadata } from 'next';
import { AbonnementsScreen } from '@/features/abonnements/AbonnementsScreen';

export const metadata: Metadata = { title: 'Abonnements' };

export default function Page() {
  return <AbonnementsScreen />;
}
