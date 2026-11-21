import type { Metadata } from 'next';
import { SanteScreen as DemoSanteScreen } from '@/features/sante/SanteScreen';
import { dataSource } from '@/lib/env';
import { SanteScreen } from '@/screens/exploitation/SanteScreen';

export const metadata: Metadata = { title: 'Santé du système' };

export default function Page() {
  return dataSource === 'api' ? <SanteScreen /> : <DemoSanteScreen />;
}
