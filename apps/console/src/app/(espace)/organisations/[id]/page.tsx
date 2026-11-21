import type { Metadata } from 'next';
import { OrganisationDetailScreen } from '@/features/organisations/OrganisationDetailScreen';
import { dataSource } from '@/lib/env';
import { OrganisationScreen } from '@/screens/organisations/OrganisationScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Organisation' };

export function generateStaticParams() {
  return [{ id: 'cabinet-delmas-immobilier' }, { id: 'gestion-les-tilleuls' }];
}

export default function Page({ params }: PageProps<'/organisations/[id]'>) {
  return <IdParam params={params}>{(id) => (dataSource === 'api' ? <OrganisationScreen id={id} /> : <OrganisationDetailScreen id={id} />)}</IdParam>;
}
