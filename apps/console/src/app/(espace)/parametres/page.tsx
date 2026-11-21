import type { Metadata } from 'next';
import { GeneralScreen } from '@/features/parametres/GeneralScreen';
import { dataSource } from '@/lib/env';
import { SettingsScreen } from '@/screens/exploitation/SettingsScreen';

export const metadata: Metadata = { title: 'Paramètres' };

export default function Page() {
  return dataSource === 'api' ? <SettingsScreen /> : <GeneralScreen />;
}
