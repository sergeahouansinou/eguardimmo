import type { Metadata } from 'next';
import { IncidentScreen } from '@/features/sante/IncidentScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Incident' };

export function generateStaticParams() {
  return [{ id: 'inc-2026-031' }];
}

export default function Page({ params }: PageProps<'/sante/incidents/[id]'>) {
  return <IdParam params={params}>{(id) => <IncidentScreen id={id} />}</IdParam>;
}
