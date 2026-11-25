import type { Metadata } from 'next';
import { dataSource } from '@/lib/env';
import { ServerRequired } from '@/screens/communication/ServerRequired';
import { RappelsScreen } from '@/screens/rappels/RappelsScreen';

export const metadata: Metadata = { title: 'Notifications et rappels' };

export default function Page() {
  return dataSource === 'api' ? <RappelsScreen /> : <ServerRequired title="Notifications et rappels" />;
}
