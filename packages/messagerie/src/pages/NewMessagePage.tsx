'use client';

import { NewMessageForm } from '../components/NewMessageForm';
import { PageHeader } from '../components/parts';
import { useMessagerieConfig } from '../config';

export function NewMessagePage({ initialRecipientId }: { initialRecipientId?: string }) {
  const { profile, routes } = useMessagerieConfig();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Nouveau message"
        subtitle={profile.compose.subtitle}
        breadcrumb={[{ label: profile.inbox.title, href: routes.inbox }, { label: 'Nouveau message' }]}
      />
      <NewMessageForm {...(initialRecipientId ? { initialRecipientId } : {})} />
    </div>
  );
}
