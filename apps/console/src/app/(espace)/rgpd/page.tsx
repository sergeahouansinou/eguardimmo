import type { Metadata } from 'next';
import { RgpdScreen } from '@/features/rgpd/RgpdScreen';

export const metadata: Metadata = { title: 'Conformité RGPD' };

export default function Page() {
  return <RgpdScreen />;
}
