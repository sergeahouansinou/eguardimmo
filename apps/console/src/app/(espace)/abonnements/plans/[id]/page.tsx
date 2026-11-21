import type { Metadata } from 'next';
import { PlanFormScreen } from '@/features/abonnements/PlanFormScreen';
import { dataSource } from '@/lib/env';
import { PlanScreen } from '@/screens/abonnements/PlanScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Plan' };

export function generateStaticParams() {
  return [{ id: 'gratuit' }, { id: 'silver' }, { id: 'gold' }, { id: 'proprietaire' }];
}

export default function Page({ params }: PageProps<'/abonnements/plans/[id]'>) {
  return <IdParam params={params}>{(id) => (dataSource === 'api' ? <PlanScreen code={id} /> : <PlanFormScreen planId={id} />)}</IdParam>;
}
