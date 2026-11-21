import type { Metadata } from 'next';
import { SauvegardesScreen } from '@/features/sauvegardes/SauvegardesScreen';
import { dataSource } from '@/lib/env';
import { BackupsScreen } from '@/screens/exploitation/BackupsScreen';

export const metadata: Metadata = { title: 'Sauvegardes' };

export default function Page() {
  return dataSource === 'api' ? <BackupsScreen /> : <SauvegardesScreen />;
}
