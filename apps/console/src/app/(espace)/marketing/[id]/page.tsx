import type { Metadata } from 'next';
import { dataSource } from '@/lib/env';
import { ServerRequired } from '@/screens/communication/ServerRequired';
import { CampaignScreen } from '@/screens/marketing/CampaignScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Campagne' };

export function generateStaticParams() {
  return [{ id: 'exemple' }];
}

export default function Page({ params }: PageProps<'/marketing/[id]'>) {
  return <IdParam params={params}>{(id) => (dataSource === 'api' ? <CampaignScreen key={id} id={id} /> : <ServerRequired title="Marketing" />)}</IdParam>;
}
