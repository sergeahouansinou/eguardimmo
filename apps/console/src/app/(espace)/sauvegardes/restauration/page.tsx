import type { Metadata } from 'next';
import { RestaurationScreen } from '@/features/sauvegardes/RestaurationScreen';

export const metadata: Metadata = { title: 'Demande de restauration' };

export default function Page() {
  return <RestaurationScreen />;
}
