'use client';

import { useState } from 'react';
import { TicketBoard, defaultTicketFilters } from '../components/TicketBoard';
import type { TicketFilters } from '../components/TicketBoard';
import { TicketDetail } from '../components/TicketDetail';
import { PageHeader } from '../components/parts';
import { useMessagerieConfig } from '../config';

export function SupportBoardPage() {
  const { profile } = useMessagerieConfig();
  const [filters, setFilters] = useState<TicketFilters>(defaultTicketFilters);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={profile.inbox.title} subtitle={profile.inbox.subtitle} />
      <TicketBoard filters={filters} onFiltersChange={setFilters} />
    </div>
  );
}

export function TicketPage({ ticketId }: { ticketId: string }) {
  return <TicketDetail ticketId={ticketId} />;
}
