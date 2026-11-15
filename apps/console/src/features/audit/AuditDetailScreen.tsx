'use client';

import { Alert, Badge, Button, Icon } from '@eguardimmo/ui';
import { Copy, Download, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuditEvent } from '@/console/hooks/queries';
import { useExportAudit } from '@/console/hooks/mutations';
import { AUDIT_TYPE_LABELS, AUDIT_TYPE_TONES } from '@/console/schemas';
import type { AuditDetail } from '@/console/schemas';
import { downloadTextFile } from '@/lib/download';
import { formatDateTimeSeconds } from '@/lib/format';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { KeyValueList, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';

function shortHash(hash: string): string {
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

export function AuditDetailScreen({ id }: { id: string }) {
  const query = useAuditEvent(id);
  return (
    <QueryState
      query={query}
      label="L’événement"
      notFound={{
        title: 'Événement introuvable',
        description: 'Cet événement n’existe pas dans le journal d’audit.',
        backHref: '/audit',
        backLabel: 'Retour au journal d’audit',
      }}
    >
      {(detail) => <DetailContent detail={detail} />}
    </QueryState>
  );
}

function DetailContent({ detail }: { detail: AuditDetail }) {
  const { event, integrity } = detail;
  const notify = useNotify();
  const exportAudit = useExportAudit();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(event.reference);
      notify.success('Identifiant copié', event.reference);
    } catch {
      notify.error('Copie impossible', 'Autorisez l’accès au presse-papiers ou copiez l’identifiant à la main.');
    }
  };
  const exportEvent = async () => {
    try {
      const result = await exportAudit.mutateAsync({ q: event.reference });
      downloadTextFile(`${event.reference}.csv`, result.csv);
      notify.success('Événement exporté', 'L’export est consigné au journal d’audit.');
    } catch {
      notify.error('Export impossible', 'Réessayez dans un instant.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Journal d’audit', href: '/audit' }, { label: event.reference }]}
        title={event.title}
        badges={
          <>
            <Badge tone={AUDIT_TYPE_TONES[event.type]}>{AUDIT_TYPE_LABELS[event.type]}</Badge>
            <Badge tone="success">Consigné</Badge>
          </>
        }
        subtitle={`${event.organisationName ? `${event.organisationName} · ` : ''}${formatDateTimeSeconds(event.at)} (UTC+1)`}
        actions={
          <>
            <Button variant="secondary" onClick={() => void copy()}>
              <Icon icon={Copy} />
              Copier l’identifiant
            </Button>
            <Button variant="secondary" loading={exportAudit.isPending} onClick={() => void exportEvent()}>
              <Icon icon={Download} />
              Exporter l’événement
            </Button>
          </>
        }
      />
      <Alert tone="info">
        <span className="flex items-start gap-2">
          <Icon icon={Lock} className="mt-0.5 shrink-0" />
          Cet événement ne peut être ni modifié ni supprimé. Son empreinte est chaînée à celle de l’événement précédent.
        </span>
      </Alert>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section id="evenement" title="Événement">
          <KeyValueList
            items={[
              { label: 'Identifiant', value: event.reference },
              { label: 'Horodatage', value: formatDateTimeSeconds(event.at) },
              { label: 'Type', value: AUDIT_TYPE_LABELS[event.type] },
              { label: 'Action', value: event.action },
              ...(event.organisationName
                ? [
                    {
                      label: 'Organisation',
                      value: event.organisationId ? (
                        <Link href={`/organisations/${event.organisationId}`} className="underline underline-offset-3">
                          {event.organisationName}
                        </Link>
                      ) : (
                        event.organisationName
                      ),
                    },
                  ]
                : []),
              ...(event.resource ? [{ label: 'Ressource', value: event.resource }] : []),
              ...(event.module ? [{ label: 'Module', value: event.module }] : []),
              ...(event.request ? [{ label: 'Requête', value: <code className="text-caption break-all">{event.request}</code> }] : []),
            ]}
          />
        </Section>
        <Section id="acteur" title="Acteur">
          <KeyValueList
            items={[
              { label: 'Personne', value: event.actor.name },
              { label: 'Profil', value: event.actor.role },
              { label: 'Origine', value: `${event.origin} (masquée)` },
              { label: 'Appareil', value: event.device },
              { label: 'Session', value: event.session },
            ]}
          />
        </Section>
        {event.before || event.after ? (
          <Section id="avant-apres" title="Avant et après" className="xl:col-span-2">
            <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
              <ChangeBlock title="Avant" values={event.before} />
              <ChangeBlock title="Après" values={event.after} />
            </div>
          </Section>
        ) : null}
        <Section id="integrite" title="Intégrité" className="xl:col-span-2">
          <KeyValueList
            items={[
              { label: 'Empreinte', value: <code>{shortHash(event.hash)}</code> },
              { label: 'Précédente', value: <code>{shortHash(event.previousHash)}</code> },
              { label: 'Vérifiée le', value: formatDateTimeSeconds(integrity.verifiedAt) },
            ]}
          />
          <div className="pt-3">
            <Alert tone={integrity.intact ? 'success' : 'danger'}>
              <span className="flex items-start gap-2">
                <Icon icon={ShieldCheck} className="mt-0.5 shrink-0" />
                {integrity.intact ? 'Chaîne du journal intacte jusqu’à cet événement.' : 'Rupture détectée dans la chaîne du journal.'}
              </span>
            </Alert>
          </div>
        </Section>
      </div>
    </div>
  );
}

function ChangeBlock({ title, values }: { title: string; values: Record<string, string> | null }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-muted p-3">
      <h3 className="text-body-strong">{title}</h3>
      {values ? (
        <KeyValueList items={Object.entries(values).map(([label, value]) => ({ label, value }))} labelWidth="sm:grid-cols-[120px_minmax(0,1fr)]" />
      ) : (
        <p className="text-caption text-fg-subtle">Aucune valeur.</p>
      )}
    </div>
  );
}
