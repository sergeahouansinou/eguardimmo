import type { Metadata } from 'next';
import { SanteScreen } from '@/features/sante/SanteScreen';

export const metadata: Metadata = { title: 'Santé du système' };

export default function Page() {
  return <SanteScreen />;
}
