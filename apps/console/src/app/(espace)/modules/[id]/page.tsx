import type { Metadata } from 'next';
import { ModuleDetailScreen } from '@/features/modules/ModuleDetailScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Module' };

export function generateStaticParams() {
  return [{ id: 'messagerie' }, { id: 'baux' }];
}

export default function Page({ params }: PageProps<'/modules/[id]'>) {
  return <IdParam params={params}>{(id) => <ModuleDetailScreen id={id} />}</IdParam>;
}
