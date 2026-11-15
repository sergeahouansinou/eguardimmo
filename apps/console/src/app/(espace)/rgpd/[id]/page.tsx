import type { Metadata } from 'next';
import { RgpdDetailScreen } from '@/features/rgpd/RgpdDetailScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Demande RGPD' };

export function generateStaticParams() {
  return [{ id: 'paul-lemoine-effacement' }, { id: 'anais-roux-acces' }, { id: 'louis-petit-rectification' }];
}

export default function Page({ params }: PageProps<'/rgpd/[id]'>) {
  return <IdParam params={params}>{(id) => <RgpdDetailScreen id={id} />}</IdParam>;
}
