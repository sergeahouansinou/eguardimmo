import type { Metadata } from 'next';
import { EquipeScreen as DemoEquipeScreen } from '@/features/equipe/EquipeScreen';
import { dataSource } from '@/lib/env';
import { EquipeScreen } from '@/screens/exploitation/EquipeScreen';

export const metadata: Metadata = { title: 'Équipe opérateur' };

export default function Page() {
  return dataSource === 'api' ? <EquipeScreen /> : <DemoEquipeScreen />;
}
