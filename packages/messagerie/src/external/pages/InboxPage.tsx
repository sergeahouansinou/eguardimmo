'use client';

import { PenLine } from 'lucide-react';
import { Button, Icon } from '@eguardimmo/ui';
import { ExternalHeader } from '../components/parts';
import { ThreadInbox } from '../components/ThreadInbox';
import type { InboxScope } from '../components/ThreadInbox';
import { useInboxScope } from '../components/useInboxScope';
import { useExternalConfig } from '../context';

export function ExternalInboxPage({ scope }: { scope?: InboxScope }) {
  const { copy, routes, Link } = useExternalConfig();
  const optionsScope = useInboxScope();
  const activeScope = scope ?? optionsScope;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ExternalHeader
        title={copy.inboxTitle}
        subtitle={copy.inboxSubtitle}
        actions={
          <Button asChild>
            <Link href={routes.newThread}>
              <Icon icon={PenLine} />
              Nouveau message
            </Link>
          </Button>
        }
      />
      <ThreadInbox {...(activeScope ? { scope: activeScope } : {})} />
    </div>
  );
}
