import type { Metadata } from 'next';
import { ComptesScreen } from '@/features/comptes/ComptesScreen';

export const metadata: Metadata = { title: 'Comptes et profils' };

export default function Page() {
  return <ComptesScreen />;
}
