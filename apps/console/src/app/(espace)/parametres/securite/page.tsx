import type { Metadata } from 'next';
import { SecurityScreen as DemoSecurityScreen } from '@/features/parametres/SecurityScreen';
import { dataSource } from '@/lib/env';
import { SecurityScreen } from '@/screens/exploitation/SecurityScreen';

export const metadata: Metadata = { title: 'Sécurité' };

export default function Page() {
  return dataSource === 'api' ? <SecurityScreen /> : <DemoSecurityScreen />;
}
