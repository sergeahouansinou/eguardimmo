import type { Metadata } from 'next';
import { ModulesScreen as DemoModulesScreen } from '@/features/modules/ModulesScreen';
import { dataSource } from '@/lib/env';
import { ModulesScreen } from '@/screens/modules/ModulesScreen';

export const metadata: Metadata = { title: 'Modules' };

export default function Page() {
  return dataSource === 'api' ? <ModulesScreen /> : <DemoModulesScreen />;
}
