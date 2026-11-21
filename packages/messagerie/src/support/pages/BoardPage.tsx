'use client';

import { Plus } from 'lucide-react';
import { Button, Icon } from '@eguardimmo/ui';
import { AvailabilityLine, PrivacyNote, SupportHeader } from '../components/parts';
import { TicketBoard } from '../components/TicketBoard';
import { useSupportConfig } from '../context';

export function SupportRequestsPage() {
  const { copy, routes, Link } = useSupportConfig();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SupportHeader
        title="Mes demandes au support"
        subtitle={copy.boardSubtitle}
        actions={
          <Button asChild>
            <Link href={routes.newRequest}>
              <Icon icon={Plus} />
              Nouvelle demande
            </Link>
          </Button>
        }
      />
      <AvailabilityLine />
      <div className="flex max-w-3xl min-w-0 flex-col gap-3">
        <TicketBoard />
        <PrivacyNote />
      </div>
    </div>
  );
}
