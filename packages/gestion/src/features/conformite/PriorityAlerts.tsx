'use client';

import { Alert } from '@eguardimmo/ui';
import { useCertificates } from './hooks';
import { conformitePaths } from './paths';
import type { Certificate, CertificateState } from './model';
import { useSubjectChoices } from './useSubjects';
import { useGestionNavigation } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';

const PRIORITY_COUNT = 5;

function Priority({ state, title }: { state: Extract<CertificateState, 'expired' | 'to_renew'>; title: string }) {
  const { Link } = useGestionNavigation();
  const choices = useSubjectChoices();
  const query = useCertificates({ state, perPage: PRIORITY_COUNT });
  if (query.isError) return <Alert tone="warning" title={`${title} : chargement impossible`}>{query.error?.message}</Alert>;
  const items: Certificate[] = [...(query.data?.items ?? [])].sort((a, b) => (a.expiresOn ?? '').localeCompare(b.expiresOn ?? ''));
  if (items.length === 0) return null;
  const more = query.data?.nextCursor !== null;
  return (
    <Alert tone={state === 'expired' ? 'danger' : 'warning'} title={title}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={conformitePaths.certificate(item.id)} className="underline underline-offset-2">
              {`${item.type.label}${item.reference ? ` ${item.reference}` : ''}`}
            </Link>
            {`, ${choices.labelOf(item.subject)}, échéance le ${formatDateFr(item.expiresOn)}`}
          </li>
        ))}
        {more ? <li>Et d’autres pièces : voir la liste filtrée ci-dessous.</li> : null}
      </ul>
    </Alert>
  );
}

export function PriorityAlerts() {
  return (
    <div className="flex flex-col gap-2" aria-label="Échéances à traiter" role="region">
      <Priority state="expired" title="Pièces expirées" />
      <Priority state="to_renew" title="Pièces à renouveler" />
    </div>
  );
}
