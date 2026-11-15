import type { Metadata } from 'next';
import { SauvegardesScreen } from '@/features/sauvegardes/SauvegardesScreen';

export const metadata: Metadata = { title: 'Sauvegardes' };

export default function Page() {
  return <SauvegardesScreen />;
}
