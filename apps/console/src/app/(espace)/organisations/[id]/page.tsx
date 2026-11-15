import type { Metadata } from 'next';
import { OrganisationDetailScreen } from '@/features/organisations/OrganisationDetailScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Organisation' };

export function generateStaticParams() {
  return [{ id: 'cabinet-delmas-immobilier' }, { id: 'gestion-les-tilleuls' }];
}

export default function Page({ params }: PageProps<'/organisations/[id]'>) {
  return <IdParam params={params}>{(id) => <OrganisationDetailScreen id={id} />}</IdParam>;
}
