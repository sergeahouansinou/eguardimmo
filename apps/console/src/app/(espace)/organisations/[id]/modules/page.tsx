import type { Metadata } from 'next';
import { OrganisationModulesScreen } from '@/features/organisations/OrganisationModulesScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Modules de l’organisation' };

export function generateStaticParams() {
  return [{ id: 'cabinet-delmas-immobilier' }, { id: 'gestion-les-tilleuls' }];
}

export default function Page({ params }: PageProps<'/organisations/[id]/modules'>) {
  return <IdParam params={params}>{(id) => <OrganisationModulesScreen id={id} />}</IdParam>;
}
