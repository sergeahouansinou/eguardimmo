import type { Metadata } from 'next';
import { EquipeScreen } from '@/features/equipe/EquipeScreen';

export const metadata: Metadata = { title: 'Équipe opérateur' };

export default function Page() {
  return <EquipeScreen />;
}
