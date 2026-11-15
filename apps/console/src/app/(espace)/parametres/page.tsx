import type { Metadata } from 'next';
import { GeneralScreen } from '@/features/parametres/GeneralScreen';

export const metadata: Metadata = { title: 'Paramètres' };

export default function Page() {
  return <GeneralScreen />;
}
