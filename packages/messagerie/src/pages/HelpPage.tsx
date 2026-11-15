'use client';

import { HelpCenter } from '../components/HelpCenter';
import { PageHeader } from '../components/parts';
import { useMessagerieConfig } from '../config';

export function HelpPage() {
  const { profile } = useMessagerieConfig();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={profile.help.title} subtitle={profile.help.subtitle} />
      <HelpCenter />
    </div>
  );
}
