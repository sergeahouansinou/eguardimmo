import { ConsoleSupportTicketPage, TicketPage } from '@eguardimmo/messagerie';
import type { Metadata } from 'next';
import { ticketIds } from '@/console/demo/ticketIds';
import { dataSource } from '@/lib/env';
import { IdParam } from '@/ui/IdParam';

export const metadata: Metadata = { title: 'Ticket de support' };

export function generateStaticParams() {
  return ticketIds();
}

export default function Page({ params }: PageProps<'/support/[id]'>) {
  return <IdParam params={params}>{(id) => (dataSource === 'api' ? <ConsoleSupportTicketPage ticketId={id} /> : <TicketPage ticketId={id} />)}</IdParam>;
}
