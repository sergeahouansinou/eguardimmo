import type { Metadata } from 'next';
import { SecurityScreen } from '@/features/parametres/SecurityScreen';

export const metadata: Metadata = { title: 'Sécurité' };

export default function Page() {
  return <SecurityScreen />;
}
