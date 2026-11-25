import type { Metadata } from 'next';
import { ModuleDetailScreen } from '@/features/modules/ModuleDetailScreen';
import { dataSource } from '@/lib/env';
import { ModuleScreen } from '@/screens/modules/ModuleScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Module' };

export function generateStaticParams() {
  return [{ id: 'messagerie' }, { id: 'baux' }];
}

export default function Page({ params }: PageProps<'/modules/[id]'>) {
  return <IdParam params={params}>{(id) => (dataSource === 'api' ? <ModuleScreen feature={id} /> : <ModuleDetailScreen id={id} />)}</IdParam>;
}
