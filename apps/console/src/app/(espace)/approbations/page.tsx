import type { Metadata } from 'next';
import { dataSource } from '@/lib/env';
import { ApprobationsDemo } from '@/screens/approbations/ApprobationsDemo';
import { ApprobationsScreen } from '@/screens/approbations/ApprobationsScreen';

export const metadata: Metadata = { title: 'Approbations' };

export default function Page() {
  return dataSource === 'api' ? <ApprobationsScreen /> : <ApprobationsDemo />;
}
