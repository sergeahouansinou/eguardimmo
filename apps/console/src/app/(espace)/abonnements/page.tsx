import type { Metadata } from 'next';
import { AbonnementsScreen as DemoAbonnementsScreen } from '@/features/abonnements/AbonnementsScreen';
import { dataSource } from '@/lib/env';
import { AbonnementsScreen } from '@/screens/abonnements/AbonnementsScreen';

export const metadata: Metadata = { title: 'Abonnements' };

export default function Page() {
  return dataSource === 'api' ? <AbonnementsScreen /> : <DemoAbonnementsScreen />;
}
