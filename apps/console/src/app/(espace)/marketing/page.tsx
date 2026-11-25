import type { Metadata } from 'next';
import { dataSource } from '@/lib/env';
import { ServerRequired } from '@/screens/communication/ServerRequired';
import { CampaignsScreen } from '@/screens/marketing/CampaignsScreen';

export const metadata: Metadata = { title: 'Marketing' };

export default function Page() {
  return dataSource === 'api' ? <CampaignsScreen /> : <ServerRequired title="Marketing" />;
}
