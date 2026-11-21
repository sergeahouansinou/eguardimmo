import type { Metadata } from 'next';
import { CompteDetailScreen } from '@/features/comptes/CompteDetailScreen';
import { dataSource } from '@/lib/env';
import { CompteScreen } from '@/screens/comptes/CompteScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Compte' };

export function generateStaticParams() {
  return [{ id: 'marc-chevalier' }, { id: 'sophie-delmas' }];
}

export default function Page({ params }: PageProps<'/comptes/[id]'>) {
  return <IdParam params={params}>{(id) => (dataSource === 'api' ? <CompteScreen id={id} /> : <CompteDetailScreen id={id} />)}</IdParam>;
}
