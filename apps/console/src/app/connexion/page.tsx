import type { Metadata } from 'next';
import { ConnexionScreen } from '@/features/connexion/ConnexionScreen';

export const metadata: Metadata = { title: 'Connexion' };

export default function Page() {
  return <ConnexionScreen />;
}
