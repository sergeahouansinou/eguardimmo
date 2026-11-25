import type { Metadata } from 'next';
import { dataSource } from '@/lib/env';
import { ServerRequired } from '@/screens/communication/ServerRequired';
import { NewCampaignScreen } from '@/screens/marketing/NewCampaignScreen';

export const metadata: Metadata = { title: 'Nouvelle campagne' };

export default function Page() {
  return dataSource === 'api' ? <NewCampaignScreen /> : <ServerRequired title="Marketing" />;
}
