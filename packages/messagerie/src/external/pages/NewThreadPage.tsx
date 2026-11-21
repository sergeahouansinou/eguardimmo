'use client';

import { ExternalHeader } from '../components/parts';
import { NewThreadForm } from '../components/NewThreadForm';
import { useExternalConfig } from '../context';

export function ExternalNewThreadPage({ initialOptionId }: { initialOptionId?: string }) {
  const { copy, routes } = useExternalConfig();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ExternalHeader
        title="Nouveau message"
        subtitle={copy.newThread.subtitle}
        breadcrumb={[{ label: copy.inboxTitle, href: routes.inbox }, { label: 'Nouveau message' }]}
      />
      <NewThreadForm {...(initialOptionId ? { initialOptionId } : {})} />
    </div>
  );
}
