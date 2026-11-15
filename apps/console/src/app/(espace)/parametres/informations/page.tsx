import type { Metadata } from 'next';
import { InformationsScreen } from '@/features/parametres/InformationsScreen';

export const metadata: Metadata = { title: 'Informations' };

export default function Page() {
  return <InformationsScreen />;
}
