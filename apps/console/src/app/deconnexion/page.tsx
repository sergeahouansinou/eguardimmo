import type { Metadata } from 'next';
import { DeconnexionScreen } from '@/features/connexion/DeconnexionScreen';

export const metadata: Metadata = { title: 'Déconnexion' };

export default function Page() {
  return <DeconnexionScreen />;
}
