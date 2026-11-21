'use client';

import { Badge } from '@eguardimmo/ui';
import Link from 'next/link';
import { useOperator } from '@/espace/useOperator';
import { formatDate } from '@/lib/format';
import type { PrivacyRequest } from '@/platform/privacy/privacy';
import { hasRole } from '@/platform/roles';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { Section } from '@/ui/Section';
import { usePrivacyRequest } from './hooks';
import { KIND_LABELS, STATUS_LABELS, STATUS_TONES } from './labels';
import { RequestActions } from './RequestActions';
import { ComplianceSection, DeadlineSection, JournalSection, RequesterSection } from './RequestSections';

function Content({ request }: { request: PrivacyRequest }) {
  const operator = useOperator();
  const canWrite = operator.data !== undefined && hasRole(operator.data.roles, 'compliance');
  const who = request.requester.name ?? request.requester.email ?? 'demandeur sans compte';
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Conformité RGPD', href: '/rgpd' }, { label: `${KIND_LABELS[request.kind] ?? request.kind}, ${who}` }]}
        title={`${KIND_LABELS[request.kind] ?? request.kind}, ${who}`}
        badges={
          <>
            <Badge tone={STATUS_TONES[request.status]}>{STATUS_LABELS[request.status]}</Badge>
            {request.overdue ? <Badge tone="danger">En retard</Badge> : null}
          </>
        }
        subtitle={`Reçue le ${formatDate(request.receivedAt)} · échéance le ${formatDate(request.deadline)}`}
      />
      <Section id="actions" title="Traitement de la demande">
        <RequestActions request={request} canWrite={canWrite} />
      </Section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <RequesterSection request={request} />
          <DeadlineSection request={request} />
          <ComplianceSection request={request} />
        </div>
        <JournalSection request={request} />
      </div>
    </div>
  );
}

export function RgpdDetailScreen({ id }: { id: string }) {
  const query = usePrivacyRequest(id);
  return (
    <PlatformState
      query={query}
      label="La demande"
      notFound={{ title: 'Demande introuvable', description: 'Cette demande n’existe pas dans le registre RGPD.', backHref: '/rgpd', backLabel: 'Retour au registre' }}
    >
      {(request) => <Content request={request} />}
    </PlatformState>
  );
}
