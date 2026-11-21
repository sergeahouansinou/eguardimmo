import type { Metadata } from 'next';
import { InformationsScreen as DemoInformationsScreen } from '@/features/parametres/InformationsScreen';
import { dataSource } from '@/lib/env';
import { InformationsScreen } from '@/screens/exploitation/InformationsScreen';

export const metadata: Metadata = { title: 'Informations' };

export default function Page() {
  return dataSource === 'api' ? <InformationsScreen /> : <DemoInformationsScreen />;
}
