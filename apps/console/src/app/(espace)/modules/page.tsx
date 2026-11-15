import type { Metadata } from 'next';
import { ModulesScreen } from '@/features/modules/ModulesScreen';

export const metadata: Metadata = { title: 'Modules' };

export default function Page() {
  return <ModulesScreen />;
}
