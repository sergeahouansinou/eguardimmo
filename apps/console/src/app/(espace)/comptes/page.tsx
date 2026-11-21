import type { Metadata } from 'next';
import { ComptesScreen as DemoComptesScreen } from '@/features/comptes/ComptesScreen';
import { dataSource } from '@/lib/env';
import { ComptesScreen } from '@/screens/comptes/ComptesScreen';

export const metadata: Metadata = { title: 'Comptes et profils' };

export default function Page() {
  return dataSource === 'api' ? <ComptesScreen /> : <DemoComptesScreen />;
}
