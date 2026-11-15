import type { Metadata } from 'next';
import { AuditDetailScreen } from '@/features/audit/AuditDetailScreen';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Événement du journal' };

export function generateStaticParams() {
  return [{ id: 'evt-2026-204518' }, { id: 'evt-2026-204517' }];
}

export default function Page({ params }: PageProps<'/audit/[id]'>) {
  return <IdParam params={params}>{(id) => <AuditDetailScreen id={id} />}</IdParam>;
}
