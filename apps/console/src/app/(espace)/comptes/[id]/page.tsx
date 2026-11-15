import type { Metadata } from 'next';
import { CompteDetailScreen } from '@/features/comptes/CompteDetailScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Compte' };

export function generateStaticParams() {
  return [{ id: 'marc-chevalier' }, { id: 'sophie-delmas' }];
}

export default function Page({ params }: PageProps<'/comptes/[id]'>) {
  return <IdParam params={params}>{(id) => <CompteDetailScreen id={id} />}</IdParam>;
}
