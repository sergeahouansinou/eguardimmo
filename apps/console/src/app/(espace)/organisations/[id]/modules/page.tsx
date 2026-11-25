import type { Metadata } from 'next';
import { OrganisationModulesScreen } from '@/features/organisations/OrganisationModulesScreen';
import { dataSource } from '@/lib/env';
import { OrganisationDroitsScreen } from '@/screens/organisations/OrganisationDroitsScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Modules de l’organisation' };

export function generateStaticParams() {
  return [{ id: 'cabinet-delmas-immobilier' }, { id: 'gestion-les-tilleuls' }];
}

export default function Page({ params }: PageProps<'/organisations/[id]/modules'>) {
  return <IdParam params={params}>{(id) => (dataSource === 'api' ? <OrganisationDroitsScreen id={id} /> : <OrganisationModulesScreen id={id} />)}</IdParam>;
}
