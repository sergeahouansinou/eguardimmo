import type { Metadata } from 'next';
import { PlanFormScreen } from '@/features/abonnements/PlanFormScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Plan' };

export function generateStaticParams() {
  return [{ id: 'essentiel' }, { id: 'pro' }, { id: 'agence' }, { id: 'proprietaire' }];
}

export default function Page({ params }: PageProps<'/abonnements/plans/[id]'>) {
  return <IdParam params={params}>{(id) => <PlanFormScreen planId={id} />}</IdParam>;
}
