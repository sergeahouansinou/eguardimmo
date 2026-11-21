'use client';

import { NewRequestForm } from '../components/NewRequestForm';
import { AvailabilityLine, SupportHeader } from '../components/parts';
import { useSupportConfig } from '../context';

export function SupportNewRequestPage() {
  const { routes } = useSupportConfig();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SupportHeader
        title="Nouvelle demande"
        subtitle="Décrivez votre demande : l’équipe vous répond dans les meilleurs délais."
        breadcrumb={[{ label: 'Mes demandes au support', href: routes.board }, { label: 'Nouvelle demande' }]}
      />
      <AvailabilityLine />
      <NewRequestForm />
    </div>
  );
}
