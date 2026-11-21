import type { Metadata } from 'next';
import { RgpdScreen as DemoRgpdScreen } from '@/features/rgpd/RgpdScreen';
import { dataSource } from '@/lib/env';
import { RgpdScreen } from '@/screens/rgpd/RgpdScreen';

export const metadata: Metadata = { title: 'Conformité RGPD' };

export default function Page() {
  return dataSource === 'api' ? <RgpdScreen /> : <DemoRgpdScreen />;
}
